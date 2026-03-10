/**
 * Agent Runner Utility
 * 
 * Executes real Copilot agent sessions for integration testing.
 * Adapted from the project's existing runner.ts pattern.
 * 
 * Prerequisites:
 * - Install Copilot CLI: npm install -g @github/copilot-cli
 * - Login: Run `copilot` and follow prompts to authenticate
 * 
 * Security Note: The config.setup callback receives the workspace path
 * and executes with full process permissions. Only use with trusted test code.
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { fileURLToPath } from "url";
import { type CopilotSession, CopilotClient, type SessionEvent, approveAll } from "@github/copilot-sdk";
import { redactSecrets } from "./redact";
import { listSkills } from "./skill-loader";

// Re-export for backward compatibility (consumers still import from agent-runner)
export { getAllAssistantMessages } from "./evaluate";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Resolve the bundled Copilot CLI entry point.
 *
 * The SDK's default `getBundledCliPath()` uses `import.meta.resolve()`, which
 * is not available inside Jest's ESM VM context (even with
 * `--experimental-vm-modules`). We replicate the same path arithmetic here
 * using a plain `path.resolve` from `node_modules` so it works everywhere.
 */
function getBundledCliPath(): string {
  return path.resolve(__dirname, "../node_modules/@github/copilot/index.js");
}

interface TokenUsage {
  /** Total input tokens across all LLM calls */
  inputTokens: number;
  /** Total output tokens across all LLM calls */
  outputTokens: number;
  /** Total cache read tokens */
  cacheReadTokens: number;
  /** Total cache write tokens */
  cacheWriteTokens: number;
  /** Total API duration in milliseconds */
  totalApiDurationMs: number;
  /** Number of LLM API calls made */
  apiCallCount: number;
  /** Model used */
  model: string;
  /** Per-call breakdown */
  perCallUsage: Array<{
    model: string;
    inputTokens: number;
    outputTokens: number;
    durationMs: number;
    initiator?: string;
  }>;
}

export interface AgentMetadata {
  /**
   * Events emitted by the Copilot SDK agent during the agent run.
   */
  events: SessionEvent[];

  /**
   * Comments made by the test author.
   * These comments will be added to the agentMetadata markdown for an LLM or human reviewer to read.
   */
  testComments: string[];

  /**
   * Token usage and cost data extracted from assistant.usage and session.shutdown events.
   */
  tokenUsage?: TokenUsage;
}

/**
 * A unique identifier to use for the test run name.
 * By default, reports for each test run will be written to a pseudo-unique directory under "reports/test-run-{timestamp}/".
 * If {@link testRunId} is non-empty, reports for this test run will be written to a directory under "reports/test-run-{testRunId}/".
 * This allows reports from multiple test runs to be written to the same directory.
 *
 * Only applicable when the agent run is for a test.
 */
const testRunId = process.env.TEST_RUN_ID;

/**
 * The model to use for the agent run.
 */
const modelOverride = process.env.MODEL_OVERRIDE?.trim();

export interface AgentRunConfig {
  setup?: (workspace: string) => Promise<void>;
  prompt: string;
  shouldEarlyTerminate?: (metadata: AgentMetadata) => boolean;
  nonInteractive?: boolean;
  followUp?: string[];
  systemPrompt?: {
    mode: "append" | "replace",
    content: string
  };
  preserveWorkspace?: boolean;

  /**
   * Skills to include for the agent run.
   * If undefined, all the skills in azure plugin will be included.
   */
  includeSkills?: string[];
}

interface KeywordOptions {
  caseSensitive?: boolean;
}

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
 * Generate a markdown report from agent metadata
 */
function generateMarkdownReport(config: AgentRunConfig, agentMetadata: AgentMetadata): string {
  const lines: string[] = [];

  // Comment by the test author in test code
  if (agentMetadata.testComments.length > 0) {
    lines.push("# Test comments");
    lines.push("");
    lines.push(agentMetadata.testComments.join("\n"));
    lines.push("");
  }

  // User Prompt section
  lines.push("# User Prompt");
  lines.push("");
  lines.push(config.prompt);
  lines.push("");

  // Token usage summary
  if (agentMetadata.tokenUsage && agentMetadata.tokenUsage.apiCallCount > 0) {
    const t = agentMetadata.tokenUsage;
    lines.push("# Token Usage");
    lines.push("");
    lines.push("| Metric | Value |");
    lines.push("|--------|-------|");
    lines.push(`| Model | ${t.model} |`);
    lines.push(`| Input Tokens | ${t.inputTokens.toLocaleString()} |`);
    lines.push(`| Output Tokens | ${t.outputTokens.toLocaleString()} |`);
    lines.push(`| Cache Read | ${t.cacheReadTokens.toLocaleString()} |`);
    lines.push(`| Cache Write | ${t.cacheWriteTokens.toLocaleString()} |`);
    lines.push(`| API Calls | ${t.apiCallCount} |`);
    lines.push(`| API Duration | ${(t.totalApiDurationMs / 1000).toFixed(1)}s |`);
    lines.push("");
  }

  // Process events in chronological order
  lines.push("# Assistant");
  lines.push("");

  // Track message deltas to reconstruct full messages
  const messageDeltas: Record<string, string> = {};
  const reasoningDeltas: Record<string, string> = {};
  const toolResults: Record<string, { success: boolean; content?: string; error?: string }> = {};

  // First pass: collect all tool results
  for (const event of agentMetadata.events) {
    if (event.type === "tool.execution_complete") {
      const toolCallId = event.data.toolCallId as string;
      const result = event.data.result as { content?: string } | undefined;
      const error = event.data.error as { message?: string } | undefined;
      toolResults[toolCallId] = {
        success: event.data.success as boolean,
        content: result?.content,
        error: error?.message
      };
    }
  }

  // Second pass: generate output in order
  for (const event of agentMetadata.events) {
    switch (event.type) {
      case "assistant.message": {
        const content = event.data.content as string;
        if (content) {
          lines.push(content);
          lines.push("");
        }
        break;
      }

      case "assistant.message_delta": {
        // Accumulate deltas for streaming - we'll use the final message instead
        const messageId = event.data.messageId as string;
        const deltaContent = event.data.deltaContent as string;
        if (messageId && deltaContent) {
          messageDeltas[messageId] = (messageDeltas[messageId] || "") + deltaContent;
        }
        break;
      }

      case "assistant.reasoning": {
        const content = event.data.content as string;
        if (content) {
          lines.push("> **Reasoning:**");
          lines.push("> " + content.split("\n").join("\n> "));
          lines.push("");
        }
        break;
      }

      case "assistant.reasoning_delta": {
        // Accumulate reasoning deltas
        const reasoningId = event.data.reasoningId as string;
        const deltaContent = event.data.deltaContent as string;
        if (reasoningId && deltaContent) {
          reasoningDeltas[reasoningId] = (reasoningDeltas[reasoningId] || "") + deltaContent;
        }
        break;
      }

      case "tool.execution_start": {
        const toolName = event.data.toolName as string;
        const toolCallId = event.data.toolCallId as string;
        const args = event.data.arguments;

        // Check if this is a skill invocation
        if (toolName === "skill") {
          const argsStr = JSON.stringify(args);
          // Extract skill name from arguments
          const skillMatch = argsStr.match(/"skill"\s*:\s*"([^"]+)"/);
          const skillName = skillMatch ? skillMatch[1] : "unknown";
          lines.push("```");
          lines.push(`skill: ${skillName}`);
          lines.push("```");
        } else {
          // Regular tool call
          let argsJson: string;
          try {
            argsJson = JSON.stringify(args, null, 2);
          } catch {
            argsJson = String(args);
          }
          lines.push("```");
          lines.push(`tool: ${toolName}`);
          lines.push(`arguments: ${argsJson}`);

          // Add tool response if available
          const result = toolResults[toolCallId];
          if (result) {
            if (result.success && result.content) {
              let content = result.content;
              if (content.length > 500) {
                content = content.substring(0, 500) + "... (truncated)";
              }
              lines.push(`response: ${content}`);
            } else if (!result.success && result.error) {
              let error = result.error;
              if (error.length > 500) {
                error = error.substring(0, 500) + "... (truncated)";
              }
              lines.push(`error: ${error}`);
            }
          }
          lines.push("```");
        }
        lines.push("");
        break;
      }

      case "subagent.started": {
        const agentName = event.data.agentName as string;
        const agentDisplayName = event.data.agentDisplayName as string;
        lines.push("```");
        lines.push(`subagent.started: ${agentDisplayName || agentName}`);
        lines.push("```");
        lines.push("");
        break;
      }

      case "subagent.completed": {
        const agentName = event.data.agentName as string;
        lines.push("```");
        lines.push(`subagent.completed: ${agentName}`);
        lines.push("```");
        lines.push("");
        break;
      }

      case "subagent.failed": {
        const agentName = event.data.agentName as string;
        const error = event.data.error as string;
        let errorMsg = error || "unknown error";
        if (errorMsg.length > 500) {
          errorMsg = errorMsg.substring(0, 500) + "... (truncated)";
        }
        lines.push("```");
        lines.push(`subagent.failed: ${agentName}`);
        lines.push(`error: ${errorMsg}`);
        lines.push("```");
        lines.push("");
        break;
      }

      case "session.error": {
        const message = event.data.message as string;
        const errorType = event.data.errorType as string;
        lines.push("```");
        lines.push(`session.error: ${errorType || "unknown"}`);
        lines.push(`message: ${message || "unknown error"}`);
        lines.push("```");
        lines.push("");
        break;
      }
    }
  }

  return lines.join("\n");
}

/**
 * Write markdown report to file
 */
function writeMarkdownReport(config: AgentRunConfig, agentMetadata: AgentMetadata): void {
  try {
    const filePath = buildShareFilePath();
    const dir = path.dirname(filePath);

    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const markdown = redactSecrets(generateMarkdownReport(config, agentMetadata));
    if (fs.existsSync(filePath)) {
      let suffix = 1;
      let filePathWithSuffix = filePath.replace(".md", `-${suffix}.md`);
      while (fs.existsSync(filePathWithSuffix)) {
        suffix += 1;
        filePathWithSuffix = filePath.replace(".md", `-${suffix}.md`);
      }
      fs.writeFileSync(filePathWithSuffix, markdown, "utf-8");
    } else {
      fs.writeFileSync(filePath, markdown, "utf-8");
    }

    // Write structured agent-metadata.json for machine consumption
    const jsonPath = path.join(dir, "agent-metadata.json");
    const jsonData = {
      prompt: config.prompt || "",
      events: agentMetadata.events,
      testComments: agentMetadata.testComments,
      tokenUsage: agentMetadata.tokenUsage,
    };
    fs.writeFileSync(jsonPath, redactSecrets(JSON.stringify(jsonData, null, 2)), "utf-8");

    if (process.env.DEBUG) {
      console.log(`Markdown report written to: ${filePath}`);
    }

    // Write token usage JSON alongside the markdown report
    if (agentMetadata.tokenUsage && agentMetadata.tokenUsage.apiCallCount > 0) {
      writeTokenUsageJson(config, agentMetadata, dir);
    }
  } catch (error) {
    // Don't fail the test if report generation fails
    if (process.env.DEBUG) {
      console.error("Failed to write markdown report:", error);
    }
  }
}

/**
 * Write token usage data to a JSON file for dashboard consumption.
 * Also appends to a consolidated token-summary.json in the reports root.
 */
function writeTokenUsageJson(config: AgentRunConfig, agentMetadata: AgentMetadata, reportDir: string): void {
  try {
    const usage = agentMetadata.tokenUsage!;
    const testName = getTestName();
    const record = {
      testName,
      prompt: config.prompt ? redactSecrets(config.prompt) : config.prompt,
      timestamp: new Date().toISOString(),
      model: usage.model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cacheReadTokens: usage.cacheReadTokens,
      cacheWriteTokens: usage.cacheWriteTokens,
      totalApiDurationMs: usage.totalApiDurationMs,
      apiCallCount: usage.apiCallCount,
      perCallUsage: usage.perCallUsage,
    };

    // Write per-test token JSON
    const tokenFile = path.join(reportDir, "token-usage.json");
    fs.writeFileSync(tokenFile, JSON.stringify(record, null, 2), "utf-8");

    // Append to consolidated summary at reports root (JSONL for safe concurrent writes)
    const testRunDirectoryName = `test-run-${testRunId || TIME_STAMP}`;
    const summaryFile = path.join(DEFAULT_REPORT_DIR, testRunDirectoryName, "token-summary.jsonl");
    fs.appendFileSync(summaryFile, JSON.stringify(record) + "\n", "utf-8");

    if (process.env.DEBUG) {
      console.log(`Token usage written to: ${tokenFile}`);
    }
  } catch (error) {
    if (process.env.DEBUG) {
      console.error("Failed to write token usage JSON:", error);
    }
  }
}

/**
 * Sets up the agent runner with proper per-test cleanup via afterEach.
 * Call once inside each describe() block. Each describe() gets its own
 * isolated cleanup scope via closure, so parallel file execution is safe.
 *
 * Usage:
 *   describe("my suite", () => {
 *     const agent = useAgentRunner();
 *     it("test", async () => {
 *       const metadata = await agent.run({ prompt: "..." });
 *     });
 *   });
 */
export function useAgentRunner() {
  let currentCleanups: RunnerCleanup[] = [];

  async function cleanup(): Promise<void> {
    for (const entry of currentCleanups) {
      try {
        if (entry.session) {
          await entry.session.destroy();
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

  async function createMarkdownReport(): Promise<void> {
    for (const entry of currentCleanups) {
      try {
        if (isTest() && entry.config && entry.agentMetadata) {
          writeMarkdownReport(entry.config, entry.agentMetadata);
        }
      } catch { /* ignore */ }
    }
  }

  if (isTest()) {
    // Guarantees cleanup even if it times out in a test.
    // No harm in running twice if the test also calls cleanup.
    afterEach(async () => {
      await createMarkdownReport();
      await cleanup();
    });
  }

  async function run(config: AgentRunConfig): Promise<AgentMetadata> {
    const testWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "skill-test-"));
    const FOLLOW_UP_TIMEOUT = 1800000; // 30 minutes

    let isComplete = false;

    const entry: RunnerCleanup = { config };
    currentCleanups.push(entry);
    entry.workspace = testWorkspace;
    entry.preserveWorkspace = config.preserveWorkspace;

    try {
      // Run optional setup
      if (config.setup) {
        await config.setup(testWorkspace);
      }

      // Copilot client with yolo mode
      const cliArgs: string[] = config.nonInteractive ? ["--yolo"] : [];
      if (process.env.DEBUG && isTest()) {
        cliArgs.push("--log-dir");
        cliArgs.push(buildLogFilePath());
      }

      const client = new CopilotClient({
        logLevel: process.env.DEBUG ? "all" : "error",
        cwd: testWorkspace,
        cliArgs: cliArgs,
        cliPath: getBundledCliPath(),
        env: {
          ...process.env,
          SKILLS_INSTRUCTIONS: "true"
        }
      }) as CopilotClient;
      entry.client = client;

      const skillDirectory = path.resolve(__dirname, "../../plugin/skills");

      let disabledSkills: string[] | undefined;
      if (config.includeSkills) {
        const skills = listSkills();
        if (config.includeSkills.some((skillName) => !skills.includes(skillName))) {
          const invalidSkills = config.includeSkills.filter((skillName) => !skills.includes(skillName));
          throw new Error(`Invalid includeSkills. ${invalidSkills} are not valid skills.`);
        }
        disabledSkills = skills.filter((skillName) => !config.includeSkills?.includes(skillName));
      }

      const session = await client.createSession({
        model: modelOverride || "claude-sonnet-4.5",
        onPermissionRequest: approveAll,
        skillDirectories: [skillDirectory],
        disabledSkills: disabledSkills,
        mcpServers: {
          azure: {
            type: "stdio",
            command: "npx",
            args: ["-y", "@azure/mcp", "server", "start"],
            tools: ["*"]
          }
        },
        systemMessage: config.systemPrompt
      });
      entry.session = session;

      const agentMetadata: AgentMetadata = { events: [], testComments: [] };
      entry.agentMetadata = agentMetadata;

      const done = new Promise<void>((resolve) => {
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

          if (config.shouldEarlyTerminate?.(agentMetadata)) {
            isComplete = true;
            resolve();
            void session.abort();
            return;
          }
        });
      });

      await session.send({ prompt: config.prompt });
      await done;

      // Extract token usage from assistant.usage events
      const tokenUsage: TokenUsage = {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalApiDurationMs: 0,
        apiCallCount: 0,
        model: modelOverride || "claude-sonnet-4.5",
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
              tokenUsage.inputTokens = metrics.usage.inputTokens;
              tokenUsage.outputTokens = metrics.usage.outputTokens;
              tokenUsage.cacheReadTokens = metrics.usage.cacheReadTokens;
              tokenUsage.cacheWriteTokens = metrics.usage.cacheWriteTokens;
              tokenUsage.apiCallCount = metrics.requests.count;
            }
          }
        }
      }

      agentMetadata.tokenUsage = tokenUsage;

      // Log token usage summary
      if (tokenUsage.apiCallCount > 0) {
        console.log(
          `\n📊 Token Usage: ${tokenUsage.inputTokens.toLocaleString()} in / ${tokenUsage.outputTokens.toLocaleString()} out | ` +
          `${tokenUsage.apiCallCount} API calls | ` +
          `Duration: ${(tokenUsage.totalApiDurationMs / 1000).toFixed(1)}s\n`
        );
      }

      // Send follow-up prompts
      for (const followUpPrompt of config.followUp ?? []) {
        isComplete = false;
        await session.sendAndWait({ prompt: followUpPrompt }, FOLLOW_UP_TIMEOUT);
      }

      return agentMetadata;
    } catch (error) {
      // Mark as complete to stop event processing
      isComplete = true;
      console.error("Agent runner error:", error);
      throw error;
    } finally {
      if (!isTest()) {
        await cleanup();
      }
    }
  }

  return { run };
}

/**
 * Check if all tool calls for a given tool were successful
 */
export function areToolCallsSuccess(agentMetadata: AgentMetadata, toolName?: string): boolean {
  let executionStartEvents = agentMetadata.events
    .filter(event => event.type === "tool.execution_start");

  if (toolName) {
    executionStartEvents = executionStartEvents
      .filter(event => event.data.toolName === toolName);
  }

  const executionCompleteEvents = agentMetadata.events
    .filter(event => event.type === "tool.execution_complete");

  return executionStartEvents.length > 0 && executionStartEvents.every(startEvent => {
    const toolCallId = startEvent.data.toolCallId;
    return executionCompleteEvents.some(
      completeEvent => completeEvent.data.toolCallId === toolCallId && completeEvent.data.success
    );
  });
}

/**
 * Check if assistant messages contain a keyword
 */
export function doesAssistantMessageIncludeKeyword(
  agentMetadata: AgentMetadata,
  keyword: string,
  options: KeywordOptions = {}
): boolean {
  // Merge all messages and message deltas
  const allMessages: Record<string, string> = {};

  agentMetadata.events.forEach(event => {
    if (event.type === "assistant.message" && event.data.messageId && event.data.content) {
      allMessages[event.data.messageId] = event.data.content;
    }
    if (event.type === "assistant.message_delta" && event.data.messageId) {
      if (allMessages[event.data.messageId]) {
        allMessages[event.data.messageId] += event.data.deltaContent ?? "";
      } else {
        allMessages[event.data.messageId] = event.data.deltaContent ?? "";
      }
    }
  });

  return Object.values(allMessages).some(message => {
    if (options.caseSensitive) {
      return message.includes(keyword);
    }
    return message.toLowerCase().includes(keyword.toLowerCase());
  });
}

// Track skip reason for reporting
let integrationSkipReason: string | undefined;

/**
 * Check if integration tests should be skipped
 * 
 * Integration tests are skipped when:
 * - SKIP_INTEGRATION_TESTS=true is set
 * - @github/copilot-sdk is not installed
 */
export function shouldSkipIntegrationTests(): boolean {
  // Skip if explicitly requested
  if (process.env.SKIP_INTEGRATION_TESTS === "true") {
    integrationSkipReason = "SKIP_INTEGRATION_TESTS=true";
    return true;
  }

  // Check if SDK package exists
  try {
    const sdkPath = path.join(__dirname, "..", "node_modules", "@github", "copilot-sdk", "package.json");
    if (!fs.existsSync(sdkPath)) {
      integrationSkipReason = "@github/copilot-sdk not installed";
      return true;
    }
  } catch {
    integrationSkipReason = "@github/copilot-sdk not installed";
    return true;
  }

  return false;
}

/**
 * Get the reason why integration tests are being skipped
 */
export function getIntegrationSkipReason(): string | undefined {
  return integrationSkipReason;
}

const DEFAULT_REPORT_DIR = path.join(__dirname, "..", "reports");
const TIME_STAMP = (process.env.START_TIMESTAMP || new Date().toISOString()).replace(/[:.]/g, "-");

function buildShareFilePath(): string {
  const testRunDirectoryName = `test-run-${testRunId || TIME_STAMP}`;
  return path.join(DEFAULT_REPORT_DIR, testRunDirectoryName, getTestName(), `agent-metadata-${new Date().toISOString().replace(/[:.]/g, "-")}.md`);
}

function buildLogFilePath(): string {
  const testRunDirectoryName = `test-run-${testRunId || TIME_STAMP}`;
  return path.join(DEFAULT_REPORT_DIR, testRunDirectoryName, getTestName());
}

function isTest(): boolean {
  try {
    // Jest provides expect.getState() with current test info
    const _state = expect.getState();
    return true;
  } catch {
    return false;
  }
}

function getTestName(): string {
  try {
    // Jest provides expect.getState() with current test info
    const state = expect.getState();
    const testName = state.currentTestName ?? "unknown-test";
    // Sanitize for use as filename
    return sanitizeFileName(testName);
  } catch {
    // Fallback if not running in Jest context
    return `test-${Date.now()}`;
  }
}

/**
 * Sanitize a string for use as a filename
 */
function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, "-") // Replace invalid chars
    .replace(/\s+/g, "_")           // Replace spaces with underscores
    .replace(/-+/g, "-")            // Collapse multiple dashes
    .replace(/_+/g, "_")            // Collapse multiple underscores
    .substring(0, 200);             // Limit length
}
