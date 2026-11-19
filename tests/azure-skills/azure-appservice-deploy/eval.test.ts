import { readdirSync, readFileSync } from "node:fs";
import type { GraderInput, TrajectoryEvent } from "@microsoft/vally";
import { parse } from "yaml";
import { describe, expect, test } from "vitest";
import { ShellCommandInvokedGrader, type ShellCommandInvokedGraderConfig } from "../../vally/shell-command-invoked-grader.ts";
import { getRequiredSkillsCondition } from "../../vally/tag-helpers.ts";

type Tags = NonNullable<Parameters<typeof getRequiredSkillsCondition>[0]>;
interface EvalSuite {
  tags: Tags;
  stimuli: {
    tags?: Tags;
    graders: { type: string; config?: { required?: string[] } | ShellCommandInvokedGraderConfig }[];
  }[];
}

const evalDir = new URL("../../../evals/azure-skills/azure-appservice-deploy/", import.meta.url);
const suites = readdirSync(evalDir).filter(file => file.endsWith(".yaml")).map(file => {
  const suite = parse(readFileSync(new URL(file, evalDir), "utf8")) as EvalSuite;
  return { file, suite };
});

test.each(suites)("$file protects the skills needed by its graders", ({ suite }) => {
  for (const stimulus of suite.stimuli) {
    const required = stimulus.graders
      .filter(grader => grader.type === "skill-invocation")
      .flatMap(grader => (grader.config?.required ?? []).filter(rule => typeof rule === "string"));
    const protectedSkills = getRequiredSkillsCondition({ ...suite.tags, ...stimulus.tags });
    expect(protectedSkills).toEqual(
      expect.arrayContaining(["azure-appservice-deploy", ...required]),
    );
  }
});

async function gradeShellCommand(command: string, config: ShellCommandInvokedGraderConfig) {
  const event = {
    type: "tool_call",
    data: { toolName: "run_in_terminal", toolCallId: "test", arguments: { command } },
  } as TrajectoryEvent;
  return new ShellCommandInvokedGrader().grade({
    config,
    trajectory: { id: "test", events: [event], workDir: "." },
  } as unknown as GraderInput);
}

describe.each(["nodejs", "php", "dotnet", "java"])("%s deployment graders", (stack) => {
  function deploymentRules() {
    const suite = suites.find(({ file }) => file === `${stack}-eval.yaml`)!.suite;
    return suite.stimuli
      .filter(stimulus => stimulus.tags?.cost === "azure")
      .flatMap(stimulus => stimulus.graders)
      .filter(grader => grader.type === "shell-command-invoked")
      .map(grader => grader.config as ShellCommandInvokedGraderConfig);
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
  ])("grades endpoint probes: %s", async (command, passed) => {
    const disallowed = deploymentRules().flatMap(config => config.disallowed ?? []);
    expect(disallowed.length).toBeGreaterThan(0);
    expect((await gradeShellCommand(command, { disallowed })).passed).toBe(passed);
  });

  test("requires an executed deploy, not a command written in a heredoc", async () => {
    const required = deploymentRules()
      .flatMap(config => config.required ?? [])
      .filter(rule => rule.command.includes("webapp\\s+deploy"));
    expect(required.length).toBeGreaterThan(0);

    const cliDeploy = `az webapp deploy --type ${stack === "java" ? "jar" : "zip"}`;
    for (const command of [cliDeploy, "azd deploy web"]) {
      expect((await gradeShellCommand(command, { required })).passed).toBe(true);
    }
    expect((await gradeShellCommand(`cat > note.md <<'EOF'\n${cliDeploy}\nEOF`, { required })).passed).toBe(false);
  });
});
