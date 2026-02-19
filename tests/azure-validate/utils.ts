import { type AgentMetadata, getToolCalls } from "../utils/agent-runner";

/**
 * Validation command patterns that indicate the agent is performing
 * validation (not deployment). When any of these are detected in a
 * powershell tool call, the session can be terminated early.
 */
const VALIDATION_COMMAND_PATTERNS = [
  /azd\s+provision/,
  /az\s+deployment\b.*\bvalidate\b/,
  /terraform\s+validate/,
];

/**
 * Check if any powershell tool call contains a validation command
 * (azd provision, az deployment ... validate, or terraform validate).
 *
 * Useful as a `shouldEarlyTerminate` callback to stop agent sessions
 * once a validation command has been issued, without waiting for deployment.
 */
export function hasValidationCommand(metadata: AgentMetadata): boolean {
  const powershellCalls = getToolCalls(metadata, "powershell");
  return powershellCalls.some(event => {
    const data = event.data as Record<string, unknown>;
    const args = data.arguments as { command?: string } | undefined;
    const cmd = args?.command ?? "";
    return VALIDATION_COMMAND_PATTERNS.some(pattern => pattern.test(cmd));
  });
}

/**
 * Extract all powershell command strings from agent metadata.
 */
function getPowershellCommands(metadata: AgentMetadata): string[] {
  return getToolCalls(metadata, "powershell").map(event => {
    const data = event.data as Record<string, unknown>;
    const args = data.arguments as { command?: string } | undefined;
    return args?.command ?? "";
  });
}

/**
 * Check whether any powershell command executed by the agent matches
 * the given pattern.
 */
export function matchesCommand(metadata: AgentMetadata, pattern: RegExp): boolean {
  return getPowershellCommands(metadata).some(cmd => pattern.test(cmd));
}

/**
 * Check whether any tool call's serialized arguments match the given
 * pattern. Searches across all tool types (powershell, create, edit, etc.)
 * unless a specific toolName is provided.
 */
export function matchesToolCallArgs(
  metadata: AgentMetadata,
  pattern: RegExp,
  toolName?: string,
): boolean {
  return getToolCalls(metadata, toolName).some(event => {
    const argsStr = JSON.stringify(event.data);
    return pattern.test(argsStr);
  });
}

/**
 * Check whether any file-mutating tool call (create or edit) targets a file
 * whose path matches {@link pathPattern} AND whose serialized arguments
 * match {@link contentPattern}.
 *
 * This is stricter than {@link matchesToolCallArgs} because it ensures the
 * content appeared in a write to a specific file, not just in any tool call
 * (e.g. a plan document).
 */
export function matchesFileEdit(
  metadata: AgentMetadata,
  pathPattern: RegExp,
  contentPattern: RegExp,
): boolean {
  const FILE_MUTATING_TOOLS = ["create", "edit", "replace_string_in_file", "multi_replace_string_in_file"];
  const calls = getToolCalls(metadata).filter(event => {
    const toolName = (event.data as Record<string, unknown>).toolName as string | undefined;
    return toolName && FILE_MUTATING_TOOLS.includes(toolName);
  });

  return calls.some(event => {
    const argsStr = JSON.stringify(event.data);
    return pathPattern.test(argsStr) && contentPattern.test(argsStr);
  });
}
