import { type AgentMetadata, getAllAssistantMessages } from "../utils/agent-runner";
import { argsString } from "../utils/evaluate";

/**
 * Tool names whose `arguments.command` carries the actual script body.
 */
const SHELL_TOOL_NAMES = ["bash", "powershell"];

/**
 * Tool name fragments used to detect file-write/edit calls. Matches the
 * convention used by `tests/utils/regression-detectors.ts`.
 */
const WRITE_TOOL_FRAGMENTS = ["create", "edit", "write"];

/**
 * File extensions that should also be searched for the patterns below
 * (Python, PowerShell, shell). Matched case-insensitively against any
 * `filePath` / `file_path` / `file` / `path` / `target_file` / `uri`
 * argument on a file-write tool call.
 */
const SCRIPT_EXTENSIONS = [".py", ".ps1", ".sh"];

function extractFilePath(args: unknown): string {
  let record: Record<string, unknown> | undefined;
  if (args && typeof args === "object") {
    record = args as Record<string, unknown>;
  } else if (typeof args === "string") {
    try {
      const parsed: unknown = JSON.parse(args);
      if (parsed && typeof parsed === "object") {
        record = parsed as Record<string, unknown>;
      }
    } catch {
      /* ignore non-JSON string args */
    }
  }
  if (!record) return "";
  for (const key of ["filePath", "file_path", "file", "path", "target_file", "uri"]) {
    const value = record[key];
    if (typeof value === "string") return value;
  }
  return "";
}

function isScriptFile(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return SCRIPT_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Collect the bodies of any Python (`.py`), PowerShell (`.ps1`), or shell
 * (`.sh`) scripts the agent produced — either as `bash` / `powershell`
 * tool invocations, or as file-write tool calls targeting one of those
 * extensions.
 */
function getScriptContent(agentMetadata: AgentMetadata): string {
  const parts: string[] = [];

  for (const event of agentMetadata.events) {
    if (event.type !== "tool.execution_start") continue;
    const data = event.data as { toolName?: string; arguments?: unknown };
    const toolName = data.toolName ?? "";

    if (SHELL_TOOL_NAMES.includes(toolName)) {
      const args = data.arguments as { command?: string } | undefined;
      if (args?.command) parts.push(args.command);
      continue;
    }

    if (WRITE_TOOL_FRAGMENTS.some((fragment) => toolName.toLowerCase().includes(fragment))) {
      const filePath = extractFilePath(data.arguments);
      if (filePath && isScriptFile(filePath)) {
        parts.push(argsString(event));
      }
    }
  }

  return parts.join("\n");
}

/**
 * Combined haystack for all pattern helpers below: assistant messages plus
 * any Python/PowerShell/shell script bodies the agent wrote or executed.
 */
function getSearchableContent(agentMetadata: AgentMetadata): string {
  return `${getAllAssistantMessages(agentMetadata)}\n${getScriptContent(agentMetadata)}`;
}

/**
 * The Blueprint creation flow MUST mention the typed Graph endpoint
 * (microsoft.graph.agentIdentityBlueprint) — there is no other canonical
 * way to refer to the Blueprint API. The negative lookahead excludes
 * `agentIdentityBlueprintPrincipal` so this matches only the Blueprint
 * itself.
 */
const BLUEPRINT_CREATE_PATTERNS: readonly RegExp[] = [
  /microsoft\.graph\.agentIdentityBlueprint(?!Principal)/i,
];

/**
 * Creating a Blueprint does NOT auto-create its service principal. Skipping
 * the BlueprintPrincipal step produces:
 *   400: The Agent Blueprint Principal for the Agent Blueprint does not exist.
 * Any correct Blueprint walkthrough must surface this step.
 */
const BLUEPRINT_PRINCIPAL_PATTERNS: readonly RegExp[] = [
  /microsoft\.graph\.agentIdentityBlueprintPrincipal/i,
];

/**
 * Sponsors are required at Blueprint creation and bound via OData
 * navigation property syntax — the exact `sponsors@odata.bind` token is
 * how the Graph API expects them.
 */
const SPONSORS_BINDING_PATTERNS: readonly RegExp[] = [
  /sponsors@odata\.bind/i,
];

/**
 * Per-instance Agent Identity creation uses the typed servicePrincipal
 * endpoint. The lookahead excludes `agentIdentityBlueprint(Principal)`
 * so this matches only the bare `agentIdentity` form.
 */
const AGENT_IDENTITY_CREATE_PATTERNS: readonly RegExp[] = [
  /microsoft\.graph\.agentIdentity(?![A-Za-z])/i,
];

/**
 * Each Agent Identity is linked back to its Blueprint via the
 * `agentIdentityBlueprintId` property on the create request.
 */
const BLUEPRINT_BACKREF_PATTERNS: readonly RegExp[] = [
  /agentIdentityBlueprintId/i,
];

/**
 * Runtime token exchange uses `fmi_path` (NOT RFC 8693 token-exchange,
 * which returns AADSTS82001), with `client_credentials` grant, and either
 * `api://AzureADTokenExchange/.default` (step 1) or `/.default` scope
 * (both steps).
 */
const FMI_PATH_PATTERNS: readonly RegExp[] = [/\bfmi_path\b/i];
const CLIENT_CREDENTIALS_PATTERNS: readonly RegExp[] = [/client_credentials/i];
const TOKEN_EXCHANGE_SCOPE_PATTERNS: readonly RegExp[] = [
  /AzureADTokenExchange/i,
  /\/\.default/i,
];

/**
 * `DefaultAzureCredential` / Azure CLI tokens are hard-rejected by Agent
 * Identity APIs (Directory.AccessAsUser.All ⇒ 403). The skill steers users
 * toward a working path: `client_credentials` via a dedicated app
 * registration (Python/SDK) or `Connect-MgGraph` with explicit delegated
 * scopes (PowerShell).
 */
const SUPPORTED_AUTH_PATTERNS: readonly RegExp[] = [
  /ClientSecretCredential/i,
  /client_credentials/i,
  /Connect-MgGraph/i,
];

/**
 * Permissions are granted PER Agent Identity (not on the BlueprintPrincipal):
 * `appRoleAssignments` for application permissions, `oauth2PermissionGrants`
 * for delegated.
 */
const PERMISSION_GRANT_PATTERNS: readonly RegExp[] = [
  /appRoleAssignments/i,
  /oauth2PermissionGrants/i,
];

function anyPatternMatches(content: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((p) => p.test(content));
}

export function mentionsBlueprintCreation(agentMetadata: AgentMetadata): boolean {
  return anyPatternMatches(getSearchableContent(agentMetadata), BLUEPRINT_CREATE_PATTERNS);
}

export function mentionsBlueprintPrincipalStep(agentMetadata: AgentMetadata): boolean {
  return anyPatternMatches(getSearchableContent(agentMetadata), BLUEPRINT_PRINCIPAL_PATTERNS);
}

export function mentionsSponsorsBinding(agentMetadata: AgentMetadata): boolean {
  return anyPatternMatches(getSearchableContent(agentMetadata), SPONSORS_BINDING_PATTERNS);
}

export function mentionsAgentIdentityCreation(agentMetadata: AgentMetadata): boolean {
  return anyPatternMatches(getSearchableContent(agentMetadata), AGENT_IDENTITY_CREATE_PATTERNS);
}

export function mentionsBlueprintBackreference(agentMetadata: AgentMetadata): boolean {
  return anyPatternMatches(getSearchableContent(agentMetadata), BLUEPRINT_BACKREF_PATTERNS);
}

export function mentionsFmiPathExchange(agentMetadata: AgentMetadata): boolean {
  const content = getSearchableContent(agentMetadata);
  return (
    anyPatternMatches(content, FMI_PATH_PATTERNS) &&
    anyPatternMatches(content, CLIENT_CREDENTIALS_PATTERNS) &&
    anyPatternMatches(content, TOKEN_EXCHANGE_SCOPE_PATTERNS)
  );
}

export function recommendsSupportedAuth(agentMetadata: AgentMetadata): boolean {
  return anyPatternMatches(getSearchableContent(agentMetadata), SUPPORTED_AUTH_PATTERNS);
}

export function mentionsPerAgentPermissionGrant(agentMetadata: AgentMetadata): boolean {
  return anyPatternMatches(getSearchableContent(agentMetadata), PERMISSION_GRANT_PATTERNS);
}
