import { describe, expect, test } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { parse } from "yaml";

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
  env?: Record<string, string>;
  outputs?: Record<string, string>;
  needs?: string | string[];
  if?: string;
  environment?: string;
  strategy?: { matrix: Record<string, string> };
  steps?: Step[];
};
type Workflow = { jobs: Record<string, Job> };
function readWorkflow(file: string): Workflow {
  return parse(readFileSync(fileURLToPath(new URL(`../../.github/workflows/${file}`, import.meta.url)), "utf8"));
}
function readAction(name: string): Step[] {
  return parse(readFileSync(
    fileURLToPath(new URL(`../../.github/actions/${name}/action.yml`, import.meta.url)), "utf8",
  )).runs.steps;
}

describe("per-stimulus integration workflows", () => {
  const workflow = readWorkflow("test-all-integration.yml");
  const deploy = readWorkflow("test-azure-deploy.yml");
  const profiles = readAction("azure-profiles");
  const action = readAction("test-integration");

  test("uses one skill matrix and one deployment-category matrix, never permission jobs", () => {
    expect(Object.keys(workflow.jobs)).toEqual(["resolve-inputs", "setup", "azure-deploy", "test"]);
    expect(Object.keys(deploy.jobs)).toEqual(["setup", "test"]);
    expect(workflow.jobs.test.strategy?.matrix.skill).toBe("${{ fromJson(needs.setup.outputs.matrix) }}");
    expect(deploy.jobs.test.strategy?.matrix["test-group"]).toBe("${{ fromJson(needs.setup.outputs.matrix) }}");
    expect(workflow.jobs.test.steps?.at(-1)?.with?.skill).toBe("${{ matrix.skill }}");
    expect(deploy.jobs.test.steps?.at(-1)?.with).toMatchObject({
      skill: "azure-skills/azure-deploy", "test-tag": "category=${{ matrix.test-group }}",
      "report-group": "${{ matrix.test-group }}",
    });
    for (const job of [workflow.jobs.test, deploy.jobs.test]) {
      expect(job.environment).toBe("cideploytest");
      expect(job.env?.AZURE_STAGE_CLIENT_ID).toBe("${{ vars.AZURE_STAGE_CLIENT_ID }}");
      for (const variable of ["AZURE_READ_CLIENT_ID", "AZURE_WRITE_CLIENT_ID", "AZURE_ADMIN_CLIENT_ID",
        "AZURE_TENANT_ID", "AZURE_SUBSCRIPTION_ID", "AZURE_STAGE_SUBSCRIPTION_ID",
        "AZURE_FIXTURE_COORDINATION_STORAGE_ACCOUNT", "AZURE_FIXTURE_COORDINATION_CONTAINER", "REPORT_STORAGE_ACCOUNT"]) {
        expect(job.env?.[variable]).toBe(`\${{ vars.${variable} }}`);
      }
      expect(job.env?.REPORT_STORAGE_CONTAINER).toContain("MANUAL_REPORT_STORAGE_CONTAINER");
      expect(job.env?.TOKEN_USAGE_STORAGE_ACCOUNT).toBe("${{ vars.REPORT_STORAGE_ACCOUNT }}");
      expect(job.env?.TOOL_USAGE_STORAGE_ACCOUNT).toBe("${{ vars.REPORT_STORAGE_ACCOUNT }}");
    }
    for (const job of [workflow.jobs["resolve-inputs"], workflow.jobs.setup, deploy.jobs.setup]) {
      expect(job.steps?.some(step => step.uses === "./.github/actions/azure-profiles")).toBeFalsy();
    }
    expect(JSON.stringify([workflow, deploy, action, profiles])).not.toContain("vars.AZURE_CLIENT_ID");
  });

  test.each([
    { input: "", count: 12 },
    { input: "skill-invocation", count: 1 },
    { input: "skill-invocation,vanilla-app-service-deploy,skill-invocation", count: 2 },
    { input: " , ", count: 0 },
  ])("retains deployment categories without classifying permissions for '$input'", ({ input, count }) => {
    const script = deploy.jobs.setup.steps?.find(step => step.id === "set-matrix")?.with?.script;
    if (typeof script !== "string") {
      throw new Error("Missing deployment matrix script");
    }
    const outputs: Record<string, string> = {};
    runInNewContext(script, {
      process: { env: { INPUT: input } },
      core: { setOutput: (name: string, value: string) => { outputs[name] = value; } },
    }, { timeout: 1000 });
    expect(Object.keys(outputs)).toEqual(["matrix"]);
    expect(JSON.parse(outputs.matrix)).toHaveLength(count);
  });

  test("discovery and execution use the same filter, without azurePermission expressions", () => {
    const discovery = action.find(step => step.id === "identities");
    const execution = action.find(step => step.id === "tests");
    expect(discovery?.env?.TEST_TAG).toBe("${{ inputs.test-tag }}");
    expect(execution?.env?.TEST_TAG).toBe(discovery?.env?.TEST_TAG);
    expect(execution?.run).not.toContain("azurePermission");
    expect(execution?.env?.TEST_RUN_ID).toBe("all-integration");
    expect(action.find(step => step.name === "Authenticate test profiles")?.with).toMatchObject({
      permissions: "${{ steps.identities.outputs.permissions }}",
      fixtures: "${{ steps.identities.outputs.fixtures }}",
    });
  });

  test("report authentication occurs after tests, immediately before direct publication", () => {
    const login = action.findIndex(step => step.id === "storage");
    expect(login).toBeGreaterThan(action.findIndex(step => step.id === "tests"));
    expect(action[login].if).toContain("always()");
    expect(action[login].with).toEqual({ storage: "true" });
    expect(action[login + 1].run).toBe("npx tsx report-storage.ts");
    expect(action[login + 1].if).toBe("always() && steps.storage.outcome == 'success'");
    expect(action.some(step => /download|aggregate|cleanup/.test(step.run ?? ""))).toBe(false);
    for (const step of action.filter(step => step.run?.includes("upload:"))) {
      expect(step.if).toContain("steps.storage.outcome == 'success'");
    }
  });

  test.each(["", "category=selected"])("executes every selected stimulus without permission filters: '%s'", (tag) => {
    const directory = mkdtempSync(path.join(tmpdir(), "integration-command-"));
    try {
      const capture = path.join(directory, "arguments.json");
      writeFileSync(path.join(directory, "npm"), `#!${process.execPath}
require("node:fs").writeFileSync(process.env.CAPTURE, JSON.stringify(process.argv.slice(2)));
`, { mode: 0o755 });
      const result = spawnSync("bash", ["-e", "-o", "pipefail", "-c",
        action.find(step => step.id === "tests")?.run ?? ""], {
        env: { ...process.env, PATH: `${directory}${path.delimiter}${process.env.PATH}`,
          CAPTURE: capture, SKILL: "plugin/skill", TEST_TAG: tag },
        encoding: "utf8",
      });
      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(JSON.parse(readFileSync(capture, "utf8"))).toEqual([
        "run", "test:vally", "--", "--plugin", "plugin", "--skill", "skill", "--workers", "2",
        ...(tag ? ["--tag", tag] : []),
      ]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test.each([
    { permissions: '["unsupported"]', client: "read-client", message: "Invalid Azure permissions" },
    { permissions: '["read"]', client: "", message: "Managed identity client ID is required" },
  ])("fails explicitly rather than falling back to default profiles: %j", (scenario) => {
    const directory = mkdtempSync(path.join(tmpdir(), "azure-profile-failure-"));
    try {
      writeFileSync(path.join(directory, "curl"), "#!/bin/sh\nprintf '%s' '{\"value\":\"fake-token\"}'\n", { mode: 0o755 });
      const result = spawnSync("bash", ["-e", "-o", "pipefail", "-c", profiles[0].run ?? ""], {
        env: {
          ...process.env, PATH: `${directory}${path.delimiter}${process.env.PATH}`,
          RUNNER_TEMP: directory, GITHUB_ENV: path.join(directory, "environment"),
          PERMISSIONS: scenario.permissions, FIXTURES: "false", STORAGE: "false", REFRESH: "false",
          READ_CLIENT_ID: scenario.client, TENANT_ID: "tenant", TEST_SUBSCRIPTION_ID: "test-sub",
          ACTIONS_ID_TOKEN_REQUEST_TOKEN: "fake-request-token", ACTIONS_ID_TOKEN_REQUEST_URL: "https://example.invalid/oidc",
        },
        encoding: "utf8",
      });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain(scenario.message);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test.each([
    { permissions: ["none"], fixtures: false, az: [], azd: [] },
    { permissions: ["none"], fixtures: true, az: ["write"], azd: [] },
    { permissions: ["read"], fixtures: true, az: ["read", "write"], azd: ["read"] },
    { permissions: ["read", "write", "admin", "none"], fixtures: true,
      az: ["admin", "read", "write"], azd: ["admin", "read", "write"] },
    { permissions: ["write"], fixtures: true, az: ["write"], azd: ["write"] },
    { permissions: [], fixtures: false, storage: true, az: ["stage"], azd: [] },
  ])("authenticates only required explicit az/azd profiles: %j", (scenario) => {
    const directory = mkdtempSync(path.join(tmpdir(), "azure-profile-command-"));
    try {
      const capture = path.join(directory, "commands.jsonl");
      for (const command of ["az", "azd"]) {
        writeFileSync(path.join(directory, command), `#!${process.execPath}
require("node:fs").appendFileSync(process.env.CAPTURE, JSON.stringify({
  command: "${command}", args: process.argv.slice(2),
  az: process.env.AZURE_CONFIG_DIR, azd: process.env.AZD_CONFIG_DIR
}) + "\\n");
`, { mode: 0o755 });
      }
      writeFileSync(path.join(directory, "curl"), "#!/bin/sh\nprintf '%s' '{\"value\":\"fake-token\"}'\n", { mode: 0o755 });
      const result = spawnSync("bash", ["-e", "-o", "pipefail", "-c", profiles[0].run ?? ""], {
        env: {
          ...process.env, PATH: `${directory}${path.delimiter}${process.env.PATH}`,
          RUNNER_TEMP: directory, GITHUB_ENV: path.join(directory, "environment"), CAPTURE: capture,
          PERMISSIONS: JSON.stringify(scenario.permissions), FIXTURES: String(scenario.fixtures),
          STORAGE: String(scenario.storage ?? false), REFRESH: "false",
          STAGE_CLIENT_ID: "stage-client", WRITE_CLIENT_ID: "write-client",
          READ_CLIENT_ID: "read-client", ADMIN_CLIENT_ID: "admin-client",
          TENANT_ID: "tenant", STAGE_SUBSCRIPTION_ID: "stage-sub", TEST_SUBSCRIPTION_ID: "test-sub",
          ACTIONS_ID_TOKEN_REQUEST_TOKEN: "fake-request-token", ACTIONS_ID_TOKEN_REQUEST_URL: "https://example.invalid/oidc",
        },
        encoding: "utf8",
      });
      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      type Command = { command: string; args: string[]; az: string; azd: string };
      const commands: Command[] = scenario.az.length
        ? readFileSync(capture, "utf8").trim().split("\n").map(line => JSON.parse(line)) : [];
      const logins = commands.filter(command => command.command === "az" && command.args[0] === "login");
      expect(logins.map(command => path.basename(command.az))).toEqual(scenario.az.map(p => `azure-${p}`));
      const azdLogins = commands.filter(command => command.command === "azd");
      expect(azdLogins.map(command => path.basename(command.azd))).toEqual(scenario.azd.map(p => `azd-${p}`));
      for (const profile of scenario.az) {
        expect(logins.find(command => command.az.endsWith(`azure-${profile}`))?.args).toContain(`${profile}-client`);
        expect(commands.find(command => command.az.endsWith(`azure-${profile}`) && command.args[0] === "account")?.args)
          .toEqual(["account", "set", "--subscription", profile === "stage" ? "stage-sub" : "test-sub"]);
      }
      for (const command of azdLogins) {
        const permission = path.basename(command.azd).slice(4);
        expect(command.az).toBe(path.join(directory, `azure-${permission}`));
        expect(command.args).toContain(`${permission}-client`);
      }
      const exported = readFileSync(path.join(directory, "environment"), "utf8");
      expect(exported).toContain(`AZD_NONE_CONFIG_DIR=${directory}/azd-none`);
      if (!scenario.storage) {
        expect(exported).toContain(`AZURE_CONFIG_DIR=${directory}/azure-none`);
        expect(exported).toContain(`AZD_CONFIG_DIR=${directory}/azd-none`);
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("composites use caller env, no GitHub report transfers, and valid Bash", () => {
    const composites = [...action, ...profiles, ...readAction("stop-azure-profiles")];
    expect(JSON.stringify(composites)).not.toMatch(/\$\{\{[^}]*\bvars\s*(?:\.|\[)/);
    const steps = [
      ...[workflow, deploy].flatMap(file => Object.values(file.jobs).flatMap(job => job.steps ?? [])),
      ...composites,
    ];
    expect(steps.some(step => /actions\/(?:upload|download)-artifact@/.test(step.uses ?? ""))).toBe(false);
    for (const step of steps.filter(step => step.run)) {
      const result = spawnSync("bash", ["-n"], { input: step.run, encoding: "utf8" });
      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
    }
  });
});
