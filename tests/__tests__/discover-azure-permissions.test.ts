import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { stringify } from "yaml";
import { discoverAzurePermissions, readEvalSuites } from "../discover-azure-permissions.ts";

describe("discoverAzurePermissions", () => {
  let directory: string;
  function suite(file: string, stimuli: unknown[], tags?: Record<string, string>) {
    const target = path.join(directory, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, stringify({ name: file, tags, stimuli }));
  }
  beforeEach(() => {
    directory = mkdtempSync(path.join(tmpdir(), "azure-permissions-"));
  });
  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  test("scans the same nested suites as the runner, excluding fixture directories", async () => {
    suite("a.yaml", [{ name: "read", prompt: "read", tags: { azurePermission: "read" } }]);
    suite("nested/b.yaml", [
      { name: "default", prompt: "default" },
      { name: "none", prompt: "none", tags: { azurePermission: "none" } },
    ]);
    writeFileSync(path.join(directory, "ignored.yml"), "invalid: [");
    suite("fixture/ignored.yaml", [{ tags: { azurePermission: "ignored" } }]);
    suite("nested/fixture/ignored.yaml", [{ tags: { azurePermission: "ignored" } }]);
    expect(await discoverAzurePermissions(directory)).toEqual({ permissions: ["read", "admin", "none"], fixtures: false });
    expect((await readEvalSuites(directory)).map(({ file }) => path.relative(directory, file)))
      .toEqual(["a.yaml", "nested/b.yaml"]);
  });

  test("honors inherited tags, stimulus overrides and the exact category filter", async () => {
    suite("a.yaml", [
      { name: "inherited", prompt: "read" },
      { name: "override", prompt: "write", tags: { azurePermission: "write", azureFixture: "fixture/manifest.yaml" } },
      { name: "excluded", prompt: "admin", tags: { azurePermission: "admin", category: "other" } },
    ], { azurePermission: "read", category: "selected" });
    expect(await discoverAzurePermissions(directory, ["category=selected"]))
      .toEqual({ permissions: ["read", "write"], fixtures: true });
    expect(await discoverAzurePermissions(directory, ["category=missing"]))
      .toEqual({ permissions: [], fixtures: false });
  });

  test.each(["unsupported", "", ["read"]])("rejects malformed permission %j", async (permission) => {
    suite("a.yaml", [{ name: "invalid", prompt: "invalid", tags: { azurePermission: permission } }]);
    await expect(discoverAzurePermissions(directory)).rejects.toThrow("Unsupported Azure permission");
  });

  test("fails on invalid YAML, malformed stimuli and missing directories", async () => {
    writeFileSync(path.join(directory, "a.yaml"), "stimuli: [");
    await expect(discoverAzurePermissions(directory)).rejects.toThrow();
    writeFileSync(path.join(directory, "a.yaml"), "stimuli: [null]");
    await expect(discoverAzurePermissions(directory)).rejects.toThrow();
    await expect(discoverAzurePermissions(path.join(directory, "missing"))).rejects.toThrow();
  });

  test("writes only the identities needed by the selected run", () => {
    suite("evals/plugin/skill/eval.yaml", [
      { name: "none", prompt: "none", tags: { azurePermission: "none", category: "selected" } },
      { name: "admin", prompt: "admin", tags: { azurePermission: "admin", category: "other" } },
    ]);
    const output = path.join(directory, "output");
    const result = spawnSync(process.execPath, [
      "--import", "tsx", fileURLToPath(new URL("../discover-azure-permissions.ts", import.meta.url)),
    ], {
      env: {
        ...process.env, GITHUB_WORKSPACE: directory, SKILL: "plugin/skill",
        TEST_TAG: "category=selected", GITHUB_OUTPUT: output,
      },
      encoding: "utf8",
    });
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(readFileSync(output, "utf8")).toBe('permissions=["none"]\nfixtures=false\n');
  });
});
