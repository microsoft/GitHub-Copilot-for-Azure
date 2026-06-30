/**
 * Helper functions for extracting test related metadata from stimuli tags.
 */
import type { SystemMessageConfig } from "@github/copilot-sdk";
import type { AgentMetadata } from "../utils/agent-runner.ts";
import { isSkillInvoked, getToolCalls, getAllAssistantMessages, argsString } from "../utils/evaluate.ts";

/**
 * When any of the early termination condition is satisfied,
 * the custom executor will terminate the agent and hand over
 * the trajectory to the graders.
 */
export type EarlyTerminateCondition = {
  type: "tool-call-count";
  /**
   * Number of tool calls.
   * Early terminate if the number of tool calls exceed this count.
   */
  count: number;
} | {
  type: "skill-call";
  /**
   * Name of the skill.
   */
  skill: string;
} | {
  type: "assistant-message-match";
  /**
   * A regex pattern matching the assistant message content.
   */
  contentPattern: string;
} | {
  /**
   * Terminates when a tool call matching toolPattern and argsPattern is started.
   */
  type: "tool-call-match";
  /**
   * A regex pattern matching the tool name.
   */
  toolPattern: string;
  /**
   * A regex pattern matching the serialized tool argument.
   */
  argsPattern: string;
} | {
  /**
   * Terminates when a tool call matching toolPattern and argsPattern has completed (produced a result).
   */
  type: "tool-call-result";
  /**
   * A regex pattern matching the tool name.
   */
  toolPattern: string;
  /**
   * An optional regex pattern matching the serialized tool argument.
   */
  argsPattern?: string;
};

export type TakeScreenshotCondition = {
  type: "has-deployment-url";
  /**
   * A regex pattern matching the deployed app's url.
   */
  urlPattern: string;
}

export function isSkillInvocationTest(tags: Record<string, string | string[]> | undefined): boolean {
  return tags?.area === "routing";
}

export function getSkillName(tags: Record<string, string[] | string> | undefined): string {
  if (!tags) {
    return "unknown";
  }
  const skill = tags["skill"];
  if (typeof skill === "string") {
    return skill;
  } else {
    console.error("Failed to parse skill name", skill);
    return "unknown";
  }
}

export function getEarlyTerminateCondition(tags: Record<string, string[] | string> | undefined): { shouldEarlyTerminate?: (agentMetadata: AgentMetadata) => boolean } {
  if (!tags) {
    return {};
  }

  const value = tags["earlyTerminate"];
  try {
    if (!value) {
      return {};
    }
    if (typeof value !== "string") {
      console.error("Failed to parse earlyTerminateCondition", value);
      return {};
    }
    const earlyTerminateCondition: EarlyTerminateCondition[] = JSON.parse(value);
    return {
      shouldEarlyTerminate: (agentMetadata) => {
        for (let i = 0; i < earlyTerminateCondition.length; i++) {
          const condition = earlyTerminateCondition[i];
          if (condition.type === "skill-call") {
            if (isSkillInvoked(agentMetadata, condition.skill)) {
              agentMetadata.testComments.push(`Early terminate due to skill invoked: ${condition.skill}`);
              return true;
            }
          } else if (condition.type === "tool-call-count") {
            if (getToolCalls(agentMetadata).length > condition.count) {
              agentMetadata.testComments.push(`Early terminate due to tool call counts exceeding: ${condition.count}`);
              return true;
            }
          } else if (condition.type === "assistant-message-match") {
            const contentPattern = new RegExp(condition.contentPattern);
            if (contentPattern.test(getAllAssistantMessages(agentMetadata))) {
              agentMetadata.testComments.push(`Early terminate due to assistant message matching pattern: ${condition.contentPattern}`);
              return true;
            }
          } else if (condition.type === "tool-call-match") {
            const toolPattern = new RegExp(condition.toolPattern);
            const argsPattern = new RegExp(condition.argsPattern);
            const matched = getToolCalls(agentMetadata).some((event) => {
              return toolPattern.test(event.data.toolName)
                && argsPattern.test(argsString(event));
            });
            if (matched) {
              agentMetadata.testComments.push(`Early terminate due to tool call matching pattern: tool ${condition.toolPattern}, args ${condition.argsPattern}`);
              return true;
            }
          } else if (condition.type === "tool-call-result") {
            const toolPattern = new RegExp(condition.toolPattern);
            const argsPattern = condition.argsPattern ? new RegExp(condition.argsPattern) : undefined;
            const completedIds = new Set(
              agentMetadata.events
                .filter((event) => event.type === "tool.execution_complete")
                .map((event) => event.data.toolCallId)
                .filter((id) => id !== undefined)
            );
            const matched = getToolCalls(agentMetadata).some((event) => {
              return toolPattern.test(event.data.toolName)
                && (argsPattern === undefined || argsPattern.test(argsString(event)))
                && completedIds.has(event.data.toolCallId);
            });
            if (matched) {
              agentMetadata.testComments.push(`Early terminate due to tool call result matching pattern: tool ${condition.toolPattern}, args ${condition.argsPattern ?? "*"}`);
              return true;
            }
          }
        }
        return false;
      }
    };
  } catch (error) {
    console.error("Failed to parse earlyTerminateCondition", value, error);
    return {};
  }
}

export function getFollowUp(tags: Record<string, string[] | string> | undefined): string[] | undefined {
  if (!tags) {
    return undefined;
  }
  const followUp = tags["followUp"];
  if (!followUp) {
    return undefined;
  }
  if (Array.isArray(followUp)) {
    return followUp;
  } else {
    console.error("Failed to get follow up from tags", followUp);
    return undefined;
  }
}

export function getSystemPrompt(tags: Record<string, string[] | string> | undefined): SystemMessageConfig | undefined {
  if (!tags) {
    return undefined;
  }

  const value = tags["systemPrompt"];

  try {
    if (!value) {
      return undefined;
    }
    if (typeof value !== "string") {
      console.error("Unable to get systemPrompt", value);
      return undefined;
    }
    const systemPrompt = JSON.parse(value);
    return systemPrompt;
  } catch (error) {
    console.error("Unable to get systemPrompt", value, error);
    return undefined;
  }
}

export function getTakeScreenshotCondition(tags: Record<string, string[] | string> | undefined): { takeScreenshot?: { predicate: (agentMetadata: AgentMetadata) => boolean } } {
  if (!tags) {
    return {};
  }

  const value = tags["takeScreenshot"];
  try {
    if (!value) {
      return {};
    }
    if (typeof value !== "string") {
      console.error("Failed to parse takeScreenshot condition", value);
      return {};
    }
    const conditions: TakeScreenshotCondition[] = JSON.parse(value);
    return {
      takeScreenshot: {
        predicate: (agentMetadata) => {
          for (const condition of conditions) {
            if (condition.type === "has-deployment-url") {
              const urlPattern = new RegExp(condition.urlPattern);
              if (urlPattern.test(getAllAssistantMessages(agentMetadata))) {
                return true;
              }
            }
          }
          return false;
        }
      }
    };
  } catch (error) {
    console.error("Failed to parse takeScreenshot condition", value, error);
    return {};
  }
}

export function getRequiredSkillsCondition(tags: Record<string, string[] | string> | undefined): string[] | undefined {
  if (!tags) {
    return undefined;
  }

  const value = tags["requiredSkills"];

  if (!value) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value;
  } else {
    console.error("Failed to get requiredSkills from tags", value);
    return undefined;
  }
}