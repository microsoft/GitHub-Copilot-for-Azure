import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { type CopilotSession, CopilotClient, type SessionEvent, RuntimeConnection, approveAll } from "@github/copilot-sdk";
import { DEFAULT_SKILL_CHAR_BUDGET, getSkillsForTest } from "./skill-loader.ts";
import { type AgentRunnerConfig, computeToolAndSkillStats, takeScreenshot, type AgentMetadata, type AgentRunConfig, type IAgentRunner, type TokenUsage } from "./agent-runner.ts";

// Re-export for backward compatibility (consumers still import from copilot-sdk-runner)
export { getAllAssistantMessages } from "./evaluate.ts";

/**
 * The model to use for the agent run.
 */
const modelOverride = process.env.MODEL_OVERRIDE?.trim();

const PER_TURN_TIMEOUT = 1800000; // 30 minutes

/** Tracks resources that need cleanup after each test */
interface RunnerCleanup {
  session?: CopilotSession;
  client?: CopilotClient;
  workspace?: string;
  preserveWorkspace?: boolean;
  config?: AgentRunConfig;
  agentMetadata?: AgentMetadata;
}

/**
 * Sets up the agent runner with proper per-test cleanup via afterEach.
 * Call once inside each describe() block. Each describe() gets its own
 * isolated cleanup scope via closure, so parallel file execution is safe.
 */
export function useAgentRunner(agentRunnerConfig: AgentRunnerConfig): IAgentRunner {
  let currentCleanups: RunnerCleanup[] = [];
  const config = agentRunnerConfig;

  async function cleanup(): Promise<void> {
    for (const entry of currentCleanups) {
      try {
        if (entry.session) {
          await entry.session.disconnect();
        }
      } catch { /* ignore */ }
      try {
        if (entry.client) {
          await entry.client.stop();
        }
      } catch { /* ignore */ }
      try {
        if (entry.workspace && !entry.preserveWorkspace) {
          fs.rmSync(entry.workspace, { recursive: true, force: true });
        }
      } catch { /* ignore */ }
    }
    currentCleanups = [];
  }

  function getTestName(): string {
    return config.testName ?? "unknown";
  }

  async function run(runConfig: AgentRunConfig): Promise<AgentMetadata> {
    let testWorkspace: string;
    if (runConfig.workspace) {
      testWorkspace = runConfig.workspace;
    } else {
      testWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "skill-test-"));
    }

    let isComplete = false;
    let isAborted = false;

    const entry: RunnerCleanup = { config: runConfig };
    currentCleanups.push(entry);
    entry.workspace = testWorkspace;
    entry.preserveWorkspace = runConfig.preserveWorkspace;

    const agentMetadata: AgentMetadata = { events: [], testComments: [], turnCount: 0, toolCounts: {}, skillFiles: {}, skillsLoaded: [] };
    entry.agentMetadata = agentMetadata;

    try {
      // Run optional setup
      if (runConfig.setup) {
        await runConfig.setup(testWorkspace);
      }

      // Copilot client with yolo mode
      const cliArgs: string[] = ["--yolo"];

      // Copilot CLI emits lots of warnings about experimental features which clutters the console output so we suppress them.
      const existingNodeOptions = process.env.NODE_OPTIONS;
      const envVar: Record<string, string> = {
        SKILLS_INSTRUCTIONS: "true",
        SKILL_CHAR_BUDGET: `${DEFAULT_SKILL_CHAR_BUDGET}`,
        NODE_OPTIONS: existingNodeOptions
          ? `${existingNodeOptions} --disable-warning=ExperimentalWarning`
          : "--disable-warning=ExperimentalWarning"
      };

      const client = new CopilotClient({
        logLevel: process.env.DEBUG ? "all" : "error",
        workingDirectory: testWorkspace,
        connection: RuntimeConnection.forStdio({ args: cliArgs }),
        env: {
          ...process.env,
          ...envVar,
          ...runConfig.env
        }
      }) as CopilotClient;
      entry.client = client;

      const { skillsLoaded, skillDirectories, disabledSkills } = await getSkillsForTest(
        runConfig.requiredSkills,
        runConfig.includeSkills
      );
      agentMetadata.skillsLoaded = skillsLoaded;

      const disableAzureMcp = process.env.VALLY_RUNNER_DISABLE_AZURE_MCP === "true";
      const model = runConfig.model ?? modelOverride ?? "claude-sonnet-5";
      const session = await client.createSession({
        model: model,
        onPermissionRequest: approveAll,
        skillDirectories: skillDirectories,
        disabledSkills: disabledSkills?.map(s => s.name),
        ...(disableAzureMcp ? {} : {
          mcpServers: {
            azure: {
              type: "stdio",
              command: "npx",
              args: ["-y", "@azure/mcp", "server", "start"],
              tools: ["*"]
            }
          }
        }),
        systemMessage: runConfig.systemPrompt,
        // Disable session telemetry so usage of skills and tools by the test agent runner don't end up sending Copilot CLI telemetry.
        enableSessionTelemetry: false
      });
      entry.session = session;

      const startTime = new Date().getTime();
      const done = new Promise<void>((resolve) => {
        // Global timeout for the entire run, including all turns
        if (runConfig.timeout !== undefined) {
          const timeoutTimer = setTimeout(async () => {
            if (!isComplete) {
              isComplete = true;
              isAborted = true;
              const currentTime = new Date().getTime();
              agentMetadata.testComments.push(
                `⚠️ Run aborted: run time (${currentTime - startTime} ms) exceeded timeout (${runConfig.timeout} ms).`
              );
              try {
                await session.abort();
              } catch (error) {
                console.error(`session.abort failed ${error instanceof Error ? error.message : String(error)}`);
              } finally {
                resolve();
              }
            }
          }, runConfig.timeout);
          timeoutTimer.unref();
        }
        session.on(async (event: SessionEvent) => {
          if (isComplete) return;

          if (process.env.DEBUG) {
            console.log(`=== session event ${event.type}`);
          }

          if (event.type === "session.idle") {
            isComplete = true;
            resolve();
            return;
          }

          agentMetadata.events.push(event);

          if (event.type === "assistant.turn_start") {
            agentMetadata.turnCount++;
            if (runConfig.maxTurns !== undefined && agentMetadata.turnCount > runConfig.maxTurns) {
              agentMetadata.testComments.push(
                `⚠️ Run aborted: turn count (${agentMetadata.turnCount}) exceeded maxTurns (${runConfig.maxTurns}).`
              );
              isComplete = true;
              isAborted = true;
              try {
                await session.abort();
              } catch (error) {
                console.error(`session.abort failed ${error instanceof Error ? error.message : String(error)}`);
              } finally {
                resolve();
              }
              return;
            }
          }

          if (runConfig.shouldEarlyTerminate?.(agentMetadata)) {
            isComplete = true;
            isAborted = true;
            try {
              await session.abort();
            } catch (error) {
              console.error(`session.abort failed ${error instanceof Error ? error.message : String(error)}`);
            } finally {
              resolve();
            }
            return;
          }
        });
      });

      await session.send({ prompt: runConfig.prompt });
      await done;

      // Send follow-up prompts before aggregating stats so tool/skill/token
      // counts include events emitted during follow-up turns.
      // Skip follow-ups when the run was aborted.
      for (const followUpPrompt of (runConfig.followUp ?? [])) {
        if (isAborted) break;
        isComplete = false;
        await session.sendAndWait({ prompt: followUpPrompt }, PER_TURN_TIMEOUT);
      }

      // Extract token usage from assistant.usage events
      const tokenUsage: TokenUsage = {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalApiDurationMs: 0,
        apiCallCount: 0,
        model: model,
        perCallUsage: [],
      };

      for (const event of agentMetadata.events) {
        if (event.type === "assistant.usage") {
          tokenUsage.inputTokens += event.data.inputTokens ?? 0;
          tokenUsage.outputTokens += event.data.outputTokens ?? 0;
          tokenUsage.cacheReadTokens += event.data.cacheReadTokens ?? 0;
          tokenUsage.cacheWriteTokens += event.data.cacheWriteTokens ?? 0;
          tokenUsage.totalApiDurationMs += event.data.duration ?? 0;
          tokenUsage.apiCallCount++;
          tokenUsage.model = event.data.model || tokenUsage.model;
          tokenUsage.perCallUsage.push({
            model: event.data.model,
            inputTokens: event.data.inputTokens ?? 0,
            outputTokens: event.data.outputTokens ?? 0,
            durationMs: event.data.duration ?? 0,
            initiator: event.data.initiator,
          });
        }
        // Also capture aggregate from session.shutdown if available
        if (event.type === "session.shutdown" && event.data.modelMetrics) {
          for (const [model, metrics] of Object.entries(event.data.modelMetrics)) {
            tokenUsage.model = model;
            // Prefer shutdown totals if usage events were missed
            if (tokenUsage.apiCallCount === 0) {
              tokenUsage.inputTokens = metrics?.usage.inputTokens ?? 0;
              tokenUsage.outputTokens = metrics?.usage.outputTokens ?? 0;
              tokenUsage.cacheReadTokens = metrics?.usage.cacheReadTokens ?? 0;
              tokenUsage.cacheWriteTokens = metrics?.usage.cacheWriteTokens ?? 0;
              tokenUsage.apiCallCount = metrics?.requests.count ?? 0;
            }
          }
        }
      }

      agentMetadata.tokenUsage = tokenUsage;

      // Aggregate tool invocation counts and skill-file reads
      const { toolCounts, skillFiles } = computeToolAndSkillStats(agentMetadata.events, skillDirectories);
      agentMetadata.toolCounts = toolCounts;
      agentMetadata.skillFiles = skillFiles;

      if (runConfig.takeScreenshot && runConfig.takeScreenshot.predicate(agentMetadata)) {
        await takeScreenshot(client, session.sessionId, getTestName(), agentMetadata);
      }

      return agentMetadata;
    } catch (error) {
      // Mark as complete to stop event processing
      isComplete = true;
      const errorDetails = error instanceof Error
        ? (error.message)
        : String(error);
      agentMetadata.testComments.push(`❗️Agent runner error: ${errorDetails}`);
      console.error("Agent runner error:", errorDetails);
      throw error;
    } finally {
      await cleanup();
    }
  }

  return { run, cleanup };
}
