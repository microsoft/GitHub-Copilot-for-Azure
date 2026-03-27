/**
 * Tests for the ESLint lint collector.
 */

import { vi, describe, it, expect, beforeEach } from "vitest";
import { execFile } from "node:child_process";
import lintCollector from "../../collectors/lint.js";
import type { CollectorOptions } from "../../schema.js";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

const mockExecFile = execFile as unknown as ReturnType<typeof vi.fn>;

const defaultOptions: CollectorOptions = {
  cwd: "/repo",
  timeout: 30_000,
};

// -- Test helpers -----------------------------------------------------------

/** Build a single ESLint file result entry. */
function makeEslintResult(
  filePath: string,
  errors: number,
  warnings: number,
  fixableErrors = 0,
  fixableWarnings = 0,
  messages: Array<{
    ruleId: string | null;
    message: string;
    severity: number;
    line: number;
    column: number;
  }> = [],
) {
  return {
    filePath,
    errorCount: errors,
    warningCount: warnings,
    fixableErrorCount: fixableErrors,
    fixableWarningCount: fixableWarnings,
    messages,
  };
}

/** Make mockExecFile call the callback with successful output. */
function mockExecSuccess(stdout: string): void {
  mockExecFile.mockImplementationOnce(
    (
      _cmd: string,
      _args: string[],
      _opts: object,
      callback: (...args: unknown[]) => void,
    ) => {
      callback(null, stdout, "");
      return {};
    },
  );
}

/** Make mockExecFile call the callback with an error but stdout present. */
function mockExecWithErrors(stdout: string): void {
  mockExecFile.mockImplementationOnce(
    (
      _cmd: string,
      _args: string[],
      _opts: object,
      callback: (...args: unknown[]) => void,
    ) => {
      callback(new Error("Process exited with code 1"), stdout, "");
      return {};
    },
  );
}

/** Make mockExecFile simulate a missing command (ENOENT). */
function mockExecNotFound(): void {
  mockExecFile.mockImplementationOnce(
    (
      _cmd: string,
      _args: string[],
      _opts: object,
      callback: (...args: unknown[]) => void,
    ) => {
      callback(
        Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
        "",
        "",
      );
      return {};
    },
  );
}

// ---------------------------------------------------------------------------
// lintCollector
// ---------------------------------------------------------------------------

describe("lintCollector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has correct name and version", () => {
    expect(lintCollector.name).toBe("lint");
    expect(lintCollector.version).toBe("1.0.0");
  });

  it("returns pass when eslint reports no issues", async () => {
    const clean = [makeEslintResult("/repo/scripts/src/index.ts", 0, 0)];
    mockExecSuccess(JSON.stringify(clean));

    const cleanTests = [makeEslintResult("/repo/tests/src/test.ts", 0, 0)];
    mockExecSuccess(JSON.stringify(cleanTests));

    const report = await lintCollector.collect(defaultOptions);

    expect(report.status).toBe("pass");
    expect(report.summary.failed).toBe(0);
    expect(report.summary.warnings).toBe(0);
    expect(report.items.every((i) => i.status === "pass")).toBe(true);
  });

  it("returns fail when eslint reports errors", async () => {
    const withErrors = [
      makeEslintResult("/repo/scripts/src/bad.ts", 3, 1),
      makeEslintResult("/repo/scripts/src/good.ts", 0, 0),
    ];
    mockExecWithErrors(JSON.stringify(withErrors));
    mockExecSuccess(JSON.stringify([]));

    const report = await lintCollector.collect(defaultOptions);

    expect(report.status).toBe("fail");
    expect(report.summary.failed).toBe(1);
    expect(report.items.some((i) => i.status === "fail")).toBe(true);
  });

  it("returns warn when eslint reports only warnings", async () => {
    const withWarnings = [
      makeEslintResult("/repo/scripts/src/warn.ts", 0, 5),
    ];
    mockExecSuccess(JSON.stringify(withWarnings));
    mockExecSuccess(JSON.stringify([]));

    const report = await lintCollector.collect(defaultOptions);

    expect(report.status).toBe("warn");
    expect(report.summary.warnings).toBe(1);
  });

  it("returns skip when eslint is not found in both dirs", async () => {
    mockExecNotFound();
    mockExecNotFound();

    const report = await lintCollector.collect(defaultOptions);

    expect(report.status).toBe("skip");
    expect(report.items[0].message).toContain("no results");
  });

  it("includes correct metadata in items", async () => {
    const results = [
      makeEslintResult("/repo/scripts/src/file.ts", 2, 3, 1, 2),
    ];
    mockExecSuccess(JSON.stringify(results));
    mockExecSuccess(JSON.stringify([]));

    const report = await lintCollector.collect(defaultOptions);
    const item = report.items.find((i) => i.status === "fail");

    expect(item?.metadata?.errors).toBe(2);
    expect(item?.metadata?.warnings).toBe(3);
    expect(item?.metadata?.fixable).toBe(3);
  });

  it("aggregates results from both directories", async () => {
    const scriptsResults = [
      makeEslintResult("/repo/scripts/src/a.ts", 1, 0),
    ];
    const testsResults = [
      makeEslintResult("/repo/tests/src/b.ts", 0, 1),
    ];
    mockExecWithErrors(JSON.stringify(scriptsResults));
    mockExecSuccess(JSON.stringify(testsResults));

    const report = await lintCollector.collect(defaultOptions);

    expect(report.items).toHaveLength(2);
    expect(report.status).toBe("fail");
  });

  it("continues when one directory fails", async () => {
    mockExecNotFound();
    const clean = [makeEslintResult("/repo/tests/src/ok.ts", 0, 0)];
    mockExecSuccess(JSON.stringify(clean));

    const report = await lintCollector.collect(defaultOptions);

    expect(report.status).toBe("pass");
    expect(report.items).toHaveLength(1);
  });

  it("returns valid collectorVersion and collectedAt", async () => {
    const clean = [makeEslintResult("/repo/scripts/src/a.ts", 0, 0)];
    mockExecSuccess(JSON.stringify(clean));
    mockExecSuccess(JSON.stringify([]));

    const report = await lintCollector.collect(defaultOptions);

    expect(report.collectorVersion).toBe("1.0.0");
    expect(new Date(report.collectedAt).getTime()).not.toBeNaN();
  });

  it("handles eslint returning empty arrays for both dirs", async () => {
    mockExecSuccess(JSON.stringify([]));
    mockExecSuccess(JSON.stringify([]));

    const report = await lintCollector.collect(defaultOptions);

    expect(report.status).toBe("skip");
  });

  it("builds item message from ESLint messages", async () => {
    const results = [
      makeEslintResult("/repo/scripts/src/file.ts", 0, 2, 0, 1, [
        {
          ruleId: "no-unused-vars",
          message: "'x' is defined but never used",
          severity: 1,
          line: 5,
          column: 1,
        },
        {
          ruleId: "no-console",
          message: "Unexpected console statement",
          severity: 1,
          line: 10,
          column: 1,
        },
      ]),
    ];
    mockExecSuccess(JSON.stringify(results));
    mockExecSuccess(JSON.stringify([]));

    const report = await lintCollector.collect(defaultOptions);
    const item = report.items[0];

    expect(item.message).toContain("no-unused-vars");
    expect(item.message).toContain("no-console");
  });

  it("truncates message to 3 rules with +N more", async () => {
    const results = [
      makeEslintResult("/repo/scripts/src/many.ts", 4, 1, 0, 0, [
        { ruleId: "rule-a", message: "msg a", severity: 2, line: 1, column: 1 },
        { ruleId: "rule-b", message: "msg b", severity: 2, line: 2, column: 1 },
        { ruleId: "rule-c", message: "msg c", severity: 2, line: 3, column: 1 },
        { ruleId: "rule-d", message: "msg d", severity: 2, line: 4, column: 1 },
        { ruleId: null, message: "no rule", severity: 1, line: 5, column: 1 },
      ]),
    ];
    mockExecWithErrors(JSON.stringify(results));
    mockExecSuccess(JSON.stringify([]));

    const report = await lintCollector.collect(defaultOptions);
    const item = report.items[0];

    expect(item.message).toContain("rule-a");
    expect(item.message).toContain("rule-c");
    expect(item.message).toContain("+1 more");
    expect(item.message).not.toContain("rule-d");
  });

  it("omits message when no messages with ruleId exist", async () => {
    const results = [
      makeEslintResult("/repo/scripts/src/clean.ts", 0, 0),
    ];
    mockExecSuccess(JSON.stringify(results));
    mockExecSuccess(JSON.stringify([]));

    const report = await lintCollector.collect(defaultOptions);
    const item = report.items[0];

    expect(item.message).toBeUndefined();
  });
});
