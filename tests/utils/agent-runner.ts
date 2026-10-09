import { approveAll, type CopilotClient, type SessionEvent, type SystemMessageConfig } from "@github/copilot-sdk";
import { fileURLToPath } from "node:url";
import { redactSecrets } from "./redact.ts";
import { type SkillRef } from "./skill-loader.ts";
import fs from "node:fs";
import path from "node:path";
import type { ProvisionScriptOutput } from "../azure-fixtures/fixture-common.ts";
import type { TrajectoryEvent } from "@microsoft/vally";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Token usage measurements of an agent run.
 */
export type TokenUsage = {
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

/**
 * Data reflecting what had happened during an agent run.
 */
export type AgentMetadata = {
  /**
   * Copilot SDK events of the agent run.
   * If the underlying agent client emit incompatible events, they must be converted to Copilot SDK compatible events and stored here.
   */
  events: SessionEvent[];

  /**
   * Comments made by the test author.
   * These comments will be added to the final formatted report.
   */
  testComments: string[];

  /**
   * Token usage and cost data extracted for the agent run.
   */
  tokenUsage?: TokenUsage;

  /**
   * Number of turns that started during the run.
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
   * directory (i.e., paths under `output/<plugin-dir>/skills/<skillName>/`) that were referenced
   * by tool invocations during the run.
   * Populated from tool arguments that reference files in a skill directory, and may
   * also include a synthesized `SKILL.md` entry for `skill` tool calls.
   */
  skillFiles: Record<string, string[]>;

  /**
   * Loaded skills after applying the filters in the configuration and environment variable.
   */
  skillsLoaded: SkillRef[];

  /**
   * Optional. The raw data emitted by the agent for the test run trajectory.
   * For reporting compatibility, all agents must translate the raw data into Copilot SDK SessionEvents.
   * They can save the raw data here for further processing.
   */
  rawData?: object[];
}

export type AgentRunConfig = {
  /**
   * An optional function to configure the test workspace.
   * The test runner will create an empty workspace, initialize it following the environment config
   * of the vally stimuli, and then call this function.
   * @param workspace The absolute path to the test workspace directory.
   */
  setup?: (workspace: string) => Promise<void>;

  /**
   * Additional environment variables to set/override on top of those inherited from the parent process.
   */
  env?: Record<string, string>;

  /**
   * The model to use for the test run.
   * Note: different agent client may refer to the same model using different names.
   */
  model?: string;

  /**
   * The first user prompt to send to the agent.
   */
  prompt: string;

  /**
   * Subsequent user prompts to send to the agent.
   */
  followUp?: string[];

  /**
   * If provided, the agent will call this function to determine if it should early terminate the run.
   * @param metadata Data reflecting what had happened so far
   * @returns Whether to early terminate
   */
  shouldEarlyTerminate?: (metadata: AgentMetadata) => boolean;

  /**
   * If provided, the system prompt will be modified according to the provided config.
   */
  systemPrompt?: SystemMessageConfig;

  /**
   * Optional. An absolute path to a directory.
   * if not specified, the agent runner will create a temporary directory and use it as the workspace.
   */
  workspace?: string;

  /**
   * Whether to preserve the test workspace after the test run finishes.
   */
  preserveWorkspace?: boolean;

  /**
   * Skills to include for the agent run.
   * If undefined, all the skills in azure plugin will be included.
   * If specified, only the skills in this array will be included. This option overrides the required skills specified in the {@link requiredSkills}.
   */
  includeSkills?: SkillRef[];

  /**
   * Maximum number of assistant turns allowed before the run is aborted.
   * If undefined, there is no turn limit.
   */
  maxTurns?: number;

  /**
   * Number of milliseconds as timeout for the entire run.
   */
  timeout?: number;

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
  requiredSkills?: SkillRef[];
}

/**
 * A single tool invocation captured during an agent run, in emission order.
 * Includes the `skill` pseudo-tool so the full sequence can be reconstructed.
 */
export type ToolCall = {
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

export type AgentRunnerConfig = {
  /**
   * Name of the test.
   */
  testName: string;
};

/**
 * An agent runner for integration test. The agent run has the following duties:
 * 1. Collect agent run events and save them as Copilot SDK compatible events in AgentMetadata. Write agent metadata to the 
 * 2. Compute statistics and save them in AgentMetadata
 */
export interface IAgentRunner {
  /**
   * Executes an agent run and returns the metadata collected during the session.
   */
  run(runConfig: AgentRunConfig): Promise<AgentMetadata>;

  /**
   * Releases active sessions, clients, and temporary workspaces managed by the runner.
   */
  cleanup(): Promise<void>;
}

/**
 * Utilities for all agent runners
 */

/**
 * Extract file-system paths from the serialized arguments of a tool call that
 * reference any skill directory path in the given `skillDirectories`. Checks common argument keys
 * (`filePath`, `path`, `file`, `uri`) and also scans the full serialized args
 * for any substring rooted at the skill directory. Returned paths are
 * normalized to forward slashes.
 */
function extractSkillDirPaths(args: unknown, skillDirectories: string[]): string[] {
  const found = new Set<string>();

  // A path can match exactly one skill directory in skillDirectories
  skillDirectories.forEach(dir => {
    const normalizedDir = dir.replace(/\\/g, "/").replace(/\/+$/, "");

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
  });

  return Array.from(found);
}

/**
 * Compute aggregate tool invocation counts and per-skill file-read listings
 * from the ordered list of session events.
 *
 * - `toolCounts` keys are raw `event.data.toolName`, excluding the `skill` pseudo-tool.
 * - `skillFiles` is populated from any tool invocation whose arguments reference
 *   a path under the given skill directory (`output/<plugin-dir>/skills/<skill>/...`).
 */
export function computeToolAndSkillStats(
  events: SessionEvent[],
  skillDirectories: string[]
): { toolCounts: Record<string, number>; skillFiles: Record<string, string[]> } {
  const toolCounts: Record<string, number> = {};
  const skillFilesSet: Record<string, Set<string>> = {};

  const normalizedSkillDirs = skillDirectories.map(dir => dir.replace(/\\/g, "/").replace(/\/+$/, ""));

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
        const normalizedSkillDir = normalizedSkillDirs.filter(dir => {
          const skillMdPath = path.resolve(dir, `${skillName}/SKILL.md`);
          return fs.existsSync(skillMdPath);
        }).at(0);
        (skillFilesSet[skillName] ??= new Set()).add(`${normalizedSkillDir}/${skillName}/SKILL.md`);
      }
    }

    for (const filePath of extractSkillDirPaths(event.data.arguments, skillDirectories)) {
      // filePath is <prefix>/output/<plugin-dir>/skills/<skill>/<relative-path>
      // normalizedSkillDirs has paths like <prefix>/output/<plugin-dir>/skills/<skill>/<relative-path>
      const matchingSkillDir = normalizedSkillDirs.filter(dir => filePath.startsWith(dir)).at(0);
      if (matchingSkillDir) {
        const relative = filePath.slice(matchingSkillDir.length + 1);
        const slashIdx = relative.indexOf("/");
        if (slashIdx <= 0) continue;
        const skillName = relative.slice(0, slashIdx);
        (skillFilesSet[skillName] ??= new Set()).add(filePath);
      }
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
export function computeDurationMs(startTs: string, completeTs: string | undefined): number | null {
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
export function generateMarkdownReport(config: AgentRunConfig, agentMetadata: AgentMetadata): string {
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
          lines.push(content.replaceAll(/```/gm, "\\`\\`\\`"));
          lines.push("");
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
                content = content.substring(0, 500) + "... (truncated for test report, agent saw full content)";
              }
              lines.push(`response: ${content}`);
            } else if (!result.success && result.error) {
              let error = result.error;
              if (error.length > 500) {
                error = error.substring(0, 500) + "... (truncated for test report, agent saw full error)";
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
          errorMsg = errorMsg.substring(0, 500) + "... (truncated for test report, agent saw full error)";
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

export function buildTestCaseDirPath(testName: string): string {
  return path.join(DEFAULT_REPORT_DIR, testRunDirectoryName, testName);
}

export async function takeScreenshot(client: CopilotClient, sessionId: string, testName: string, agentMetadata: AgentMetadata): Promise<void> {
  const screenshotTimeout = 180000;
  const screenshotPath = path.join(buildTestCaseDirPath(testName), "app-snapshot.jpg");
  const playwrightSession = await client.resumeSession(sessionId, {
    mcpServers: {
      playwright: {
        command: "npx",
        args: ["@playwright/mcp@0.0.71"],
        tools: ["*"]
      }
    },
    onPermissionRequest: approveAll,
    enableSessionTelemetry: false
  });

  await playwrightSession.sendAndWait({
    prompt: `Use playwright mcp tools to take a screenshot of the deployed app. Save the screenshot to this directory at this file location ${screenshotPath}`
  }, screenshotTimeout);

  const screenshotExists = fs.existsSync(screenshotPath);
  agentMetadata.testComments.push(
    `Screenshot attempt: ${screenshotExists ? "✓ app-snapshot.jpg created successfully" : "✗ app-snapshot.jpg not found after screenshot attempt"}`
  );
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
      skillsLoaded: agentMetadata.skillsLoaded,
      rawData: agentMetadata.rawData
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

interface KeywordOptions {
  caseSensitive?: boolean;
}

/**
 * Check if assistant messages contain a keyword
 */
export function doesAssistantMessageIncludeKeyword(
  agentMetadata: AgentMetadata,
  keyword: string,
  options: KeywordOptions = {}
): boolean {
  // Merge all messages
  // message_delta events are skipped since the assistant.message events contain combined content of their corresponding assistant.message_delta events.
  const allMessages: Record<string, string> = {};

  agentMetadata.events.forEach(event => {
    if (event.type === "assistant.message" && event.data.messageId && event.data.content) {
      allMessages[event.data.messageId] = event.data.content;
    }
  });

  return Object.values(allMessages).some(message => {
    if (options.caseSensitive) {
      return message.includes(keyword);
    }
    return message.toLowerCase().includes(keyword.toLowerCase());
  });
}

const DEFAULT_REPORT_DIR = path.join(__dirname, "..", "reports");

/**
 * A unique identifier to use for the test run name.
 * By default, reports for each test run will be written to a pseudo-unique directory under "reports/test-run-{timestamp}/".
 * If {@link testRunId} is non-empty, reports for this test run will be written to a directory under "reports/test-run-{testRunId}/".
 * This allows reports from multiple test runs to be written to the same directory.
 *
 * Only applicable when the agent run is for a test.
 */
const testRunId = process.env.TEST_RUN_ID;
export const TIME_STAMP = (process.env.START_TIMESTAMP || new Date().toISOString()).replace(/[:.]/g, "-");
export const testRunDirectoryName = `test-run-${testRunId || TIME_STAMP}`;

export function getAzureScopePrompt(fixtureOutput: ProvisionScriptOutput): string {
  return `Limit your operations in the following resource groups: ${JSON.stringify(fixtureOutput.resourceGroups)}. Never read or modify resources outside these resource groups.`;
}

export function convertToTrajectoryEvents(agentMetadata: AgentMetadata): TrajectoryEvent[] {
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
        let skillName: string;
        if (typeof args === "object" && !Array.isArray(args)) {
          skillName = (args?.skill as string) ?? "unknown";
        } else {
          skillName = "unknown";
        }
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
