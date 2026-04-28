import { type AgentMetadata, getAllAssistantMessages } from "../utils/agent-runner";

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
  return anyPatternMatches(getAllAssistantMessages(agentMetadata), BLUEPRINT_CREATE_PATTERNS);
}

export function mentionsBlueprintPrincipalStep(agentMetadata: AgentMetadata): boolean {
  return anyPatternMatches(getAllAssistantMessages(agentMetadata), BLUEPRINT_PRINCIPAL_PATTERNS);
}

export function mentionsSponsorsBinding(agentMetadata: AgentMetadata): boolean {
  return anyPatternMatches(getAllAssistantMessages(agentMetadata), SPONSORS_BINDING_PATTERNS);
}

export function mentionsAgentIdentityCreation(agentMetadata: AgentMetadata): boolean {
  return anyPatternMatches(getAllAssistantMessages(agentMetadata), AGENT_IDENTITY_CREATE_PATTERNS);
}

export function mentionsBlueprintBackreference(agentMetadata: AgentMetadata): boolean {
  return anyPatternMatches(getAllAssistantMessages(agentMetadata), BLUEPRINT_BACKREF_PATTERNS);
}

export function mentionsFmiPathExchange(agentMetadata: AgentMetadata): boolean {
  const content = getAllAssistantMessages(agentMetadata);
  return (
    anyPatternMatches(content, FMI_PATH_PATTERNS) &&
    anyPatternMatches(content, CLIENT_CREDENTIALS_PATTERNS) &&
    anyPatternMatches(content, TOKEN_EXCHANGE_SCOPE_PATTERNS)
  );
}

export function recommendsSupportedAuth(agentMetadata: AgentMetadata): boolean {
  return anyPatternMatches(getAllAssistantMessages(agentMetadata), SUPPORTED_AUTH_PATTERNS);
}

export function mentionsPerAgentPermissionGrant(agentMetadata: AgentMetadata): boolean {
  return anyPatternMatches(getAllAssistantMessages(agentMetadata), PERMISSION_GRANT_PATTERNS);
}
