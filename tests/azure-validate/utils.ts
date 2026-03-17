import { type AgentMetadata } from "../utils/agent-runner";
import { getToolCalls } from "../utils/evaluate";

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

const SHELL_TOOL_NAMES = ["powershell", "bash"];

/**
 * Check if any shell tool call (powershell or bash) contains a validation command
 * (azd provision, az deployment ... validate, or terraform validate).
 *
 * Useful as a `shouldEarlyTerminate` callback to stop agent sessions
 * once a validation command has been issued, without waiting for deployment.
 */
export function hasValidationCommand(metadata: AgentMetadata): boolean {
  const shellCalls = getToolCalls(metadata).filter(event => SHELL_TOOL_NAMES.includes(event.data.toolName));
  return shellCalls.some(event => {
    const data = event.data as Record<string, unknown>;
    const args = data.arguments as { command?: string } | undefined;
    const cmd = args?.command ?? "";
    return VALIDATION_COMMAND_PATTERNS.some(pattern => pattern.test(cmd));
  });
}

/**
 * Check whether any file-mutating tool call (create or edit) targets a file
 * whose path matches {@link pathPattern} AND whose serialized arguments
 * match {@link contentPattern}.
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
