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
import { type CopilotSession, CopilotClient, type SessionEvent, approveAll, type SystemMessageConfig, RuntimeConnection } from "@github/copilot-sdk";
import { redactSecrets } from "./redact.ts";
import { listSkills } from "./skill-loader.ts";
import { DEFAULT_SKILL_CHAR_BUDGET, truncateSkills } from "./char-budget.ts";

// Re-export for backward compatibility (consumers still import from agent-runner)
export { getAllAssistantMessages } from "./evaluate.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Resolve the bundled Copilot CLI entry point.
 *
 * The SDK's default `getBundledCliPath()` uses `import.meta.resolve()`, which
 * is not available inside Jest's ESM VM context (even with
 * `--experimental-vm-modules`). We replicate the same path arithmetic here
 * using a plain `path.resolve` from `node_modules` so it works everywhere.
 *
 * Rather than hard-coding the entry filename, we read the package's `bin`
 * field so we stay resilient to upstream renames (e.g. `index.js` →
 * `npm-loader.js` in @github/copilot@1.0.67). We fall back to the known
 * filenames if the manifest cannot be read.
 */
function getBundledCliPath(): string {
  const pkgDir = path.resolve(__dirname, "../node_modules/@github/copilot");

  const candidates: string[] = [];
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(pkgDir, "package.json"), "utf8")
    ) as { bin?: string | Record<string, string> };
    const bin = typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.copilot;
    if (bin) {
      candidates.push(bin);
    }
  } catch {
    // Fall through to the well-known filenames below.
  }
  candidates.push("npm-loader.js", "index.js");

  for (const candidate of candidates) {
    const candidatePath = path.resolve(pkgDir, candidate);
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  // Last resort: return the conventional path so the caller surfaces a clear
  // spawn error instead of a silent undefined.
  return path.resolve(pkgDir, "npm-loader.js");
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

  /**
   * Number of assistant turns that started during the run,
   * counted from `assistant.turn_start` events.
   */
  turnCount: number;

  /**
   * Map from tool name to the number of times that tool was invoked during the run.
   * Excludes the `skill` pseudo-tool; all other tools (including MCP tools) are included,
   * keyed by the raw `event.data.toolName`.
   */
  toolCounts: Record<string, number>;

  /**
   * Map from skill name to the sorted, deduped list of files under that skill's
   * directory (i.e., paths under `output/skills/<skillName>/`) that were referenced
   * by tool invocations during the run.
   * Populated from tool arguments that reference files in a skill directory, and may
   * also include a synthesized `SKILL.md` entry for `skill` tool calls.
   */
  skillFiles: Record<string, string[]>;
}

/**
 * A single tool invocation captured during an agent run, in emission order.
 * Includes the `skill` pseudo-tool so the full sequence can be reconstructed.
 */
export interface ToolCall {
  /** 0-based index over `tool.execution_start` events in emission order. */
  order: number;
  /** Raw `event.data.toolName` (e.g. "skill", "bash", an MCP tool name). */
  toolName: string;
  /** Correlates the start event to its `tool.execution_complete`. */
  toolCallId: string;
  /** Full tool arguments, secret-redacted on write, untruncated. */
  arguments: unknown;
  /**
   * Success of the matching `tool.execution_complete`, or `null` when no
   * completion event was observed for this call.
   */
  success: boolean | null;
  /**
   * Wall-clock duration in milliseconds, computed from the start and matching
   * completion event timestamps, or `null` when no completion was observed.
   */
  durationMs: number | null;
  /**
   * UTF-8 byte size of the tool's full textual output (`detailedContent`,
   * falling back to `content`, then to text/terminal result blocks). Binary
   * blocks (image/audio) are excluded. `null` when no completion was observed.
   */
  outputBytes: number | null;
}

/**
 * Structured, per-run record of the tools called during a single agent run.
 * Written alongside (and named to match) that run's markdown report so the tool
 * sequence for a specific run can be reconstructed even when the same stimulus
 * runs multiple times in the same test-case directory.
 */
export interface ToolUsageRecord {
  testName: string;
  /** Basename of this run's `agent-metadata-<token>.md` report (1:1 correlation). */
  reportFile: string;
  /** Session id from the `session.start` event, if present. */
  sessionId: string | null;
  model: string | undefined;
  /** ISO-8601 timestamp of when this file was written. */
  timestamp: string;
  toolCalls: ToolCall[];
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
  env?: Record<string, string>;
  model?: string;
  prompt: string;
  shouldEarlyTerminate?: (metadata: AgentMetadata) => boolean;
  nonInteractive?: boolean;
  followUp?: string[];
  systemPrompt?: SystemMessageConfig;

  /**
   * Optional. An absolute path to a directory.
   * if not specified, the agent will create a temporary directory and use it as the workspace.
   */
  workspace?: string;
  preserveWorkspace?: boolean;

  /**
   * Skills to include for the agent run.
   * If undefined, all the skills in azure plugin will be included.
   * If specified, only the skills in this array will be included. This option overrides the required skills specified in the {@link requiredSkills}.
   */
  includeSkills?: string[];

  /**
   * Maximum number of assistant turns allowed before the run is aborted.
   * Each `assistant.turn_start` event counts as one turn.
   * If undefined, there is no turn limit.
   */
  maxTurns?: number;

  /**
   * Number of milliseconds as timeout for follow ups.
   */
  followUpTimeout?: number;

  /**
   * Whether to take a screenshot of the application after the agent work.
   * The predicate function will be called with the agentMetadata. If the return value is true, the agent runner will attempt to take a screenshot of the app. Otherwise, no screenshot will be taken.
   * If undefined, the agent runner won't attempt to take a screenshot.
   */
  takeScreenshot?: {
    predicate: (agentMetadata: AgentMetadata) => boolean
  };

  /**
   * Skills that must be present with full description.
   * Skills other than the required ones will be randomly disabled until the estimated char count falls below the char count budget.
   */
  requiredSkills?: string[];
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
 * Extract file-system paths from the serialized arguments of a tool call that
 * reference the given `skillDirectory`. Checks common argument keys
 * (`filePath`, `path`, `file`, `uri`) and also scans the full serialized args
 * for any substring rooted at the skill directory. Returned paths are
 * normalized to forward slashes.
 */
function extractSkillDirPaths(args: unknown, skillDirectory: string): string[] {
  const normalizedDir = skillDirectory.replace(/\\/g, "/").replace(/\/+$/, "");
  const found = new Set<string>();

  let obj: Record<string, unknown> | undefined;
  if (args && typeof args === "object") {
    obj = args as Record<string, unknown>;
  } else if (typeof args === "string") {
    try {
      const parsed: unknown = JSON.parse(args);
      if (parsed && typeof parsed === "object") {
        obj = parsed as Record<string, unknown>;
      }
    } catch { /* ignore */ }
  }

  if (obj) {
    for (const key of ["filePath", "path", "file", "uri"]) {
      const v = obj[key];
      if (typeof v === "string" && v.length > 0) {
        const normalized = v.replace(/\\/g, "/");
        if (normalized.startsWith(normalizedDir + "/")) {
          found.add(normalized);
        }
      }
    }
  }

  // Fallback: scan serialized args for any occurrence of the skill directory
  let serialized: string;
  if (typeof args === "string") {
    serialized = args;
  } else {
    try {
      serialized = JSON.stringify(args ?? "");
    } catch {
      serialized = String(args ?? "");
    }
  }
  const normalizedSerialized = serialized.replace(/\\\\/g, "/").replace(/\\/g, "/");
  const needle = normalizedDir + "/";
  let searchFrom = 0;
  while (true) {
    const idx = normalizedSerialized.indexOf(needle, searchFrom);
    if (idx < 0) break;
    const tail = normalizedSerialized.slice(idx);
    const endMatch = tail.match(/^[^"',\s\\]+/);
    if (endMatch) found.add(endMatch[0]);
    searchFrom = idx + needle.length;
  }

  return Array.from(found);
}

/**
 * Compute aggregate tool invocation counts and per-skill file-read listings
 * from the ordered list of session events.
 *
 * - `toolCounts` keys are raw `event.data.toolName`, excluding the `skill` pseudo-tool.
 * - `skillFiles` is populated from any tool invocation whose arguments reference
 *   a path under the given skill directory (`output/skills/<skill>/...`).
 */
function computeToolAndSkillStats(
  events: SessionEvent[],
  skillDirectory: string
): { toolCounts: Record<string, number>; skillFiles: Record<string, string[]> } {
  const toolCounts: Record<string, number> = {};
  const skillFilesSet: Record<string, Set<string>> = {};

  const normalizedSkillDir = skillDirectory.replace(/\\/g, "/").replace(/\/+$/, "");

  for (const event of events) {
    if (event.type !== "tool.execution_start") continue;
    const toolName = event.data.toolName as string | undefined;
    if (!toolName) continue;

    if (toolName !== "skill") {
      toolCounts[toolName] = (toolCounts[toolName] ?? 0) + 1;
    } else {
      // The `skill` tool loads <skillDirectory>/<skillName>/SKILL.md internally
      // via the SDK; no path appears in tool arguments. Synthesize the entry so
      // SKILL.md is reflected in `skillFiles` for every invoked skill.
      const args: unknown = event.data.arguments;
      let skillName: string | undefined;
      if (args && typeof args === "object") {
        const v = (args as Record<string, unknown>).skill;
        if (typeof v === "string") skillName = v;
      } else if (typeof args === "string") {
        const stringArgs = args.trim();
        const m = stringArgs.match(/"skill"\s*:\s*"([^"]+)"/);
        if (m) {
          skillName = m[1];
        } else if (stringArgs) {
          skillName = stringArgs;
        }
      }
      if (skillName) {
        (skillFilesSet[skillName] ??= new Set()).add(`${normalizedSkillDir}/${skillName}/SKILL.md`);
      }
    }

    for (const filePath of extractSkillDirPaths(event.data.arguments, skillDirectory)) {
      const relative = filePath.slice(normalizedSkillDir.length + 1);
      const slashIdx = relative.indexOf("/");
      if (slashIdx <= 0) continue;
      const skillName = relative.slice(0, slashIdx);
      (skillFilesSet[skillName] ??= new Set()).add(filePath);
    }
  }

  const skillFiles: Record<string, string[]> = {};
  for (const skillName of Object.keys(skillFilesSet).sort()) {
    skillFiles[skillName] = Array.from(skillFilesSet[skillName]).sort();
  }

  return { toolCounts, skillFiles };
}

/**
 * Build the ordered list of tool calls for a single run from its session events.
 *
 * - One entry per `tool.execution_start` event, in emission order, including the
 *   `skill` pseudo-tool.
 * - `success` is resolved by joining each start to its `tool.execution_complete`
 *   by `toolCallId`; `null` when no completion event exists.
 */
export function computeToolUsage(events: SessionEvent[]): ToolCall[] {
  // First pass: success and completion timestamp by toolCallId from completion events.
  const successById = new Map<string, boolean>();
  const completeTimeById = new Map<string, string>();
  const outputBytesById = new Map<string, number | null>();
  for (const event of events) {
    if (event.type !== "tool.execution_complete") continue;
    const id = event.data.toolCallId as string | undefined;
    if (id !== undefined) {
      successById.set(id, Boolean(event.data.success));
      completeTimeById.set(id, event.timestamp);
      outputBytesById.set(id, computeOutputBytes(event.data.result));
    }
  }

  const toolCalls: ToolCall[] = [];
  for (const event of events) {
    if (event.type !== "tool.execution_start") continue;
    const toolName = event.data.toolName as string | undefined;
    const toolCallId = event.data.toolCallId as string | undefined;
    if (!toolName || toolCallId === undefined) continue;
    toolCalls.push({
      order: toolCalls.length,
      toolName,
      toolCallId,
      arguments: event.data.arguments ?? null,
      success: successById.has(toolCallId) ? successById.get(toolCallId)! : null,
      durationMs: computeDurationMs(event.timestamp, completeTimeById.get(toolCallId)),
      outputBytes: outputBytesById.has(toolCallId) ? outputBytesById.get(toolCallId)! : null,
    });
  }
  return toolCalls;
}

/**
 * UTF-8 byte size of a completion's full textual output. Prefers `detailedContent`,
 * falls back to `content`, then to concatenated text from text/terminal result
 * blocks. Binary blocks (image/audio) and resources are excluded. Returns `null`
 * when no textual output is present.
 */
function computeOutputBytes(
  result:
    | { content?: string; detailedContent?: string; contents?: unknown[] }
    | undefined,
): number | null {
  if (!result) return null;
  let text: string | undefined;
  if (typeof result.detailedContent === "string") {
    text = result.detailedContent;
  } else if (typeof result.content === "string") {
    text = result.content;
  } else if (Array.isArray(result.contents)) {
    const parts: string[] = [];
    for (const block of result.contents) {
      const blockText = (block as { text?: unknown }).text;
      if (typeof blockText === "string") parts.push(blockText);
    }
    text = parts.length > 0 ? parts.join("") : undefined;
  }
  if (text === undefined) return null;
  return Buffer.byteLength(text, "utf8");
}

/**
 * Wall-clock duration in milliseconds between a tool call's start and matching
 * completion timestamp. Returns `null` when the completion is missing or either
 * timestamp is unparseable, or when the result would be negative.
 */
function computeDurationMs(startTs: string, completeTs: string | undefined): number | null {
  if (!completeTs) return null;
  const start = Date.parse(startTs);
  const end = Date.parse(completeTs);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  const delta = end - start;
  return delta >= 0 ? delta : null;
}

/**
 * Derive the per-run tool-usage JSON path from a run's markdown report path,
 * so the two share the same `<token>` and correlate 1:1.
 * `.../agent-metadata-<token>.md` -> `.../tool-usage-<token>.json`
 */
export function deriveToolUsageFileName(reportFilePath: string): string {
  const dir = path.dirname(reportFilePath);
  const base = path
    .basename(reportFilePath)
    .replace(/^agent-metadata-/, "tool-usage-")
    .replace(/\.md$/, ".json");
  return path.join(dir, base);
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

  // Tool invocation counts (excludes the `skill` pseudo-tool)
  const toolCountEntries = Object.entries(agentMetadata.toolCounts ?? {});
  if (toolCountEntries.length > 0) {
    toolCountEntries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    lines.push("# Tool Counts");
    lines.push("");
    lines.push("| Tool | Count |");
    lines.push("|------|-------|");
    for (const [tool, count] of toolCountEntries) {
      lines.push(`| ${tool} | ${count} |`);
    }
    lines.push("");
  }

  // Files read from each invoked skill's directory
  const skillFileEntries = Object.entries(agentMetadata.skillFiles ?? {});
  if (skillFileEntries.length > 0) {
    skillFileEntries.sort((a, b) => a[0].localeCompare(b[0]));
    lines.push("# Skill Files Read");
    lines.push("");
    lines.push("| Skill | File |");
    lines.push("|-------|------|");
    for (const [skillName, files] of skillFileEntries) {
      for (const file of files) {
        lines.push(`| ${skillName} | ${file} |`);
      }
    }
    lines.push("");
  }

  // Process events in chronological order
  lines.push("# Assistant");
  lines.push("");

  // Track message deltas to reconstruct full messages
  const messageDeltas: Record<string, string> = {};
  const reasoningDeltas: Record<string, string> = {};
  const toolResults: Record<string, { success: boolean; timestamp: string; content?: string; error?: string; }> = {};

  // First pass: collect all tool results
  for (const event of agentMetadata.events) {
    if (event.type === "tool.execution_complete") {
      const toolCallId = event.data.toolCallId as string;
      const result = event.data.result as { content?: string } | undefined;
      const error = event.data.error as { message?: string } | undefined;
      toolResults[toolCallId] = {
        success: event.data.success as boolean,
        timestamp: event.timestamp,
        content: result?.content,
        error: error?.message
      };
    }
  }

  // Second pass: generate output in order
  for (const event of agentMetadata.events) {
    switch (event.type) {
      case "user.message": {
        const content = String(event.data.content ?? "");
        lines.push("> User:");
        lines.push("> " + content.split("\n").join("\n> "));
        lines.push("");
        break;
      }

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

      case "skill.invoked": {
        const skillName = event.data.name;
        lines.push("```");
        lines.push(`skill: ${skillName}`);
        lines.push("```");
        break;
      }

      case "tool.execution_start": {
        const toolName = event.data.toolName as string;
        const toolCallId = event.data.toolCallId as string;
        const args = event.data.arguments;

        // Exclude skill invocation call and log it on skill.invoked event.
        if (toolName !== "skill") {
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
            const durationSec = (new Date(result.timestamp).getTime() - new Date(event.timestamp).getTime()) / 1000;
            lines.push(`duration: ${durationSec.toFixed(3)} sec`);
            // Copilot SDK truncates the tool response if it's too long
            // Record the estimated token count for what it sends to the LLM
            lines.push(`estimated llm token count: ${((result?.content ?? result?.error)?.length ?? 0) / 4}`);
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

export type AgentRunnerConfig = {
  /**
   * If the runner is running for an integration test.
   */
  isTest: boolean;
  /**
   * If the runner is running in a jest environment.
   * Used for backward compatibility.
   * @todo: Remove this option after migrating all jest integration tests.
   */
  useJest: boolean;

  /**
   * Name of the test.
   * Only used when the runner is running for a test and isn't running in a jest environment.
   * @todo: Make this parameter required after migrating all jest integration tests.
   */
  testName?: string;
};

/**
 * Sets up the agent runner with proper per-test cleanup via afterEach.
 * Call once inside each describe() block. Each describe() gets its own
 * isolated cleanup scope via closure, so parallel file execution is safe.
 */
export function useAgentRunner(agentRunnerConfig: AgentRunnerConfig) {
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

  // @todo: Remove the code for jest tests.
  function useJest(): boolean {
    return config.useJest;
  }

  function isTest(): boolean {
    return config.isTest;
  }

  function getTestName(): string {
    // @todo: Remove the code for jest tests.
    if (config.useJest) {
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
    } else {
      return config.testName ?? "unknown";
    }
  }

  /**
   * @deprecated Migrate jest test cases to vally suites and stop using this function.
   * @todo: Remove the code for jest tests.
   */
  async function createMarkdownReportInternal(): Promise<void> {
    for (const entry of currentCleanups) {
      try {
        if (isTest() && useJest() && entry.config && entry.agentMetadata) {
          writeMarkdownReport(getTestName(), entry.config, entry.agentMetadata);
        }
      } catch { /* ignore */ }
    }
  }

  // @todo: Remove the code for jest tests.
  if (isTest() && useJest()) {
    // Guarantees cleanup even if it times out in a test.
    // No harm in running twice if the test also calls cleanup.
    afterEach(async () => {
      await createMarkdownReportInternal();
      await cleanup();
    });
  }

  async function run(runConfig: AgentRunConfig): Promise<AgentMetadata> {
    let testWorkspace: string;
    if (runConfig.workspace) {
      testWorkspace = runConfig.workspace;
    } else {
      testWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "skill-test-"));
    }
    const FOLLOW_UP_TIMEOUT = runConfig.followUpTimeout ?? 1800000; // 30 minutes by default

    let isComplete = false;
    let isAborted = false;

    const entry: RunnerCleanup = { config: runConfig };
    currentCleanups.push(entry);
    entry.workspace = testWorkspace;
    entry.preserveWorkspace = runConfig.preserveWorkspace;

    const agentMetadata: AgentMetadata = { events: [], testComments: [], turnCount: 0, toolCounts: {}, skillFiles: {} };
    entry.agentMetadata = agentMetadata;

    try {
      // Run optional setup
      if (runConfig.setup) {
        await runConfig.setup(testWorkspace);
      }

      // Copilot client with yolo mode
      const cliArgs: string[] = runConfig.nonInteractive ? ["--yolo"] : [];
      if (process.env.DEBUG && isTest()) {
        cliArgs.push("--log-dir");
        cliArgs.push(buildTestCaseDirPath(getTestName()));
      }

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
        connection: RuntimeConnection.forStdio({
          path: getBundledCliPath(),
          args: cliArgs
        }),
        env: {
          ...process.env,
          ...envVar,
          ...runConfig.env
        }
      }) as CopilotClient;
      entry.client = client;

      const skillDirectory = path.resolve(__dirname, "../../output/skills");

      let disabledSkills: string[] | undefined;
      if (runConfig.includeSkills) {
        const skills = listSkills();
        if (runConfig.includeSkills.some((skillName) => !skills.includes(skillName))) {
          const invalidSkills = runConfig.includeSkills.filter((skillName) => !skills.includes(skillName));
          throw new Error(`Invalid includeSkills. ${invalidSkills} are not valid skills.`);
        }
        disabledSkills = skills.filter((skillName) => !runConfig.includeSkills?.includes(skillName));
      } else {
        // Keep all the required skills, then randomly drop the remaining skills until the estimated char count falls below the budget.
        // Copilot CLI effectively randomly truncates skills after exceeding the char count budget.
        // We emulate Copilot CLI's behavior by preserving the required skills and randomly disable the rest of the skills.
        if (runConfig.requiredSkills) {
          disabledSkills = await truncateSkills(runConfig.requiredSkills, DEFAULT_SKILL_CHAR_BUDGET);
        }
      }

      const noSkills = process.env.NO_SKILLS === "true";
      const disableAzureMcp = process.env.VALLY_RUNNER_DISABLE_AZURE_MCP === "true";
      const model = runConfig.model ?? modelOverride ?? "claude-sonnet-4.6";
      const session = await client.createSession({
        model: model,
        onPermissionRequest: approveAll,
        skillDirectories: noSkills ? [] : [skillDirectory],
        disabledSkills: disabledSkills,
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
        await session.sendAndWait({ prompt: followUpPrompt }, FOLLOW_UP_TIMEOUT);
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
      const { toolCounts, skillFiles } = computeToolAndSkillStats(agentMetadata.events, skillDirectory);
      agentMetadata.toolCounts = toolCounts;
      agentMetadata.skillFiles = skillFiles;

      if (runConfig.takeScreenshot && runConfig.takeScreenshot.predicate(agentMetadata)) {
        // Resume the session so it can take a different set of skills and mcp servers.
        // Use playwright mcp server to take a screenshot.
        const screenshotTimeout = 180000; // 3 minutes
        const screenshotPath = path.join(buildTestCaseDirPath(getTestName()), "app-snapshot.jpg");
        const playwrightSession = await client.resumeSession(session.sessionId, {
          mcpServers: {
            playwright: {
              command: "npx",
              args: [
                "@playwright/mcp@0.0.71"
              ],
              tools: ["*"]
            }
          },
          onPermissionRequest: approveAll,
          // Disable session telemetry so usage of skills and tools by the test agent runner don't end up sending Copilot CLI telemetry.
          enableSessionTelemetry: false
        });
        await playwrightSession.sendAndWait({
          prompt: `Use playwright mcp tools to take a screenshot of the deployed app. Save the screenshot to this directory at this file location ${screenshotPath}`
        }, screenshotTimeout);

        // Check if screenshot was successfully created
        const screenshotExists = fs.existsSync(screenshotPath);
        agentMetadata.testComments.push(
          `Screenshot attempt: ${screenshotExists ? "✓ app-snapshot.jpg created successfully" : "✗ app-snapshot.jpg not found after screenshot attempt"}`
        );
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
      // Jest integration tests clean up in afterEach so reports can be written first.
      // Non-Jest test runners such as Vally must clean up here; otherwise Copilot CLI
      // child processes keep the Node process alive after results are written.
      if (!isTest() || !useJest()) {
        await cleanup();
      }
    }
  }

  return { run, cleanup };
}

function buildTestCaseDirPath(testName: string): string {
  return path.join(DEFAULT_REPORT_DIR, testRunDirectoryName, testName);
}

function buildShareFilePath(testName: string): string {
  const testCaseArtifactsDir = buildTestCaseDirPath(testName);
  return path.join(testCaseArtifactsDir, `agent-metadata-${new Date().toISOString().replace(/[:.]/g, "-")}.md`);
}

export async function createMarkdownReport(testName: string, config: AgentRunConfig, agentMetadata: AgentMetadata): Promise<void> {
  writeMarkdownReport(testName, config, agentMetadata);
}

/**
 * Write token usage data to a JSON file for dashboard consumption.
 * Also appends to a consolidated token-summary.json in the reports root.
 */
function writeTokenUsageJson(testName: string, config: AgentRunConfig, agentMetadata: AgentMetadata, reportDir: string): void {
  try {
    const usage = agentMetadata.tokenUsage!;
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
 * Write markdown report to file
 */
function writeMarkdownReport(testName: string, config: AgentRunConfig, agentMetadata: AgentMetadata): void {
  try {
    const agentMetadataPath = buildShareFilePath(testName);
    const dir = path.dirname(agentMetadataPath);

    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const markdown = redactSecrets(generateMarkdownReport(config, agentMetadata));
    // Use "wx" flag for atomic create-if-not-exists to prevent race conditions
    let reportTargetPath = agentMetadataPath;
    let suffix = 0;
    while (true) {
      try {
        fs.writeFileSync(reportTargetPath, markdown, { encoding: "utf-8", flag: "wx" });
        break;
      } catch (err: unknown) {
        console.log("File exists", reportTargetPath);
        if ((err as { code: string }).code === "EEXIST") {
          suffix++;
          reportTargetPath = agentMetadataPath.replace(".md", `-${suffix}.md`);
          continue;
        }
        throw err;
      }
    }

    // Write structured agent-metadata.json for machine consumption
    const jsonPath = path.join(dir, "agent-metadata.json");
    const jsonData = {
      prompt: config.prompt || "",
      events: agentMetadata.events,
      testComments: agentMetadata.testComments,
      tokenUsage: agentMetadata.tokenUsage,
      toolCounts: agentMetadata.toolCounts,
      skillFiles: agentMetadata.skillFiles,
    };
    fs.writeFileSync(jsonPath, redactSecrets(JSON.stringify(jsonData, null, 2)), "utf-8");

    // Write per-run tool-usage JSON (Phase 1: capture for review). Named to match
    // this run's markdown report so the tool sequence for a specific run can be
    // reconstructed even when the same stimulus runs multiple times in one
    // directory (where agent-metadata.json is overwritten). Best-effort: never
    // fail a test because capture failed.
    try {
      const toolUsagePath = deriveToolUsageFileName(reportTargetPath);
      const sessionId =
        agentMetadata.events.find((e) => e.type === "session.start")?.id ?? null;
      const toolUsage: ToolUsageRecord = {
        testName,
        reportFile: path.basename(reportTargetPath),
        sessionId,
        model: config.model ?? agentMetadata.tokenUsage?.model,
        timestamp: new Date().toISOString(),
        toolCalls: computeToolUsage(agentMetadata.events),
      };
      fs.writeFileSync(
        toolUsagePath,
        redactSecrets(JSON.stringify(toolUsage, null, 2)),
        "utf-8",
      );
    } catch (error) {
      if (process.env.DEBUG) {
        console.error("Failed to write tool usage JSON:", error);
      }
    }

    if (process.env.DEBUG) {
      console.log(`Markdown report written to: ${reportTargetPath}`);
    }

    // Write token usage JSON alongside the markdown report
    if (agentMetadata.tokenUsage && agentMetadata.tokenUsage.apiCallCount > 0) {
      writeTokenUsageJson(testName, config, agentMetadata, dir);
    }
  } catch (error) {
    // Don't fail the test if report generation fails
    if (process.env.DEBUG) {
      console.error("Failed to write markdown report:", error);
    }
  }
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
const testRunDirectoryName = `test-run-${testRunId || TIME_STAMP}`;

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