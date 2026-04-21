import { type AgentMetadata, getAllAssistantMessages } from "../utils/agent-runner";
import {
  softCheckSkill,
  isSkillInvoked,
  shouldEarlyTerminateForSkillInvocation,
  getToolCalls,
  argsString,
} from "../utils/evaluate";

/** Maximum assistant messages before early termination (prevents timeout). */
export const MAX_PLAN_API_CALLS = 8;

/**
 * Early termination that combines skill invocation check with an API call ceiling.
 * Use for skill-invocation rate tests where we just need to know if skill was called.
 */
export function earlyTerminateForPlan(metadata: AgentMetadata, skillName: string): boolean {
  if (shouldEarlyTerminateForSkillInvocation(metadata, skillName)) return true;
  const messageCount = metadata.events.filter(e => e.type === "assistant.message").length;
  return messageCount >= MAX_PLAN_API_CALLS;
}

/**
 * Early termination that only caps API calls — does NOT terminate on skill invocation.
 * Use for plan-generation tests where the agent needs to finish writing files.
 */
export function earlyTerminateOnApiCeiling(metadata: AgentMetadata): boolean {
  const messageCount = metadata.events.filter(e => e.type === "assistant.message").length;
  return messageCount >= MAX_PLAN_API_CALLS;
}

/**
 * Check if the agent response mentions plan completion or approval.
 */
export function hasPlanCompletionIndicators(agentMetadata: AgentMetadata): boolean {
  const content = getAllAssistantMessages(agentMetadata);
  const completionPatterns = [
    /project-plan\.md/i,
    /plan.*approved/i,
    /plan.*complete/i,
    /azure-project-scaffold/i,
  ];
  return completionPatterns.some((pattern) => pattern.test(content));
}

/**
 * Log all tool calls for diagnostic purposes.
 * Returns a summary string for test output.
 */
export function logToolCalls(agentMetadata: AgentMetadata): string {
  const calls = getToolCalls(agentMetadata);
  const summary = calls.map((call) => {
    const args = argsString(call).slice(0, 120);
    return `  ${call.data.toolName}: ${args}`;
  });
  return `Tool calls (${calls.length}):\n${summary.join("\n")}`;
}

/**
 * Soft-check that relevant skills in the plan workflow were invoked.
 */
export function softCheckPlanSkills(agentMetadata: AgentMetadata): void {
  softCheckSkill(agentMetadata, "azure-project-plan");
}

/**
 * Check if the plan auto-chained to azure-project-scaffold.
 */
export function didAutoChainToScaffold(agentMetadata: AgentMetadata): boolean {
  if (isSkillInvoked(agentMetadata, "azure-project-scaffold")) return true;
  // Fallback: check if assistant mentions scaffold as next step
  const content = getAllAssistantMessages(agentMetadata);
  return /azure-project-scaffold/i.test(content);
}
