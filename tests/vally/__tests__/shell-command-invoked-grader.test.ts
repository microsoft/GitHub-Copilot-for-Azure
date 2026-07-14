/**
 * Tests for the shell-command-invoked custom Vally grader.
 *
 * Focused coverage:
 * 1. Required rule matches a real bash invocation.
 * 2. Disallowed rule does NOT trigger on a substring that only appears
 *    inside a heredoc body (the false-positive the built-in `tool-calls`
 *    grader exhibits, per plan Phase 2).
 */

import type { GraderInput, Trajectory, TrajectoryEvent } from "@microsoft/vally";
import { ShellCommandInvokedGrader } from "../shell-command-invoked-grader.ts";

function makeToolCall(toolName: string, command: string, toolCallId = "call-1"): TrajectoryEvent {
  return {
    type: "tool_call",
    data: { toolName, toolCallId, arguments: { command } },
  } as TrajectoryEvent;
}

function makeInput(
  events: TrajectoryEvent[],
  config: Record<string, unknown>,
): GraderInput {
  const trajectory = {
    id: "test",
    events,
    workDir: "/tmp/nonexistent",
  } as unknown as Trajectory;
  return { trajectory, config };
}

describe("ShellCommandInvokedGrader", () => {
  const grader = new ShellCommandInvokedGrader();

  test("passes when a required rule matches a real bash invocation", async () => {
    const events = [
      makeToolCall("bash", "az account show"),
      makeToolCall("bash", "az deployment sub create --location eastus --template-file main.bicep", "call-2"),
    ];
    const result = await grader.grade(
      makeInput(events, {
        required: [{ command: "\\baz deployment (sub|group) create\\b", description: "bicep sub-scope deploy" }],
      }),
    );
    expect(result.passed).toBe(true);
    expect(result.score).toBe(1);
  });

  test("does NOT flag a disallowed pattern that only appears inside a heredoc body", async () => {
    // The agent writes a plan file whose contents contain the string "azd up".
    // The built-in `tool-calls` grader (regex over raw args) would false-positive here;
    // this grader strips heredoc bodies first so the disallowed rule should NOT trigger.
    const heredocWrite =
      "cat > plan.md << 'EOF'\n" +
      "# Deployment Plan\n" +
      "Later we will run: azd up\n" +
      "EOF\n" +
      "echo wrote plan";
    const events = [makeToolCall("bash", heredocWrite)];

    const result = await grader.grade(
      makeInput(events, {
        disallowed: [{ command: "\\bazd\\s+(up|provision|deploy)\\b", description: "no azd shortcuts" }],
      }),
    );
    expect(result.passed).toBe(true);
    expect(result.score).toBe(1);
    // Sanity: the raw substring IS present in the args — a naïve grader would fail here.
    expect(heredocWrite).toMatch(/\bazd\s+up\b/);
  });

  test("flags a disallowed pattern when the command is actually executed", async () => {
    const events = [
      makeToolCall("bash", "cd infra && azd up --no-prompt"),
    ];
    const result = await grader.grade(
      makeInput(events, {
        disallowed: [{ command: "\\bazd\\s+(up|provision|deploy)\\b" }],
      }),
    );
    expect(result.passed).toBe(false);
    expect(result.score).toBe(0);
    expect(result.evidence).toMatch(/disallowed rule matched/);
  });

  test("fails when a required rule has zero matches", async () => {
    const events = [makeToolCall("bash", "ls -la")];
    const result = await grader.grade(
      makeInput(events, {
        required: [{ command: "\\baz deployment sub create\\b" }],
      }),
    );
    expect(result.passed).toBe(false);
    expect(result.evidence).toMatch(/required rule not matched/);
  });

  test("matches shell tool calls case-insensitively by default (e.g. 'Bash', 'PowerShell')", async () => {
    // The default tool-name pattern is case-insensitive, matching the sibling
    // tool-calls grader config. A capitalized tool name must still be scanned —
    // otherwise a disallowed command would silently pass ungraded.
    const events = [makeToolCall("PowerShell", "cd infra && azd up --no-prompt")];
    const result = await grader.grade(
      makeInput(events, {
        disallowed: [{ command: "\\bazd\\s+(up|provision|deploy)\\b" }],
      }),
    );
    expect(result.passed).toBe(false);
    expect(result.score).toBe(0);
  });

  test("supports a leading (?i) inline-flag prefix (case-insensitive match)", async () => {
    const events = [makeToolCall("bash", "az acr build --registry myacr .")];
    const result = await grader.grade(
      makeInput(events, {
        required: [{ command: "(?i)AZ\\s+ACR\\s+BUILD" }],
      }),
    );
    expect(result.passed).toBe(true);
    expect(result.score).toBe(1);
  });

  test("throws when config has neither required nor disallowed", async () => {
    const events = [makeToolCall("bash", "ls")];
    await expect(grader.grade(makeInput(events, {}))).rejects.toThrow(/must include at least one/);
  });

  test("throws when a rule is missing its command (guards the match-all footgun)", async () => {
    // Without a `command`, `new RegExp(undefined)` compiles to /(?:)/ and matches
    // every call — a required rule would trivially pass, a disallowed rule would
    // always fail. Validation must reject this up front.
    const events = [makeToolCall("bash", "ls")];
    await expect(
      grader.grade(makeInput(events, { disallowed: [{ description: "no command here" }] })),
    ).rejects.toThrow(/command is required and must be a non-empty string/);
    await expect(
      grader.grade(makeInput(events, { required: [{ command: "" }] })),
    ).rejects.toThrow(/command is required and must be a non-empty string/);
  });

  test("throws with rule attribution when a command pattern is invalid regex", async () => {
    const events = [makeToolCall("bash", "ls")];
    await expect(
      grader.grade(makeInput(events, { required: [{ command: "az foo (unclosed" }] })),
    ).rejects.toThrow(/invalid command regex in rule/);
  });

  test("throws when config is a malformed JSON string", async () => {
    const events = [makeToolCall("bash", "ls")];
    await expect(
      grader.grade(makeInput(events, { required: "[{ not valid json" })),
    ).rejects.toThrow(/must be a valid JSON array string/);
  });

  test("evidence names the offending command on a disallowed match", async () => {
    const events = [makeToolCall("bash", "cd infra && azd up --no-prompt")];
    const result = await grader.grade(
      makeInput(events, { disallowed: [{ command: "\\bazd\\s+up\\b" }] }),
    );
    expect(result.passed).toBe(false);
    expect(result.evidence).toMatch(/disallowed rule matched/);
    expect(result.evidence).toContain("cd infra && azd up --no-prompt");
  });

  test("evidence lists the scanned commands when a required rule is not matched", async () => {
    const events = [
      makeToolCall("bash", "az account show"),
      makeToolCall("bash", "ls -la", "call-2"),
    ];
    const result = await grader.grade(
      makeInput(events, { required: [{ command: "\\baz webapp deploy\\b" }] }),
    );
    expect(result.passed).toBe(false);
    expect(result.evidence).toMatch(/required rule not matched/);
    expect(result.evidence).toContain("Scanned 2 shell command(s)");
    expect(result.evidence).toContain("az account show");
  });

  test("evidence reports when no shell commands were executed", async () => {
    const result = await grader.grade(
      makeInput([], { required: [{ command: "\\baz webapp deploy\\b" }] }),
    );
    expect(result.passed).toBe(false);
    expect(result.evidence).toContain("No shell commands were executed.");
  });
});
