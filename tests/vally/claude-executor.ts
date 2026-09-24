import type { Executor, ExecutorOptions, ExecutorRegistry, Stimulus, Trajectory, TrajectoryEvent } from "@microsoft/vally";
import { computeMetrics } from "@microsoft/vally";
import { copyFile, cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { getSkillsForTest, listPlugins, loadSkill } from "../utils/skill-loader.ts";
import { comparisonMcpServers, comparisonSkills, comparisonStimulus, getCommonSystemPrompt, isComparisonRun } from "./comparison-policy.ts";

type ClaudeOptions = {
  claudePath?: string;
  extraArgs?: string[];
};

type ClaudeExecutorConstructor = new (options: ClaudeOptions) => Executor;

function isClaudeModule(value: unknown): value is { ClaudeCliExecutor: ClaudeExecutorConstructor } {
  return typeof value === "object" && value !== null
    && "ClaudeCliExecutor" in value && typeof value.ClaudeCliExecutor === "function";
}

export async function loadClaudeExecutor(): Promise<ClaudeExecutorConstructor> {
  const modulePath = process.env.VALLY_CLAUDE_EXECUTOR_MODULE;
  const specifier = modulePath
    ? pathToFileURL(path.resolve(modulePath)).href
    : "@microsoft/vally-executor-claude-cli";
  let upstream: unknown;
  try {
    upstream = await import(specifier);
  } catch (cause) {
    throw new Error(
      "Cannot load the Vally Claude executor. Build the upstream plugin and set "
      + "VALLY_CLAUDE_EXECUTOR_MODULE to its dist/index.js, or install "
      + "@microsoft/vally-executor-claude-cli in tests/. See evals/README.md.",
      { cause },
    );
  }
  if (!isClaudeModule(upstream)) {
    throw new Error(`${specifier} does not export ClaudeCliExecutor.`);
  }
  return upstream.ClaudeCliExecutor;
}

async function isolatedClaudeConfig(): Promise<string> {
  const configDir = await mkdtemp(path.join(tmpdir(), "vally-claude-comparison-"));
  const source = path.join(process.env.CLAUDE_CONFIG_DIR ?? path.join(homedir(), ".claude"), ".credentials.json");
  try {
    await copyFile(source, path.join(configDir, ".credentials.json"));
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      await rm(configDir, { recursive: true, force: true });
      throw error;
    }
    // API-key and macOS Keychain authentication need no credentials file.
  }
  return configDir;
}

function systemPromptArgs(stimulus: Stimulus): string[] {
  const prompt = getCommonSystemPrompt(stimulus);
  return prompt ? [prompt.mode === "replace" ? "--system-prompt" : "--append-system-prompt", prompt.content] : [];
}

/** Adapt the upstream CLI executor to this repository's skill layout and tags. */
export class ClaudeIntegrationExecutor implements Executor {
  name = "claude-cli";
  supportsMultiTurn = true;
  supportsTurnCompletion = true;
  supportsEnvVars = true;
  private readonly ClaudeCliExecutor: ClaudeExecutorConstructor;

  constructor(ClaudeCliExecutor: ClaudeExecutorConstructor) {
    this.ClaudeCliExecutor = ClaudeCliExecutor;
  }

  async execute(stimulus: Stimulus, options: ExecutorOptions): Promise<Trajectory> {
    const comparison = isComparisonRun();
    if (comparison) stimulus = comparisonStimulus(stimulus, options);
    if (stimulus.tags?.takeScreenshot !== undefined) {
      throw new Error("Claude does not support the takeScreenshot tag. Use integration-test-agent-runner.");
    }
    const extraArgs = systemPromptArgs(stimulus);
    if (comparison) {
      extraArgs.push("--setting-sources", "project", "--strict-mcp-config");
      if (Object.keys(comparisonMcpServers(options)).length === 0) {
        extraArgs.push("--mcp-config", JSON.stringify({ mcpServers: {} }));
      }
    }
    if (stimulus.constraints?.max_turns !== undefined) {
      extraArgs.push("--max-turns", String(stimulus.constraints.max_turns));
    }
    if (stimulus.tags?.earlyTerminate !== undefined) {
      console.warn(`[${stimulus.name}] Claude does not support earlyTerminate; the trial runs until completion or timeout.`);
    }

    let skillsLoaded: string[] = [];
    if (process.env.NO_SKILLS !== "true") {
      const required = stimulus.tags?.requiredSkills ?? stimulus.tags?.skill;
      const names = typeof required === "string" ? [required] : required;
      if (!names?.length) {
        throw new Error("Claude evals require a skill or requiredSkills tag.");
      }
      const allSkills = listPlugins().flatMap(plugin => plugin.skills);
      const requiredSkills = comparison ? await comparisonSkills(stimulus) : names.map(name => {
        const matches = allSkills.filter(skill => skill.name === name);
        if (matches.length !== 1) {
          throw new Error(`Expected one built skill named '${name}', found ${matches.length}. Run npm run build.`);
        }
        return matches[0];
      });
      const selected = await getSkillsForTest(
        requiredSkills,
        comparison || process.env.VALLY_RUNNER_EXACT_SKILL === "true" ? requiredSkills : undefined,
      );
      const skillsDir = path.join(options.workDir, ".claude", "skills");
      await mkdir(skillsDir, { recursive: true });
      for (const ref of selected.skillsLoaded) {
        const skill = await loadSkill(ref);
        // Workspace skills keep unqualified names, matching the existing graders.
        await cp(skill.path, path.join(skillsDir, ref.name), {
          recursive: true, force: false, errorOnExist: true,
        });
      }
      skillsLoaded = selected.skillsLoaded.map(skill => skill.name);
    }

    const executor = new this.ClaudeCliExecutor({
      claudePath: process.env.CLAUDE_CLI_PATH?.trim() || undefined,
      extraArgs,
    });
    const configDir = comparison ? await isolatedClaudeConfig() : undefined;
    try {
      const trajectory = await executor.execute(stimulus, {
        ...options,
        model: process.env.MODEL_OVERRIDE?.trim() || options.model || "sonnet",
        env: {
          UV_CACHE_DIR: path.join(options.workDir, ".uv-cache"), ...options.env,
          ...(configDir ? { CLAUDE_CONFIG_DIR: configDir } : {}),
        },
        mcpServers: comparison ? comparisonMcpServers(options) : {
          ...(process.env.VALLY_RUNNER_DISABLE_AZURE_MCP === "true" ? {} : {
            azure: { type: "stdio", command: "npx", args: ["-y", "@azure/mcp", "server", "start"] },
          }),
          ...options.mcpServers,
        },
      });
      // Upstream normalizes Skill to a tool call, but the skill-invocation grader
      // consumes skill_activation events rather than tool calls.
      const events: TrajectoryEvent[] = [];
      for (const event of trajectory.events) {
        events.push(event);
        if (event.type !== "tool_call" || event.data.toolName !== "skill") {
          continue;
        }
        const args = event.data.arguments;
        if (typeof args === "object" && args !== null && "skill" in args && typeof args.skill === "string") {
          events.push({
            type: "skill_activation",
            timestamp: event.timestamp,
            data: { name: args.skill, path: path.join(options.workDir, ".claude", "skills", args.skill) },
          });
        }
      }
      return {
        ...trajectory,
        events,
        metadata: { ...trajectory.metadata, executor: this.name, skillsLoaded },
        metrics: { ...computeMetrics(events), wallTimeMs: trajectory.metrics.wallTimeMs },
      };
    } finally {
      try {
        await executor.shutdown();
      } finally {
        if (configDir) await rm(configDir, { recursive: true, force: true });
      }
    }
  }

  async shutdown(): Promise<void> {
    // Each trial owns and shuts down its upstream executor.
  }
}

export async function registerExecutors(registry: ExecutorRegistry): Promise<void> {
  registry.register(new ClaudeIntegrationExecutor(await loadClaudeExecutor()));
}
