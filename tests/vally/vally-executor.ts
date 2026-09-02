import { computeMetrics } from "@microsoft/vally";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "url";
import { getAzureFixtureManifestPath, getEarlyTerminateCondition, getRequiredSkillsCondition, getSkillName, getSystemPrompt, getTakeScreenshotCondition } from "./tag-helpers.ts";
import { listPlugins, type Plugin, type SkillRef } from "../utils/skill-loader.ts";
import { normalizeTestName } from "./utils.ts";
import { useAgentRunner, createMarkdownReport } from "../utils/agent-runner.ts";
import * as path from "node:path";
import type { AgentMetadata, AgentRunConfig } from "../utils/agent-runner.ts";
import type { Executor, ExecutorOptions, ExecutorRegistry, Stimulus, Trajectory, TrajectoryEvent } from "@microsoft/vally";
import { deleteResourceGroup, type ProvisionScriptOutput } from "../azure-fixtures/fixture-common.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * The model to use for the agent run.
 */
const modelOverride = process.env.MODEL_OVERRIDE?.trim() || undefined;
const NPX_COMMAND = process.platform === "win32" ? "npx.cmd" : "npx";

export class IntegrationTestAgentRunner implements Executor {
  name = "integration-test-agent-runner";
  supportsMultiTurn = true;
  supportsPreparedWorkspace = true;

  async execute(stimulus: Stimulus, options: ExecutorOptions): Promise<Trajectory> {
    const startedAt = new Date();
    const tags = stimulus.tags;
    const skillName = getSkillName(tags);
    const normalizedTestName = normalizeTestName(skillName, stimulus.name);
    const agentRunner = useAgentRunner({
      isTest: true,
      testName: normalizedTestName
    });

    // When custom executor is executed, vally has initialized the test workspace for us.
    const workDir = options.workDir;

    // Set the model to use
    const model = modelOverride ?? options.model ?? "claude-sonnet-4.6";

    const { shouldEarlyTerminate } = getEarlyTerminateCondition(tags);
    const systemPrompt = getSystemPrompt(tags);
    const { takeScreenshot } = getTakeScreenshotCondition(tags);
    const requiredSkills = getRequiredSkillsCondition(tags);
    const timeout = options.timeout;
    let fixtureResourceGroups: string[] = [];

    // Detect the owning plugin of the required skills and construct SkillRef objects for downstream processing
    const plugins = listPlugins();
    const requiredSkillRefs: SkillRef[] = [];
    let plugin: Plugin | undefined;
    (requiredSkills ?? [skillName]).forEach(s => {
      const owningPlugin = plugins.filter(plugin => plugin.skills.some(skillRef => skillRef.name === s)).at(0);
      if (owningPlugin) {
        plugin = owningPlugin;
        requiredSkillRefs.push({
          pluginDirname: owningPlugin.dirname,
          name: s
        });
      }
    });

    let prompt: string;
    if (stimulus.turns) {
      prompt = stimulus.turns[0];
    } else {
      prompt = stimulus.prompt;
    }
    let followUps: string[] | undefined;
    if (stimulus.turns) {
      followUps = stimulus.turns.slice(1);
    }

    const runConfig: AgentRunConfig = {
      workspace: workDir,
      env: {
        UV_CACHE_DIR: path.join(workDir, ".uv-cache"),
      },
      model: model,
      prompt: prompt,
      shouldEarlyTerminate: shouldEarlyTerminate,
      nonInteractive: true,
      followUp: followUps,
      systemPrompt: systemPrompt,
      timeout: timeout,
      takeScreenshot: takeScreenshot,
      requiredSkills: requiredSkillRefs.length > 0 ? requiredSkillRefs : undefined,
      maxTurns: stimulus.constraints?.max_turns,
      // Always make our agent runner preserve workspace.
      // vally will delete the test workspace by default.
      preserveWorkspace: true
    };

    // Provision azure fixture if it's defined
    const relativeManifestPath = getAzureFixtureManifestPath(tags);
    if (relativeManifestPath && plugin?.dirname) {
      // <repo-root>/evals/<plugin-dir>/<skill-name>/<relative-manifest-path>
      const absoluteManifestPath = path.resolve(__dirname, `../../evals/${plugin.dirname}/${skillName}`, relativeManifestPath);
      const provisionScriptPath = path.resolve(__dirname, "../azure-fixtures/provision-fixture.ts");
      const provisionOutput = execFileSync(
        NPX_COMMAND,
        ["-y", "tsx", provisionScriptPath, absoluteManifestPath],
        { shell: true, encoding: "utf8" }
      );
      const parsedProvisionOutput: ProvisionScriptOutput = JSON.parse(provisionOutput);
      const azureScopePrompt = getAzureScopePrompt(parsedProvisionOutput);
      runConfig.prompt += `\n${azureScopePrompt}`;
      fixtureResourceGroups = parsedProvisionOutput.resourceGroups;
    }

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

    // Delete the fixtures provisioned for this test run
    for (const resourceGroupName of fixtureResourceGroups) {
      try {
        deleteResourceGroup(resourceGroupName);
      } catch {
        // Suppress cleanup failures so they do not mask test results.
      }
    }

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
        skillsLoaded: agentMetadata.skillsLoaded.map(ref => ref.name),
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

function getAzureScopePrompt(fixtureOutput: ProvisionScriptOutput): string {
  return `Limit your operations in the following resource groups: ${JSON.stringify(fixtureOutput.resourceGroups)}. Never read or modify resources outside these resource groups.`;
}