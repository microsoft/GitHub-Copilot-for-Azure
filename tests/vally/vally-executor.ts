import type { Executor, ExecutorOptions, ExecutorRegistry, Stimulus, Trajectory, TrajectoryEvent } from "@microsoft/vally";
import { computeMetrics } from "@microsoft/vally";
import * as path from "node:path";
import type { AgentMetadata, AgentRunConfig } from "../utils/agent-runner.ts";
import { useAgentRunner, createMarkdownReport } from "../utils/agent-runner.ts";
import { listSkills } from "../utils/skill-loader.ts";
import { getEarlyTerminateCondition, getFollowUp, getRequiredSkillsCondition, getSkillName, getSystemPrompt, getTakeScreenshotCondition } from "./tag-helpers.ts";
import { normalizeTestName } from "./utils.ts";

export class IntegrationTestAgentRunner implements Executor {
  name = "integration-test-agent-runner";

  async execute(stimulus: Stimulus, options: ExecutorOptions): Promise<Trajectory> {
    const startedAt = new Date();
    const tags = stimulus.tags;
    const skillName = getSkillName(tags);
    const normalizedTestName = normalizeTestName(skillName, stimulus.name);
    const agentRunner = useAgentRunner({
      isTest: true,
      useJest: false,
      testName: normalizedTestName
    });

    // When custom executor is executed, vally has initialized the test workspace for us.
    const workDir = options.workDir;

    // Set the model to use
    const model = options.model ?? "claude-sonnet-4.6";

    const { shouldEarlyTerminate } = getEarlyTerminateCondition(tags);
    const followUp = getFollowUp(tags);
    const systemPrompt = getSystemPrompt(tags);
    const { takeScreenshot } = getTakeScreenshotCondition(tags);
    const requiredSkills = getRequiredSkillsCondition(tags);
    const timeout = options.timeout;

    const runConfig: AgentRunConfig = {
      workspace: workDir,
      env: {
        UV_CACHE_DIR: path.join(workDir, ".uv-cache"),
      },
      model: model,
      prompt: stimulus.prompt,
      shouldEarlyTerminate: shouldEarlyTerminate,
      nonInteractive: true,
      followUp: followUp,
      systemPrompt: systemPrompt,
      followUpTimeout: timeout,
      takeScreenshot: takeScreenshot,
      requiredSkills: requiredSkills,
      maxTurns: stimulus.constraints?.max_turns,
      // Always make our agent runner preserve workspace.
      // vally will delete the test workspace by default.
      preserveWorkspace: true
    };

    const agentMetadata: AgentMetadata = await agentRunner.run(runConfig);
    const completedAt = new Date();
    const events = convertToTrajectoryEvents(agentMetadata);
    const metrics = computeMetrics(events);

    const agentOutput = events
      .filter(e => e.type === "assistant_message")
      .map(e => e.data.content)
      .join("\n");

    const sessionId = agentMetadata.events
      .filter(e => e.type === "session.start")
      .at(0)?.id;

    await createMarkdownReport(normalizedTestName, runConfig, agentMetadata);
    await agentRunner.cleanup();

    // Vally will run the graders and produce results.jsonl.
    // After the all suites complete, we can process the results.json; file and recover our testResults.json file for dashboard consumption. 

    return {
      id: crypto.randomUUID(),
      stimulus,
      events,
      output: agentOutput,
      workDir: options.workDir,
      metadata: {
        startedAt,
        completedAt,
        model: model,
        executor: this.name,
        skillsLoaded: getSkills(),
        sessionID: sessionId ?? "unknown",
      },
      metrics: {
        ...metrics,
        wallTimeMs: completedAt.getTime() - startedAt.getTime(),
      },
    };
  }

  async shutdown(): Promise<void> {
    // no-op
  }
}

function convertToTrajectoryEvents(agentMetadata: AgentMetadata): TrajectoryEvent[] {
  const result: TrajectoryEvent[] = [];

  // tool.execution_complete only carries `toolCallId`, not `toolName`. Build
  // a lookup so we can populate `tool_result.data.toolName` from the matching
  // tool.execution_start event.
  const toolNameByCallId = new Map<string, string>();
  for (const e of agentMetadata.events) {
    if (e.type === "tool.execution_start") {
      toolNameByCallId.set(e.data.toolCallId, e.data.toolName);
    }
  }

  for (const e of agentMetadata.events) {
    const timestamp = e.timestamp ? new Date(e.timestamp) : undefined;

    if (e.type === "assistant.message") {
      result.push({
        type: "assistant_message",
        timestamp,
        data: {
          content: e.data.content,
        },
      });
    } else if (e.type === "assistant.reasoning") {
      result.push({
        type: "reasoning",
        timestamp,
        data: {
          content: e.data.content,
        },
      });
    } else if (e.type === "user.message") {
      result.push({
        type: "user_message",
        timestamp,
        data: {
          content: e.data.content,
          agent_mode: e.data.agentMode,
        },
      });
    } else if (e.type === "assistant.turn_start") {
      result.push({
        type: "turn_start",
        timestamp,
        data: {
          turnId: e.data.turnId,
        },
      });
    } else if (e.type === "assistant.turn_end") {
      result.push({
        type: "turn_end",
        timestamp,
        data: {
          turnId: e.data.turnId,
        },
      });
    } else if (e.type === "tool.execution_start") {
      if (e.data.toolName === "skill") {
        // Note: Although this type is defined, Copilot CLI in practice treat skills as tool calls.
        // We look for tool call events for skill and convert them into skill events.
        const args = e.data.arguments;
        const skillName: string = (args?.skill as string) ?? "unknown";
        result.push({
          type: "skill_activation",
          timestamp,
          data: {
            name: skillName,
            path: "todo: not supported"
          },
        });
      }
      result.push({
        type: "tool_call",
        timestamp,
        data: {
          toolName: e.data.toolName,
          toolCallId: e.data.toolCallId,
          arguments: e.data.arguments,
        },
      });
    } else if (e.type === "tool.execution_complete") {
      const toolName = toolNameByCallId.get(e.data.toolCallId) ?? "unknown";
      result.push({
        type: "tool_result",
        timestamp,
        data: {
          toolName,
          toolCallId: e.data.toolCallId,
          success: e.data.success,
          result: e.data.result ?? e.data.error,
        },
      });
    } else if (e.type === "assistant.usage") {
      result.push({
        type: "token_usage",
        timestamp,
        data: {
          model: e.data.model,
          inputTokens: e.data.inputTokens ?? -1,
          outputTokens: e.data.outputTokens ?? -1,
          cacheReadTokens: e.data.cacheReadTokens,
          cacheWriteTokens: e.data.cacheWriteTokens,
        },
      });
    } else if (e.type === "skill.invoked") {
      // Note: Although this type is defined, Copilot CLI in practice treat skills as tool calls.
      // We look for tool call events for skill and convert them into skill events.
      result.push({
        type: "skill_activation",
        timestamp,
        data: {
          name: e.data.name,
          path: e.data.path
        },
      });
    } else if (e.type === "session.error") {
      result.push({
        type: "error",
        timestamp,
        data: {
          message: e.data.message,
          type: e.data.errorType,
          url: e.data.url,
          code: e.data.statusCode,
        },
      });
    }
  }

  return result;
}

export function registerExecutors(registry: ExecutorRegistry): void {
  registry.register(new IntegrationTestAgentRunner());
}

function getSkills(): string[] {
  const noSkills = process.env.NO_SKILLS === "true";
  if (noSkills) {
    return [];
  }
  return listSkills();
}
