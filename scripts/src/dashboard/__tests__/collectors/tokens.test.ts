/**
 * Tests for the Tokens dashboard collector.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { CollectorOptions } from "../../schema.js";
import type { ValidationReport } from "../../../tokens/commands/types.js";

// Mock child_process so the tokens CLI is never actually spawned.
vi.mock("node:child_process");

import { tokensCollector, tryParseReport } from "../../collectors/tokens.js";
import { exec } from "node:child_process";

const mockedExec = vi.mocked(exec);

function defaultOptions(overrides?: Partial<CollectorOptions>): CollectorOptions {
  return {
    cwd: "/repo",
    timeout: 60_000,
    ...overrides,
  };
}

/** Build a sample ValidationReport matching the real tokens CLI output shape. */
function makeSampleReport(
  results: ValidationReport["results"] = [],
): ValidationReport {
  return {
    timestamp: "2024-06-01T12:00:00.000Z",
    totalFiles: results.length,
    exceededCount: results.filter((r) => r.exceeded).length,
    results,
  };
}

function reportAsStdout(report: ValidationReport): string {
  // Simulate npm log lines before JSON, like the real CLI does.
  return [
    "> @github-copilot-for-azure/scripts@1.0.0 tokens",
    "> node --import tsx src/tokens/cli.ts check --json",
    "",
    JSON.stringify(report, null, 2),
  ].join("\n");
}

// ---------------------------------------------------------------------------
// tryParseReport
// ---------------------------------------------------------------------------

describe("tryParseReport", () => {
  it("parses valid JSON from stdout with npm prefix lines", () => {
    const report = makeSampleReport([
      { file: "SKILL.md", tokens: 400, limit: 500, exceeded: false, pattern: "SKILL.md" },
    ]);
    const result = tryParseReport(reportAsStdout(report));
    expect(result).not.toBeNull();
    expect(result!.totalFiles).toBe(1);
    expect(result!.results[0].file).toBe("SKILL.md");
  });

  it("returns null for non-JSON output", () => {
    expect(tryParseReport("just some text\nno json here")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(tryParseReport("")).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    expect(tryParseReport("{ broken json")).toBeNull();
  });

  it("returns null when JSON lacks required fields", () => {
    expect(tryParseReport('{ "foo": "bar" }')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// tokensCollector.collect
// ---------------------------------------------------------------------------

describe("tokensCollector", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date("2024-06-01T12:00:00Z") });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('has name "tokens"', () => {
    expect(tokensCollector.name).toBe("tokens");
  });

  it("has a semver version", () => {
    expect(tokensCollector.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("returns pass when all files are within limits", async () => {
    const report = makeSampleReport([
      { file: "SKILL.md", tokens: 300, limit: 500, exceeded: false, pattern: "SKILL.md" },
      { file: "README.md", tokens: 200, limit: 2000, exceeded: false, pattern: "*.md" },
    ]);

    mockedExec.mockImplementation((_cmd, _opts, callback) => {
      (callback as (err: Error | null, stdout: string, stderr: string) => void)(
        null,
        reportAsStdout(report),
        "",
      );
      return {} as ReturnType<typeof exec>;
    });

    const result = await tokensCollector.collect(defaultOptions());

    expect(result.status).toBe("pass");
    expect(result.items).toHaveLength(2);
    expect(result.items.every((i) => i.status === "pass")).toBe(true);
    expect(result.summary.passed).toBe(2);
    expect(result.summary.failed).toBe(0);
    expect(result.summary.warnings).toBe(0);
  });

  it("returns fail when a file exceeds its limit", async () => {
    const report = makeSampleReport([
      { file: "SKILL.md", tokens: 800, limit: 500, exceeded: true, pattern: "SKILL.md" },
      { file: "README.md", tokens: 200, limit: 2000, exceeded: false, pattern: "*.md" },
    ]);

    mockedExec.mockImplementation((_cmd, _opts, callback) => {
      (callback as (err: Error | null, stdout: string, stderr: string) => void)(
        null,
        reportAsStdout(report),
        "",
      );
      return {} as ReturnType<typeof exec>;
    });

    const result = await tokensCollector.collect(defaultOptions());

    expect(result.status).toBe("fail");
    expect(result.summary.failed).toBe(1);
    expect(result.summary.passed).toBe(1);

    const failItem = result.items.find((i) => i.name === "SKILL.md")!;
    expect(failItem.status).toBe("fail");
    expect(failItem.metadata?.tokenCount).toBe(800);
    expect(failItem.metadata?.limit).toBe(500);
    expect(failItem.metadata?.percentUsed).toBe(160);
    expect(failItem.message).toContain("Exceeded token limit");
  });

  it("returns warn when a file is above 80% of limit", async () => {
    // 85% usage: 425 / 500 = 0.85 > 0.8 threshold
    const report = makeSampleReport([
      { file: "SKILL.md", tokens: 425, limit: 500, exceeded: false, pattern: "SKILL.md" },
    ]);

    mockedExec.mockImplementation((_cmd, _opts, callback) => {
      (callback as (err: Error | null, stdout: string, stderr: string) => void)(
        null,
        reportAsStdout(report),
        "",
      );
      return {} as ReturnType<typeof exec>;
    });

    const result = await tokensCollector.collect(defaultOptions());

    expect(result.status).toBe("warn");
    expect(result.summary.warnings).toBe(1);
    expect(result.items[0].status).toBe("warn");
    expect(result.items[0].message).toContain("Approaching token limit");
  });

  it("returns skip when tokens CLI is not available (ENOENT)", async () => {
    mockedExec.mockImplementation((_cmd, _opts, callback) => {
      const err = new Error("Command not found") as NodeJS.ErrnoException;
      err.code = "ENOENT";
      (callback as (err: Error | null, stdout: string, stderr: string) => void)(
        err,
        "",
        "",
      );
      return {} as ReturnType<typeof exec>;
    });

    const result = await tokensCollector.collect(defaultOptions());

    expect(result.status).toBe("skip");
    expect(result.items).toHaveLength(0);
    expect(result.summary.total).toBe(0);
  });

  it("returns skip when tokens CLI times out", async () => {
    mockedExec.mockImplementation((_cmd, _opts, callback) => {
      const err = new Error("Timed out") as Error & {
        killed?: boolean;
        code?: string;
      };
      err.killed = true;
      (callback as (err: Error | null, stdout: string, stderr: string) => void)(
        err,
        "",
        "",
      );
      return {} as ReturnType<typeof exec>;
    });

    const result = await tokensCollector.collect(defaultOptions());

    expect(result.status).toBe("skip");
    expect(result.items).toHaveLength(0);
  });

  it("handles npm non-zero exit when stdout contains valid JSON", async () => {
    const report = makeSampleReport([
      { file: "big.md", tokens: 3000, limit: 2000, exceeded: true, pattern: "*.md" },
    ]);

    mockedExec.mockImplementation((_cmd, _opts, callback) => {
      const err = new Error("npm exited with 1") as Error & {
        code?: number;
        killed?: boolean;
      };
      err.code = 1;
      err.killed = false;
      (callback as (err: Error | null, stdout: string, stderr: string) => void)(
        err,
        reportAsStdout(report),
        "",
      );
      return {} as ReturnType<typeof exec>;
    });

    const result = await tokensCollector.collect(defaultOptions());

    expect(result.status).toBe("fail");
    expect(result.items).toHaveLength(1);
    expect(result.items[0].status).toBe("fail");
  });

  it("returns skip when npm errors with no stdout", async () => {
    mockedExec.mockImplementation((_cmd, _opts, callback) => {
      const err = new Error("Unknown error") as Error & {
        code?: string;
        killed?: boolean;
      };
      err.code = "UNKNOWN";
      err.killed = false;
      (callback as (err: Error | null, stdout: string, stderr: string) => void)(
        err,
        "",
        "some error",
      );
      return {} as ReturnType<typeof exec>;
    });

    const result = await tokensCollector.collect(defaultOptions());

    expect(result.status).toBe("skip");
  });

  it("metadata includes pattern from token result", async () => {
    const report = makeSampleReport([
      { file: "SKILL.md", tokens: 300, limit: 500, exceeded: false, pattern: "SKILL.md" },
    ]);

    mockedExec.mockImplementation((_cmd, _opts, callback) => {
      (callback as (err: Error | null, stdout: string, stderr: string) => void)(
        null,
        reportAsStdout(report),
        "",
      );
      return {} as ReturnType<typeof exec>;
    });

    const result = await tokensCollector.collect(defaultOptions());

    expect(result.items[0].metadata?.pattern).toBe("SKILL.md");
  });

  it("report summary counts match items", async () => {
    const report = makeSampleReport([
      { file: "a.md", tokens: 600, limit: 500, exceeded: true, pattern: "SKILL.md" },
      { file: "b.md", tokens: 425, limit: 500, exceeded: false, pattern: "SKILL.md" },
      { file: "c.md", tokens: 100, limit: 2000, exceeded: false, pattern: "*.md" },
    ]);

    mockedExec.mockImplementation((_cmd, _opts, callback) => {
      (callback as (err: Error | null, stdout: string, stderr: string) => void)(
        null,
        reportAsStdout(report),
        "",
      );
      return {} as ReturnType<typeof exec>;
    });

    const result = await tokensCollector.collect(defaultOptions());

    expect(result.summary.total).toBe(3);
    expect(result.summary.failed).toBe(1);
    expect(result.summary.warnings).toBe(1);
    expect(result.summary.passed).toBe(1);
    expect(result.summary.total).toBe(result.items.length);
  });

  it("collectorVersion and collectedAt are set", async () => {
    const report = makeSampleReport([]);
    mockedExec.mockImplementation((_cmd, _opts, callback) => {
      (callback as (err: Error | null, stdout: string, stderr: string) => void)(
        null,
        reportAsStdout(report),
        "",
      );
      return {} as ReturnType<typeof exec>;
    });

    const result = await tokensCollector.collect(defaultOptions());

    expect(result.collectorVersion).toMatch(/^\d+\.\d+\.\d+/);
    expect(result.collectedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
