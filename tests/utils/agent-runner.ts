import type { SessionEvent, SystemMessageConfig } from "@github/copilot-sdk";
import { type SkillRef } from "./skill-loader.ts";

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

export type AgentMetadata = {
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
}

export type AgentRunConfig = {
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
  includeSkills?: SkillRef[];

  /**
   * Maximum number of assistant turns allowed before the run is aborted.
   * Each `assistant.turn_start` event counts as one turn.
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