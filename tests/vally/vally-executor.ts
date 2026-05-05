import type { Executor, ExecutorOptions, ExecutorRegistry, Stimulus, Trajectory, TrajectoryEvent } from "@microsoft/vally";
import { computeMetrics } from "@microsoft/vally";
import { fileURLToPath, pathToFileURL } from "url";
import * as path from "path";
import * as fs from "fs/promises";
import type { AgentMetadata, AgentRunConfig } from "../utils/agent-runner.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class IntegrationTestAgentRunner implements Executor {
  name = "integration-test-agent-runner";

  async execute(stimulus: Stimulus, options: ExecutorOptions): Promise<Trajectory> {
    const startedAt = new Date();
    const skillName = stimulus.name.slice(0, stimulus.name.indexOf("_"));
    console.log("skillName", skillName);
    const evalDir = path.join(__dirname, "../../evals", skillName);
    console.log("evalDir", evalDir);

    const agentRunnerModule = await import(path.join(__dirname, "../utils/agent-runner.ts"));
    const { useAgentRunner, createMarkdownReport } = agentRunnerModule;
    console.log(Object.keys(agentRunnerModule));
    const agentRunner = useAgentRunner({
      isTest: true,
      testName: stimulus.name
    });
    // // Todo: need to add an option to let agentRunner use a pre-determined workspace instead of creating its own
    // // Todo: Migrate code that depends on jest environment; this means the agentRunner needs to accept parameters from vally and use them to determine how to write its artifacts (e.g. test names will be computed from the vally's test names)
    // // Todo: Use vally's verbose flag to control agentRunner's verbosity
    // // Todo: Let vally's model control agentRunner's model
    // // Todo: Use vally's parameter to control what skills to load
    // // Todo: Use vally's parameter to control what mcp server to load
    // // Todo: Use vally's parameter to control how to initialize the workspace

    // // Hack: execute arbitrary code for each stimulus
    // // 1. look for a JavaScript called "preset.js"
    // // 2. Dynamically import the file as a JavaScript module
    // // 3. Extract the known functions from it
    console.log("workDir", options.workDir);
    console.log("__dirname", __dirname);
    const environment = stimulus.environment;
    const presetFiles = stimulus.environment?.files;
    const presetScript = presetFiles?.find((f) => f.dest === "preset.js");
    console.log("environment", environment);
    console.log("presetFiles", presetFiles);
    console.log("presetScript", presetScript);

    // Create the test workspace from options.workDir
    await fs.mkdir(options.workDir, { recursive: true });
    for (const file of presetFiles ?? []) {
      // Skip the preset script — it's loaded dynamically below, not staged in the workspace.
      if (file === presetScript) continue;
      const srcPath = path.join(evalDir, file.src);
      const destPath = path.join(options.workDir, file.dest);
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      await fs.copyFile(srcPath, destPath);
    }

    // If presetScript is defined, compose its path = path.join(evalDir, presetScript.src)
    let presetModule: Record<string, unknown> | undefined;
    if (presetScript) {
      const presetScriptPath = path.join(evalDir, presetScript.src);
      console.log("presetScriptPath", presetScriptPath);

      // Dynamically load the presetScript as an ECMA module and print its keys here
      presetModule = await import(pathToFileURL(presetScriptPath).href) as Record<string, unknown>;
      console.log("presetScript keys", Object.keys(presetModule));
    }

    // Note: 
    // Custom callbacks can be implemented in each presetScript.js file as exported functions such as setup(), shouldEarlyTerminate(), takeScreenshot.predicate().
    // Custom properties can be implemented in each presetScript.js file as exported properties, such as followUp, systemPrompt.
    const runConfig: AgentRunConfig = {
      // How to inject this?
      // setup: async (workspace: string) => {
      //   return;
      // },
      prompt: stimulus.prompt,
      // How to inject this?
      // shouldEarlyTerminate: (metadata) => {
      //   return false;
      // },
      nonInteractive: true,
      // How to inject this?
      // followUp: [],
      // How to inject this?
      // systemPrompt: {
      //   mode: "append",
      //   content: ""
      // },
      // This can be removed and let vally manage it
      preserveWorkspace: false,
      // Todo: compute this from 
      // includeSkills: undefined,
      // How to inject this?
      followUpTimeout: 999999,
      // How to inject this?
      // takeScreenshot: {
      //   predicate: (agentMetadata) => false
      // }
    };

    const agentMetadata = await agentRunner.run(runConfig);
    // const agentMetadata: AgentMetadata = { events: [], testComments: [], toolCounts: {}, skillFiles: {} };
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

    await createMarkdownReport(stimulus.name, runConfig, agentMetadata);

    // Note: Vally will run the graders and produce results.jsonl.
    // After the all suites complete, we can process the file and recover our testResults.json file for dashboard consumption. 

    return {
      id: crypto.randomUUID(),
      stimulus,
      events,
      output: agentOutput,
      workDir: options.workDir,
      metadata: {
        startedAt,
        completedAt,
        model: options.model ?? "unknown",
        executor: this.name,
        skillsLoaded: [],
        sessionID: sessionId ?? "unknown",
      },
      metrics: {
        ...metrics,
        wallTimeMs: completedAt.getTime() - startedAt.getTime(),
      },
    };
  }

  async shutdown(): Promise<void> {
    // Clean up connections, pools, etc.
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
      result.push({
        type: "skill_activation",
        timestamp,
        data: {
          name: e.data.name,
          path: e.data.path,
          content: e.data.content,
          pluginName: e.data.pluginName,
          pluginVersion: e.data.pluginVersion,
          allowedTools: e.data.allowedTools,
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