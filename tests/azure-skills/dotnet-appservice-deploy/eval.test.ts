import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { GraderInput, TrajectoryEvent } from "@microsoft/vally";
import { parse } from "yaml";
import { expect, test } from "vitest";
import { ShellCommandInvokedGrader } from "../../vally/shell-command-invoked-grader.ts";
import { getRequiredSkillsCondition } from "../../vally/tag-helpers.ts";

const skill = path.basename(path.dirname(fileURLToPath(import.meta.url)));
const suite = parse(fs.readFileSync(new URL(`../../../evals/azure-skills/${skill}/eval.yaml`, import.meta.url), "utf8"));
const configs = suite.stimuli[0].graders
  .filter((grader: { type: string }) => grader.type === "shell-command-invoked")
  .map((grader: { config: Record<string, unknown> }) => grader.config);

test("protects all skills required by routing assertions", () => {
  for (const stimulus of suite.stimuli) {
    const expected = stimulus.graders
      .filter((grader: { type: string }) => grader.type === "skill-invocation")
      .flatMap((grader: { config: { required?: string[] } }) => grader.config.required ?? []);
    const protectedSkills = getRequiredSkillsCondition({ ...suite.tags, ...stimulus.tags });
    expect(protectedSkills).toEqual(expect.arrayContaining([skill, ...expected]));
  }
});

async function grade(command: string, disallowed: boolean) {
  const rules = configs.flatMap((config: Record<string, unknown[]>) => config[disallowed ? "disallowed" : "required"] ?? [])
    .filter((rule: { command: string }) => disallowed || rule.command.includes("webapp\\s+deploy"));
  expect(rules.length).toBeGreaterThan(0);
  const event = { type: "tool_call", data: { toolName: "run_in_terminal", toolCallId: "test", arguments: { command } } } as TrajectoryEvent;
  return new ShellCommandInvokedGrader().grade({
    config: { [disallowed ? "disallowed" : "required"]: rules },
    trajectory: { id: "test", events: [event], workDir: "." },
  } as unknown as GraderInput);
}

test.each([
  ["curl https://app-random.region.azurewebsites.net/health", false],
  ['curl -I "$URL"', false],
  ['wget "${endpoint}"', false],
  ["Invoke-WebRequest -Uri $hostName", false],
  ["Invoke-WebRequest -Uri $endpoint -OutFile health.txt", false],
  ["curl -o response.txt https://app.azurewebsites.net", false],
  ["curl -L https://dot.net/v1/dotnet-install.sh -o install.sh", true],
  ["Invoke-WebRequest -Uri $downloadUrl -OutFile install.ps1", true],
  ["cat > note.md <<'EOF'\nInvoke-WebRequest $URL\naz webapp up\nEOF", true],
])("endpoint probe grading: %s", async (command, passed) => {
  expect((await grade(command, true)).passed).toBe(passed);
});

test.each([
  ["az webapp deploy --type jar", true],
  ["azd deploy web", true],
  ["cat > note.md <<'EOF'\naz webapp deploy --type jar\nEOF", false],
])("deployment must be executed: %s", async (command, passed) => {
  expect((await grade(command, false)).passed).toBe(passed);
});
