import { parseArgs, usage, validateCommandOptions } from "../cli.ts";
import { describe, expect, test } from "vitest";

describe("skill improvement CLI", () => {
  test("documents all supported command entry points", () => {
    expect(usage()).toContain("skill-improvement -- validate");
    expect(usage()).toContain("skill-improvement -- run");
    expect(usage()).toContain("skill-improvement -- execute");
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
});
