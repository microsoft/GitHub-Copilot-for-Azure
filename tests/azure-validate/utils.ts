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
