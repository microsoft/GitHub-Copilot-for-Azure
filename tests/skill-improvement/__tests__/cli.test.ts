import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  loadGitHubDispatchDefaults,
  parseArgs,
  usage,
  validateCommandOptions,
} from "../cli.ts";
import { describe, expect, test } from "vitest";

describe("skill improvement CLI", () => {
  test("documents all supported command entry points", () => {
    expect(usage()).toContain("skill-improvement -- validate");
    expect(usage()).toContain("skill-improvement -- run");
    expect(usage()).toContain("skill-improvement -- execute");
    expect(usage()).toContain("skill-improvement -- prepare-resources");
    expect(usage()).toContain("skill-improvement -- cleanup-resources");
  });

  test("parses the internal execute command with its output directory", () => {
    expect(parseArgs([
      "execute",
      "--config",
      "run.yaml",
      "--baseline-ref",
      "main",
      "--output",
      "artifacts",
    ])).toMatchObject({
      command: "execute",
      config: "run.yaml",
      baselineRef: "main",
      output: "artifacts",
      executor: "local",
    });
  });

  test("requires an explicit output directory for execute", () => {
    const args = parseArgs(["execute", "--config", "run.yaml"]);
    expect(() => validateCommandOptions(args)).toThrow(
      "--output is required for the execute command"
    );
  });

  test("loads GitHub dispatch defaults without expanding CI-only variables", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "skill-improvement-cli-"));
    const configPath = path.join(root, "run.yaml");
    fs.writeFileSync(configPath, [
      "target:",
      "  baselineRef: refinement",
      "resources:",
      "  kusto:",
      "    subscriptionId: ${AZURE_EVALS_SUBSCRIPTION_ID}",
      "    resourceGroup: ${AZURE_EVALS_RESOURCE_GROUP}",
      "output:",
      "  token: ${GH_TOKEN}",
      "",
    ].join("\n"));

    try {
      expect(loadGitHubDispatchDefaults(configPath)).toEqual({
        baselineRef: "refinement",
      });
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
