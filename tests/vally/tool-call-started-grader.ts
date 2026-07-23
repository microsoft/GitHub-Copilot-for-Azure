import type { Grader, GraderInput, GraderMetadata, GraderResult } from "@microsoft/vally";

/**
 * Passes when the trajectory contains a tool-call *start* event whose tool name
 * matches `name` and (optionally) whose `command`/`path` argument matches
 * `command`.
 *
 * The built-in `tool-calls` grader only counts a required tool once its
 * `tool_result` arrives. That is fundamentally incompatible with the custom
 * executor's `earlyTerminate` on a `tool-call-match` condition, which aborts the
 * run the instant the matching tool call *starts* — so the `tool_result` never
 * fires and `tool-calls` can never match it. This grader inspects the `tool_call`
 * (start) event instead, so an early-terminated run can still be graded on the
 * fact that the agent chose to invoke the tool.
 *
 * Regex patterns support a leading inline case-insensitivity flag, e.g.
 * `(?i)aks-baseline\.(ps1|sh)`, mirroring vally's built-in grader convention.
 */
type ToolCallStartedConfig = {
  /** Regex matched against the tool name (e.g. "bash|powershell|pwsh"). */
  name: string;
  /** Optional regex matched against the tool's `command`/`path` string args. */
  command?: string;
};

const INLINE_FLAGS = /^\(\?([ims]+)\)/;

function compile(pattern: string): RegExp {
  const match = INLINE_FLAGS.exec(pattern);
  if (match) {
    return new RegExp(pattern.slice(match[0].length), match[1]);
  }
  return new RegExp(pattern);
}

const ARG_KEYS = ["command", "path"] as const;

export class ToolCallStartedGrader implements Grader {
  metadata: GraderMetadata = {
    name: "tool-call-started",
    description:
      "Passes when a tool-call start event matches the given name/command patterns. " +
      "Use with earlyTerminate, where the built-in tool-calls grader cannot match.",
    behavior: { requiresLlmClient: false, requiresWorkspace: false },
    costProfile: "free",
    reference: "reference-free",
    temporalScope: "trajectory-level",
    determinism: "static",
  };

  async grade(input: GraderInput): Promise<GraderResult> {
    if (!input.trajectory) {
      throw new Error("Missing trajectory");
    }
    if (!input.config || typeof input.config !== "object") {
      throw new Error(`Invalid ${this.metadata.name} grader config`);
    }

    const config = input.config as ToolCallStartedConfig;
    if (typeof config.name !== "string" || config.name.trim().length === 0) {
      throw new Error(`Invalid ${this.metadata.name} grader config. name must be a non-empty string`);
    }
    if (config.command !== undefined && typeof config.command !== "string") {
      throw new Error(`Invalid ${this.metadata.name} grader config. command must be a string`);
    }

    const nameRe = compile(config.name);
    const commandRe = config.command !== undefined ? compile(config.command) : undefined;

    const events = input.trajectory.events ?? [];
    const seen: string[] = [];
    let passed = false;

    for (const event of events) {
      if (event.type !== "tool_call") {
        continue;
      }
      const data = (event.data ?? {}) as { toolName?: string; arguments?: Record<string, unknown> };
      const toolName = data.toolName ?? "";
      seen.push(toolName);
      if (!nameRe.test(toolName)) {
        continue;
      }
      if (commandRe === undefined) {
        passed = true;
        break;
      }
      const args = data.arguments ?? {};
      const matchedArg = ARG_KEYS.some((key) => {
        const value = args[key];
        return typeof value === "string" && commandRe.test(value);
      });
      if (matchedArg) {
        passed = true;
        break;
      }
    }

    const evidence = passed
      ? `A tool-call start matched name=/${config.name}/` +
        (config.command ? ` command=/${config.command}/` : "")
      : `No tool-call start matched name=/${config.name}/` +
        (config.command ? ` command=/${config.command}/` : "") +
        `. Tool calls started: ${seen.length > 0 ? seen.join(", ") : "(none)"}`;

    return {
      name: this.metadata.name,
      kind: "code",
      passed,
      score: passed ? 1 : 0,
      evidence,
      label: passed ? "correct" : "incorrect",
      metadata: { toolsStarted: seen },
    };
  }
}
