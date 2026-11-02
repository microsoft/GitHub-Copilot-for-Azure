import { describe, expect, test } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { parse } from "yaml";
import { matchesSuiteFilter, parseSuiteFilter } from "@microsoft/vally";

type Step = {
  id?: string;
  name?: string;
  uses?: string;
  run?: string;
  if?: string;
  shell?: string;
  env?: Record<string, string>;
  with?: Record<string, unknown>;
};
type Job = {
  env?: Record<string, string>;
  outputs?: Record<string, string>;
  uses?: string;
  with?: Record<string, string>;
  needs?: string | string[];
  if?: string;
  environment?: string;
  strategy?: { matrix: Record<string, string> };
  steps?: Step[];
};
type Workflow = { permissions: Record<string, string>; jobs: Record<string, Job> };

function readWorkflow(file: string): Workflow {
  return parse(readFileSync(fileURLToPath(new URL(`../../.github/workflows/${file}`, import.meta.url)), "utf8"));
}
function readAction(name: string): Step[] {
  return parse(readFileSync(
    fileURLToPath(new URL(`../../.github/actions/${name}/action.yml`, import.meta.url)), "utf8",
  )).runs.steps;
}

describe("permission integration workflows", () => {
  const workflow = readWorkflow("test-all-integration.yml");
  const deploy = readWorkflow("test-azure-deploy.yml");
  const profiles = readAction("azure-profiles");
  const action = readAction("test-permission");
  const report = readWorkflow("report-integration-skill.yml").jobs.report;
  const stageVariables = ["AZURE_CLIENT_ID", "AZURE_TENANT_ID", "AZURE_STAGE_SUBSCRIPTION_ID"];
  const testVariables = [
    ...stageVariables, "AZURE_READ_CLIENT_ID", "AZURE_WRITE_CLIENT_ID", "AZURE_ADMIN_CLIENT_ID",
    "AZURE_SUBSCRIPTION_ID", "AZURE_FIXTURE_COORDINATION_STORAGE_ACCOUNT", "AZURE_FIXTURE_COORDINATION_CONTAINER",
  ];

  test.each(["azure-profiles", "test-permission", "stop-azure-profiles"])(
    "%s composite action does not reference the unavailable vars context",
    (name) => {
      expect(JSON.stringify(readAction(name))).not.toMatch(/\$\{\{[^}]*\bvars\s*(?:\.|\[)/);
    },
  );

  test("profile action reads configuration exclusively from caller environment", () => {
    expect(profiles[0].env).toMatchObject({
      STAGE_CLIENT_ID: "${{ env.AZURE_CLIENT_ID }}",
      READ_CLIENT_ID: "${{ env.AZURE_READ_CLIENT_ID }}",
      WRITE_CLIENT_ID: "${{ env.AZURE_WRITE_CLIENT_ID }}",
      ADMIN_CLIENT_ID: "${{ env.AZURE_ADMIN_CLIENT_ID }}",
      TENANT_ID: "${{ env.AZURE_TENANT_ID }}",
      TEST_SUBSCRIPTION_ID: "${{ env.AZURE_SUBSCRIPTION_ID }}",
      STAGE_SUBSCRIPTION_ID: "${{ env.AZURE_STAGE_SUBSCRIPTION_ID }}",
      FIXTURE_STORAGE_ACCOUNT: "${{ env.AZURE_FIXTURE_COORDINATION_STORAGE_ACCOUNT }}",
      FIXTURE_STORAGE_CONTAINER: "${{ env.AZURE_FIXTURE_COORDINATION_CONTAINER }}",
    });
  });

  test("all stage-only callers supply their authentication configuration", () => {
    for (const job of [workflow.jobs["resolve-inputs"], workflow.jobs.setup, deploy.jobs.setup, report]) {
      expect(job.steps?.some(step => step.uses === "./.github/actions/azure-profiles")).toBe(true);
      for (const variable of stageVariables) {
        expect(job.env?.[variable]).toBe(`\${{ vars.${variable} }}`);
      }
    }
  });

  test.each(["read", "write", "admin", "none", "default"])("dispatches the %s matrix to its reusable workflow", (group) => {
    expect(workflow.jobs.setup.outputs?.[`${group}-matrix`])
      .toBe(`\${{ steps.azure-permissions.outputs.${group}-matrix }}`);
    const caller = workflow.jobs[`test-${group}`];
    expect(caller.uses).toBe(`./.github/workflows/test-integration-${group}.yml`);
    expect(caller.if).toContain(`needs.setup.outputs.${group}-matrix != '[]'`);
    expect(caller.strategy?.matrix.skill).toContain(`needs.setup.outputs.${group}-matrix`);
    const callee = readWorkflow(`test-integration-${group}.yml`);
    expect(callee.permissions["id-token"]).toBe("write");
    expect(callee.jobs.test.environment).toBe("cideploytest");
    for (const variable of [...testVariables, "REPORT_STORAGE_ACCOUNT"]) {
      expect(callee.jobs.test.env?.[variable]).toBe(`\${{ vars.${variable} }}`);
    }
    expect(callee.jobs.test.env?.REPORT_STORAGE_CONTAINER).toBe(
      "${{ github.event_name == 'schedule' && (vars.REPORT_STORAGE_CONTAINER || 'integration-reports') || (vars.MANUAL_REPORT_STORAGE_CONTAINER || 'manual-integration-reports') }}",
    );
    const upload = action.find(step => step.name === "Upload private reports");
    expect(upload?.env).not.toHaveProperty("REPORT_STORAGE_ACCOUNT");
    expect(upload?.env).not.toHaveProperty("REPORT_STORAGE_CONTAINER");
    const invocation = callee.jobs.test.steps?.find(step => step.uses === "./.github/actions/test-permission");
    expect(invocation?.with?.permission).toBe(group === "default" ? "" : group);
  });

  test.each([
    { input: "", none: ["skill-invocation"], adminCount: 11 },
    { input: "skill-invocation", none: ["skill-invocation"], adminCount: 0 },
    { input: "vanilla-app-service-deploy", none: [], adminCount: 1 },
    { input: " skill-invocation, vanilla-app-service-deploy, ", none: ["skill-invocation"], adminCount: 1 },
    { input: " , ", none: [], adminCount: 0 },
  ])("splits azure-deploy groups for input '$input'", ({ input, none, adminCount }) => {
    const script = deploy.jobs.setup.steps?.find(step => step.id === "set-matrix")?.with?.script;
    if (typeof script !== "string") {
      throw new Error("Missing azure-deploy matrix script");
    }
    const outputs: Record<string, string> = {};
    runInNewContext(script, {
      process: { env: { INPUT: input } },
      core: { setOutput: (name: string, value: string) => { outputs[name] = value; } },
    }, { timeout: 1000 });
    expect(JSON.parse(outputs["none-matrix"])).toEqual(none);
    const admin: string[] = JSON.parse(outputs["admin-matrix"]);
    expect(admin).toHaveLength(adminCount);
    expect(admin).not.toContain("skill-invocation");
    expect(JSON.parse(outputs["report-groups"])).toEqual([...none, ...admin]);
  });

  test.each(["none", "admin"])("dispatches azure-deploy %s groups independently", (group) => {
    const job = deploy.jobs[`test-${group}`];
    expect(job.needs).toBe("setup");
    expect(job.if).toBe(`needs.setup.outputs.${group}-matrix != '[]'`);
    expect(job.strategy?.matrix["test-group"])
      .toBe(`\${{ fromJson(needs.setup.outputs.${group}-matrix) }}`);
    expect(job.uses).toBe("./.github/workflows/test-azure-deploy-group.yml");
    expect(job.with?.permission).toBe(group);
    const callee = readWorkflow("test-azure-deploy-group.yml").jobs.test;
    for (const variable of testVariables) {
      expect(callee.env?.[variable]).toBe(`\${{ vars.${variable} }}`);
    }
    const steps = callee.steps ?? [];
    expect(steps.find(step => step.uses === "./.github/actions/azure-profiles")?.with?.permission)
      .toBe("${{ inputs.permission }}");
    expect(steps.find(step => step.id === "tests")?.run).toContain('--tag "category=$TEST_GROUP"');
  });

  test.each(["storage", "none", "read", "write", "admin"])("logs in only the needed explicit CLI profiles for %s", (permission) => {
    const directory = mkdtempSync(path.join(tmpdir(), "azure-profile-command-"));
    try {
      const capture = path.join(directory, "commands.jsonl");
      writeFileSync(path.join(directory, "az"), `#!/usr/bin/env node
require("node:fs").appendFileSync(process.env.CAPTURE, JSON.stringify({
  args: process.argv.slice(2), profile: process.env.AZURE_CONFIG_DIR
}) + "\\n");
`, { mode: 0o755 });
      writeFileSync(path.join(directory, "curl"), "#!/bin/sh\nprintf '%s' '{\"value\":\"fake-token\"}'\n", { mode: 0o755 });
      writeFileSync(path.join(directory, "jq"), "#!/bin/sh\ncat >/dev/null\nprintf '%s' fake-token\n", { mode: 0o755 });
      const result = spawnSync("bash", ["-e", "-o", "pipefail", "-c", profiles[0].run ?? ""], {
        env: {
          ...process.env,
          PATH: `${directory}${path.delimiter}${process.env.PATH}`,
          RUNNER_TEMP: directory,
          GITHUB_ENV: path.join(directory, "environment"),
          CAPTURE: capture,
          TEST_PERMISSION: permission,
          REFRESH: "false",
          STAGE_CLIENT_ID: "stage-client",
          WRITE_CLIENT_ID: "write-client",
          READ_CLIENT_ID: "read-client",
          ADMIN_CLIENT_ID: "admin-client",
          TENANT_ID: "tenant",
          STAGE_SUBSCRIPTION_ID: "stage-sub",
          TEST_SUBSCRIPTION_ID: "test-sub",
          FIXTURE_STORAGE_ACCOUNT: "fixture-storage",
          FIXTURE_STORAGE_CONTAINER: "fixtures",
          ACTIONS_ID_TOKEN_REQUEST_TOKEN: "fake-request-token",
          ACTIONS_ID_TOKEN_REQUEST_URL: "https://example.invalid/oidc",
        },
        encoding: "utf8",
      });
      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      const commands: { args: string[]; profile: string }[] = readFileSync(capture, "utf8").trim().split("\n").map(line => JSON.parse(line));
      const expected = ["stage", ...(permission === "storage" ? [] : ["write"]),
        ...(permission === "read" || permission === "admin" ? [permission] : [])];
      expect(commands.filter(command => command.args[0] === "login").map(command => path.basename(command.profile)))
        .toEqual(expected.map(profile => `azure-${profile}`));
      for (const [index, profile] of expected.entries()) {
        expect(commands[index * 2].args).toContain(`${profile}-client`);
        expect(commands[index * 2 + 1].args).toEqual([
          "account", "set", "--subscription", profile === "stage" ? "stage-sub" : "test-sub",
        ]);
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("azd logs in only with the selected test identity", () => {
    const azd = profiles.find(step => step.name === "Authenticate azd with only the test identity");
    expect(azd?.if).toBe("inputs.permission != 'storage' && inputs.permission != 'none'");
    expect(azd?.run).toContain('AZURE_CONFIG_DIR="$profile" azd auth login');
    expect(azd?.run).not.toContain("STAGE_CLIENT_ID");
    expect(azd?.run).toContain('write) client_id="$AZURE_WRITE_CLIENT_ID"; profile="$AZURE_WRITE_CONFIG_DIR"');
  });

  test.each(["read", "write", "admin", "none", ""])("filters only permission %j", (permission) => {
    const directory = mkdtempSync(path.join(tmpdir(), "permission-command-"));
    try {
      const capture = path.join(directory, "arguments.json");
      writeFileSync(path.join(directory, "npm"), `#!/usr/bin/env node
require("node:fs").writeFileSync(process.env.CAPTURE, JSON.stringify(process.argv.slice(2)));
`, { mode: 0o755 });
      const result = spawnSync("bash", ["-e", "-o", "pipefail", "-c", action.find(step => step.id === "tests")?.run ?? ""], {
        env: { ...process.env, PATH: `${directory}${path.delimiter}${process.env.PATH}`, CAPTURE: capture,
          SKILL: "plugin/skill", TEST_AZURE_PERMISSION: permission },
        encoding: "utf8",
      });
      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      const args: string[] = JSON.parse(readFileSync(capture, "utf8"));
      const filter = parseSuiteFilter(args.flatMap((arg, index) => arg === "--tag" ? [args[index + 1]] : []));
      for (const candidate of ["read", "write", "admin", "none", ""]) {
        expect(matchesSuiteFilter(candidate ? { azurePermission: [candidate] } : {}, filter.include, filter.exclude))
          .toBe(candidate === permission);
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("both workflows consolidate every selected group through private storage", () => {
    expect(workflow.jobs.report.needs).toEqual(["setup", "test-read", "test-write", "test-admin", "test-none", "test-default"]);
    expect(deploy.jobs.report.needs).toEqual(["setup", "test-none", "test-admin"]);
    for (const caller of [workflow.jobs.report, deploy.jobs.report]) {
      expect(caller.uses).toBe("./.github/workflows/report-integration-skill.yml");
      expect(caller.if).toContain("always()");
    }
    const steps = report.steps ?? [];
    expect(steps.find(step => step.id === "download")?.run).toBe("npx tsx report-storage.ts download");
    expect(steps.findIndex(step => step.id === "aggregate"))
      .toBeLessThan(steps.findIndex(step => step.name === "Generate skill report"));
    expect(steps.find(step => step.name === "Publish consolidated reports privately")?.run)
      .toBe("npx tsx report-storage.ts publish");
  });

  test("never transfers artifacts through GitHub and all embedded Bash is valid", () => {
    const steps = [
      ...[workflow, deploy, readWorkflow("test-azure-deploy-group.yml"), readWorkflow("report-integration-skill.yml")]
        .flatMap(file => Object.values(file.jobs).flatMap(job => job.steps ?? [])),
      ...action, ...profiles, ...readAction("stop-azure-profiles"),
    ];
    expect(steps.some(step => /actions\/(?:upload|download)-artifact@/.test(step.uses ?? ""))).toBe(false);
    for (const step of steps.filter(step => step.run)) {
      const result = spawnSync("bash", ["-n"], { input: step.run, encoding: "utf8" });
      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
    }
  });
});
