import type { Grader, GraderInput, GraderMetadata, GraderResult } from "@microsoft/vally";
import { stripNonExecutableContent } from "../utils/evaluate.ts";

/**
 * A rule matches when the tool call's toolName matches `name` (regex) AND
 * the executable portion of the command matches `command` (regex).
 *
 * Non-executable content (bash heredoc bodies, PowerShell here-strings,
 * comments) is stripped before matching so that substrings inside
 * `cat > plan.md << 'EOF' ... EOF` do NOT trigger false positives.
 */
export type ShellCommandInvokedRule = {
  /**
   * Regex for the tool name. Defaults to `(?i)^(bash|powershell|pwsh)$`
   * (case-insensitive, matching the built-in `tool-calls` grader configs).
   * Supports a leading `(?ims)` inline-flag prefix.
   */
  name?: string;

  /**
   * Regex applied to the stripped command string.
   * Supports a leading `(?ims)` inline-flag prefix.
   */
  command: string;

  /**
   * Optional human-readable label included in evidence messages.
   */
  description?: string;
};

export type ShellCommandInvokedGraderConfig = {
  /**
   * Rules that must EACH match at least one tool call.
   * If any required rule has zero matches, the grader fails.
   */
  required?: ShellCommandInvokedRule[];

  /**
   * Rules that must match ZERO tool calls.
   * If any disallowed rule has ≥1 match, the grader fails.
   */
  disallowed?: ShellCommandInvokedRule[];
};

const DEFAULT_TOOL_NAME_PATTERN = "(?i)^(bash|powershell|pwsh)$";
const INLINE_FLAGS = /^\(\?([ims]+)\)/;

/**
 * Compile a pattern that may carry a leading `(?ims)` inline-flag group.
 * JavaScript's `RegExp` does not support inline flags, so we strip the prefix
 * and pass the flags natively — matching the built-in `tool-calls` grader so
 * config patterns (e.g. `(?i)az acr build`) are portable between the two.
 */
function compilePattern(pattern: string): RegExp {
  const match = INLINE_FLAGS.exec(pattern);
  if (match) {
    return new RegExp(pattern.slice(match[0].length), match[1]);
  }
  return new RegExp(pattern);
}

function parseRules(raw: unknown, label: string): ShellCommandInvokedRule[] {
  if (raw === undefined || raw === null) return [];
  let parsed: unknown;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new Error(`${label} must be a valid JSON array string: ${(err as Error).message}`, { cause: err });
    }
  } else {
    parsed = raw;
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`${label} must be an array or a JSON string array`);
  }
  return parsed.map((rule, i) => validateRule(rule, `${label}[${i}]`));
}

/**
 * Validate a single rule. A missing or empty `command` is rejected because
 * `new RegExp(undefined)` compiles to `/(?:)/`, which matches every command —
 * silently making a required rule always pass and a disallowed rule always fail.
 */
function validateRule(rule: unknown, label: string): ShellCommandInvokedRule {
  if (typeof rule !== "object" || rule === null || Array.isArray(rule)) {
    throw new Error(`${label} must be an object with a 'command' pattern`);
  }
  const { command, name, description } = rule as Record<string, unknown>;
  if (typeof command !== "string" || command.length === 0) {
    throw new Error(`${label}.command is required and must be a non-empty string`);
  }
  if (name !== undefined && typeof name !== "string") {
    throw new Error(`${label}.name must be a string when provided`);
  }
  if (description !== undefined && typeof description !== "string") {
    throw new Error(`${label}.description must be a string when provided`);
  }
  return { command, name, description } as ShellCommandInvokedRule;
}

type ShellToolCall = {
  toolName: string;
  strippedCommand: string;
};

function extractShellToolCalls(events: readonly unknown[]): ShellToolCall[] {
  const calls: ShellToolCall[] = [];
  for (const raw of events) {
    const event = raw as { type?: string; data?: { toolName?: string; arguments?: { command?: string } } };
    if (event.type !== "tool_call") continue;
    const toolName = event.data?.toolName;
    if (typeof toolName !== "string") continue;
    const rawCommand = event.data?.arguments?.command;
    if (typeof rawCommand !== "string") continue;
    calls.push({
      toolName,
      strippedCommand: stripNonExecutableContent(rawCommand),
    });
  }
  return calls;
}

/** Compile a rule pattern, attributing failures to the offending rule/field. */
function compileRulePattern(
  pattern: string,
  rule: ShellCommandInvokedRule,
  field: "name" | "command",
): RegExp {
  try {
    return compilePattern(pattern);
  } catch (err) {
    throw new Error(`invalid ${field} regex in rule ${describeRule(rule)}: ${(err as Error).message}`, { cause: err });
  }
}

/** Return the stripped commands of every call matched by the rule. */
function matchRule(rule: ShellCommandInvokedRule, calls: ShellToolCall[]): string[] {
  const namePattern = compileRulePattern(rule.name ?? DEFAULT_TOOL_NAME_PATTERN, rule, "name");
  const commandPattern = compileRulePattern(rule.command, rule, "command");
  const matched: string[] = [];
  for (const call of calls) {
    if (!namePattern.test(call.toolName)) continue;
    if (!commandPattern.test(call.strippedCommand)) continue;
    matched.push(call.strippedCommand);
  }
  return matched;
}

function describeRule(rule: ShellCommandInvokedRule): string {
  const namePart = rule.name ? ` name=/${rule.name}/` : "";
  const desc = rule.description ? ` "${rule.description}"` : "";
  return `command=/${rule.command}/${namePart}${desc}`;
}

/** Collapse whitespace and truncate a command for compact evidence output. */
function formatCommand(command: string, maxLen = 120): string {
  const collapsed = command.replace(/\s+/g, " ").trim();
  return collapsed.length > maxLen ? `${collapsed.slice(0, maxLen - 1)}…` : collapsed;
}

/** Render up to `max` matched commands as a quoted, comma-separated list. */
function formatCommands(commands: string[], max = 3): string {
  const shown = commands.slice(0, max).map(c => `"${formatCommand(c)}"`);
  const extra = commands.length > max ? ` (+${commands.length - max} more)` : "";
  return `${shown.join(", ")}${extra}`;
}

/** Summarize the shell commands that were scanned (for required-rule misses). */
function summarizeScanned(calls: ShellToolCall[]): string {
  if (calls.length === 0) return "No shell commands were executed.";
  return `Scanned ${calls.length} shell command(s): ${formatCommands(calls.map(c => c.strippedCommand), 5)}`;
}

/**
 * Grader that asserts on shell tool invocations (bash / powershell / pwsh)
 * by matching against the *executable* portion of the command — heredoc
 * bodies, here-string bodies, and comment lines are stripped before matching.
 *
 * Fixes the substring-in-heredoc false positive that the built-in
 * `tool-calls` grader exhibits when a stimulus writes a plan file containing
 * words like "azd up" as content.
 */
export class ShellCommandInvokedGrader implements Grader {
  metadata: GraderMetadata = {
    name: "shell-command-invoked",
    description:
      "Checks whether shell tool invocations (bash/powershell/pwsh) match required/disallowed regex patterns. Strips heredoc bodies before matching to avoid substring false positives.",
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

    const required = parseRules(input.config.required, "required");
    const disallowed = parseRules(input.config.disallowed, "disallowed");

    if (required.length === 0 && disallowed.length === 0) {
      throw new Error(
        `${this.metadata.name}: config must include at least one 'required' or 'disallowed' rule`,
      );
    }

    const calls = extractShellToolCalls(input.trajectory.events);
    const failures: string[] = [];

    for (const rule of required) {
      if (matchRule(rule, calls).length === 0) {
        failures.push(`required rule not matched: ${describeRule(rule)}. ${summarizeScanned(calls)}`);
      }
    }

    for (const rule of disallowed) {
      const hits = matchRule(rule, calls);
      if (hits.length > 0) {
        failures.push(
          `disallowed rule matched ${hits.length} time(s): ${describeRule(rule)} — ${formatCommands(hits)}`,
        );
      }
    }

    const passed = failures.length === 0;
    const evidence = passed
      ? `All shell-command rules satisfied (required=${required.length}, disallowed=${disallowed.length}, shell tool calls scanned=${calls.length}).`
      : `${failures.length} failure(s):\n${failures.map((f, i) => `  ${i + 1}. ${f}`).join("\n")}`;

    return {
      name: this.metadata.name,
      kind: "code",
      passed,
      score: passed ? 1 : 0,
      evidence,
      label: passed ? "correct" : "incorrect",
      metadata: {
        requiredCount: required.length,
        disallowedCount: disallowed.length,
        shellCallCount: calls.length,
        failureCount: failures.length,
      },
    };
  }
}
