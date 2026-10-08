import type { SessionEvent, SystemMessageConfig } from "@github/copilot-sdk";
import { type SkillRef } from "./skill-loader.ts";

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