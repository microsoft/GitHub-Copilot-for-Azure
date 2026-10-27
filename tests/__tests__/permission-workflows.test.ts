import { describe, expect, test } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { matchesSuiteFilter, parseSuiteFilter } from "@microsoft/vally";

type Step = {
  id?: string;
  name?: string;
  uses?: string;
  run?: string;
  if?: string;
  env?: Record<string, string>;
  with?: Record<string, unknown>;
};
type Job = {
  uses?: string;
  needs?: string[];
  if?: string;
  env?: Record<string, string>;
  strategy?: { matrix: Record<string, string> };
  steps?: Step[];
};
type Workflow = {
  permissions: Record<string, string>;
  on: { workflow_call?: { inputs: Record<string, unknown> } };
  jobs: Record<string, Job>;
};

function readWorkflow(file: string): Workflow {
  return parse(readFileSync(fileURLToPath(new URL(`../../.github/workflows/${file}`, import.meta.url)), "utf8"));
}

describe("permission integration workflows", () => {
  const workflow = readWorkflow("test-all-integration.yml");
  const action: { runs: { steps: Step[] } } = parse(readFileSync(
    fileURLToPath(new URL("../../.github/actions/test-permission/action.yml", import.meta.url)), "utf8",
  ));

  test.each(["read", "none", "default"])("dispatches the %s matrix to its reusable workflow", (group) => {
    const caller = workflow.jobs[`test-${group}`];
    expect(caller.uses).toBe(`./.github/workflows/test-integration-${group}.yml`);
    expect(caller.if).toContain(`needs.setup.outputs.${group}-matrix != '[]'`);
    expect(caller.strategy?.matrix.skill).toContain(`needs.setup.outputs.${group}-matrix`);

    const callee = readWorkflow(`test-integration-${group}.yml`);
    const invocation = callee.jobs.test.steps?.find(step => step.uses === "./.github/actions/test-permission");
    expect(invocation?.with?.permission).toBe(group === "default" ? "" : group);
    if (group === "none") {
      expect(callee.permissions["id-token"]).toBe("none");
      expect(callee.jobs.test.env?.AZURE_CLIENT_ID).toBe("");
    } else {
      expect(callee.jobs.test.env?.AZURE_CLIENT_ID)
        .toBe(group === "read" ? "${{ vars.AZURE_READ_CLIENT_ID }}" : "${{ vars.AZURE_CLIENT_ID }}");
      expect(callee.jobs.test.env).not.toHaveProperty("AZURE_READ_CLIENT_ID");
    }
  });

  test("installs dependencies before executing tests and never logs in for none", () => {
    const steps = action.runs.steps;
    expect(steps.findIndex(step => step.run === "npm ci")).toBeLessThan(steps.findIndex(step => step.id === "tests"));
    for (const step of steps.filter(step =>
      step.uses?.startsWith("azure/login@") || step.run?.includes("azd auth login")
    )) {
      expect(step.if).toBe("inputs.permission != 'none'");
    }
    const upload = steps.find(step => step.uses?.startsWith("actions/upload-artifact@"));
    expect(upload?.if).toBe("always()");
    expect(upload?.with?.path).toContain("tests/reports/");
    expect(upload?.with?.path).not.toContain("tests/results/");
    expect(upload?.with?.["include-hidden-files"]).toBe(true);
    expect(steps.some(step => step.run?.includes("AZURE_CONFIG_DIR="))).toBe(false);
    expect(steps.some(step => step.run?.includes("AZD_CONFIG_DIR="))).toBe(false);
    const refresh = steps.find(step => step.id === "refresh");
    expect(refresh?.if).toBe("inputs.permission != 'none'");
    expect(refresh?.run).toContain("sleep 240");
    expect(steps.find(step => step.id === "tests")?.run).not.toContain("az login");
  });

  test.each(["read", "none", ""])("passes native Vally filters selecting only permission %j", (permission) => {
    const directory = mkdtempSync(path.join(tmpdir(), "permission-command-"));
    try {
      const capture = path.join(directory, "arguments.json");
      writeFileSync(path.join(directory, "npm"), `#!/usr/bin/env node
require("node:fs").writeFileSync(process.env.CAPTURE, JSON.stringify(process.argv.slice(2)));
`, { mode: 0o755 });
      const command = action.runs.steps.find(step => step.id === "tests")?.run;
      expect(command).toBeDefined();
      const result = spawnSync("bash", ["-e", "-o", "pipefail", "-c", command ?? ""], {
        env: {
          ...process.env,
          PATH: `${directory}${path.delimiter}${process.env.PATH}`,
          CAPTURE: capture,
          SKILL: "plugin/skill",
          TEST_AZURE_PERMISSION: permission,
        },
        encoding: "utf8",
      });
      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      const args: string[] = JSON.parse(readFileSync(capture, "utf8"));
      expect(args.slice(0, 9)).toEqual([
        "run", "test:vally", "--", "--plugin", "plugin", "--skill", "skill", "--workers", "2",
      ]);
      expect(args).not.toContain("--eval-spec");
      const filters = args.flatMap((arg, index) => arg === "--tag" ? [args[index + 1]] : []);
      const filter = parseSuiteFilter(filters);
      for (const candidate of ["read", "none", ""]) {
        const tags: Record<string, string[]> = candidate ? { azurePermission: [candidate] } : {};
        expect(matchesSuiteFilter(tags, filter.include, filter.exclude)).toBe(candidate === permission);
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("aggregates after all permission jobs, including failed or skipped groups", () => {
    const report = workflow.jobs.report;
    expect(report.needs).toEqual(["setup", "test-read", "test-none", "test-default"]);
    expect(report.if).toContain("always()");
    const steps = report.steps ?? [];
    expect(steps.findIndex(step => step.id === "aggregate"))
      .toBeLessThan(steps.findIndex(step => step.id === "generate-skill-report"));
    expect(steps.findIndex(step => step.id === "generate-skill-report"))
      .toBeLessThan(steps.findIndex(step => step.name === "Upload aggregated reports"));
    const upload = steps.find(step => step.name === "Upload aggregated reports");
    expect(upload?.with?.path).toContain("tests/reports/test-run-all-integration/");
    expect(upload?.with?.path).not.toContain("tests/results/");
  });

  test("all embedded Bash scripts have valid syntax", () => {
    const steps = [
      ...Object.values(workflow.jobs).flatMap(job => job.steps ?? []),
      ...action.runs.steps,
    ];
    for (const step of steps.filter(step => step.run)) {
      const result = spawnSync("bash", ["-n"], { input: step.run, encoding: "utf8" });
      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
    }
  });
});
