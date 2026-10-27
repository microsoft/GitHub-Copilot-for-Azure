import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildPermissionMatrices, discoverAzurePermissions } from "../discover-azure-permissions.ts";

describe("discoverAzurePermissions", () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(path.join(tmpdir(), "azure-permissions-"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(directory, { recursive: true, force: true });
  });

  test("collects unique permissions recursively, including missing tags", () => {
    writeFileSync(path.join(directory, "a.yaml"), "stimuli:\n  - tags: {azurePermission: read}\n  - name: default\n");
    mkdirSync(path.join(directory, "nested"));
    writeFileSync(path.join(directory, "nested/b.yaml"), "stimuli:\n  - tags: {azurePermission: read}\n  - tags: {azurePermission: none}\n");
    writeFileSync(path.join(directory, "ignored.yml"), "stimuli:\n  - tags: {azurePermission: ignored}\n");

    expect(discoverAzurePermissions(directory)).toEqual(["read", "", "none"]);
  });

  test("discards entire files with invalid YAML or stimuli shapes", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const invalidSuites = [
      "stimuli: [",
      "resources: []",
      "stimuli: {}",
      "stimuli: [null]",
      "stimuli:\n  - tags: {azurePermission: discarded}\n  - tags: {azurePermission: 123}\n",
      "stimuli:\n  - tags: null\n",
    ];
    invalidSuites.forEach((suite, index) => {
      writeFileSync(path.join(directory, `${index}.yaml`), suite);
    });

    expect(discoverAzurePermissions(directory)).toEqual([]);
    expect(warning).toHaveBeenCalledTimes(invalidSuites.length);
  });

  test("returns an empty array when no stimuli exist", () => {
    expect(discoverAzurePermissions(directory)).toEqual([]);
    writeFileSync(path.join(directory, "empty.yaml"), "stimuli: []");
    expect(discoverAzurePermissions(directory)).toEqual([]);
  });

  test("fails when the eval directory is missing", () => {
    expect(() => discoverAzurePermissions(path.join(directory, "missing"))).toThrow();
  });

  test("builds only discovered permission jobs and skips azure-deploy", () => {
    const evalDir = path.join(directory, "evals/plugin/skill");
    mkdirSync(evalDir, { recursive: true });
    writeFileSync(path.join(evalDir, "eval.yaml"), "stimuli:\n  - tags: {azurePermission: read}\n  - name: default\n");
    expect(buildPermissionMatrices(directory, ["plugin/skill", "plugin/skill", "azure-skills/azure-deploy"]))
      .toEqual({
        read: ["plugin/skill"],
        none: [],
        default: ["plugin/skill"],
        report: [{ skill: "plugin/skill", permissions: ["read", ""] }],
      });
    expect(() => buildPermissionMatrices(directory, ["../skill"])).toThrow("Invalid plugin/skill");
    writeFileSync(path.join(evalDir, "eval.yaml"), "stimuli:\n  - tags: {azurePermission: write}\n");
    expect(() => buildPermissionMatrices(directory, ["plugin/skill"])).toThrow("Unsupported Azure permission");
  });

  test("writes the JSON permissions step output", () => {
    const evalDir = path.join(directory, "evals/plugin/skill");
    mkdirSync(evalDir, { recursive: true });
    writeFileSync(path.join(evalDir, "eval.yaml"), "stimuli:\n  - tags: {azurePermission: read}\n  - name: default\n");
    const output = path.join(directory, "output");
    const result = spawnSync(process.execPath, [
      "--import", "tsx", fileURLToPath(new URL("../discover-azure-permissions.ts", import.meta.url)),
    ], {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      env: {
        ...process.env,
        GITHUB_WORKSPACE: directory,
        PLUGIN_DIR: "plugin",
        SKILL_NAME: "skill",
        GITHUB_OUTPUT: output,
      },
      encoding: "utf8",
    });

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(readFileSync(output, "utf8")).toBe('permissions=["read",""]\n');
  });
});
