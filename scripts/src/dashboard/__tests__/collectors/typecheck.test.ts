/**
 * Tests for the TypeCheck dashboard collector.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { CollectorOptions } from "../../schema.js";

// We mock `node:child_process` so tsc is never actually spawned.
vi.mock("node:child_process");

import { typecheckCollector, parseTscOutput } from "../../collectors/typecheck.js";

// Pull out the mocked `exec` so we can control it per-test.
import { exec } from "node:child_process";

const mockedExec = vi.mocked(exec);

function defaultOptions(overrides?: Partial<CollectorOptions>): CollectorOptions {
  return {
    cwd: "/repo",
    timeout: 30_000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// parseTscOutput
// ---------------------------------------------------------------------------

describe("parseTscOutput", () => {
  it("parses a single tsc error line", () => {
    const output =
      "src/index.ts(10,5): error TS2322: Type 'string' is not assignable to type 'number'.\n";
    const errors = parseTscOutput(output);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({
      file: "src/index.ts",
      line: 10,
      column: 5,
      code: "TS2322",
      message: "Type 'string' is not assignable to type 'number'.",
    });
  });

  it("parses multiple error lines", () => {
    const output = [
      "src/a.ts(1,1): error TS1005: ';' expected.",
      "src/b.ts(20,10): error TS2304: Cannot find name 'foo'.",
      "",
    ].join("\n");
    const errors = parseTscOutput(output);
    expect(errors).toHaveLength(2);
    expect(errors[0].code).toBe("TS1005");
    expect(errors[1].code).toBe("TS2304");
  });

  it("ignores non-matching lines (summary, blank)", () => {
    const output = [
      "",
      "Found 2 errors.",
      "src/c.ts(3,7): error TS7006: Parameter 'x' implicitly has an 'any' type.",
      "",
    ].join("\n");
    const errors = parseTscOutput(output);
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe("TS7006");
  });

  it("returns empty array for empty input", () => {
    expect(parseTscOutput("")).toHaveLength(0);
  });

  it("handles Windows-style paths", () => {
    const output =
      "src\\utils\\helpers.ts(5,3): error TS2345: Argument of type 'string' is not assignable.\n";
    const errors = parseTscOutput(output);
    expect(errors).toHaveLength(1);
    expect(errors[0].file).toBe("src\\utils\\helpers.ts");
  });
});

// ---------------------------------------------------------------------------
// typecheckCollector.collect — clean build (exit 0)
// ---------------------------------------------------------------------------

describe("typecheckCollector", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date("2024-06-01T12:00:00Z") });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('has name "typecheck"', () => {
    expect(typecheckCollector.name).toBe("typecheck");
  });

  it("has a semver version", () => {
    expect(typecheckCollector.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("returns pass when tsc exits 0 for all projects", async () => {
    // Both invocations succeed with exit 0.
    mockedExec.mockImplementation((_cmd, _opts, callback) => {
      (callback as (err: Error | null, stdout: string, stderr: string) => void)(
        null,
        "",
        "",
      );
      return {} as ReturnType<typeof exec>;
    });

    const report = await typecheckCollector.collect(defaultOptions());

    expect(report.status).toBe("pass");
    expect(report.items).toHaveLength(0);
    expect(report.summary.failed).toBe(0);
    expect(report.collectorVersion).toMatch(/^\d+\.\d+\.\d+/);
    expect(report.collectedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("returns fail with parsed items when tsc has errors", async () => {
    const tscOutput = [
      "src/foo.ts(10,5): error TS2322: Type 'string' is not assignable to type 'number'.",
      "src/bar.ts(3,1): error TS1005: ';' expected.",
    ].join("\n");

    // First invocation (scripts/) returns errors.
    // Second invocation (tests/) succeeds.
    let callCount = 0;
    mockedExec.mockImplementation((_cmd, _opts, callback) => {
      callCount++;
      if (callCount === 1) {
        const err = new Error("tsc exited with code 2") as Error & {
          code?: number;
          killed?: boolean;
        };
        err.code = 2;
        err.killed = false;
        (callback as (err: Error | null, stdout: string, stderr: string) => void)(
          err,
          tscOutput,
          "",
        );
      } else {
        (callback as (err: Error | null, stdout: string, stderr: string) => void)(
          null,
          "",
          "",
        );
      }
      return {} as ReturnType<typeof exec>;
    });

    const report = await typecheckCollector.collect(defaultOptions());

    expect(report.status).toBe("fail");
    expect(report.items).toHaveLength(2);
    expect(report.summary.failed).toBe(2);
    expect(report.items[0].status).toBe("fail");
    expect(report.items[0].metadata?.code).toBe("TS2322");
    expect(report.items[0].metadata?.line).toBe(10);
    expect(report.items[0].metadata?.column).toBe(5);
    expect(report.items[1].metadata?.code).toBe("TS1005");
  });

  it("returns skip when tsc is not found (ENOENT)", async () => {
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

    const report = await typecheckCollector.collect(defaultOptions());

    expect(report.status).toBe("skip");
    expect(report.items).toHaveLength(0);
  });

  it("returns skip when tsc times out", async () => {
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

    const report = await typecheckCollector.collect(defaultOptions());

    expect(report.status).toBe("skip");
    expect(report.items).toHaveLength(0);
  });

  it("sanitizes error messages", async () => {
    const tscOutput =
      "src/x.ts(1,1): error TS2322: Token ghp_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA leaked.\n";

    mockedExec.mockImplementation((_cmd, _opts, callback) => {
      const err = new Error("tsc errors") as Error & { code?: number; killed?: boolean };
      err.code = 2;
      err.killed = false;
      (callback as (err: Error | null, stdout: string, stderr: string) => void)(
        err,
        tscOutput,
        "",
      );
      return {} as ReturnType<typeof exec>;
    });

    const report = await typecheckCollector.collect(defaultOptions());

    expect(report.items[0].message).not.toContain("ghp_");
    expect(report.items[0].message).toContain("[REDACTED]");
  });

  it("returns skip when tsc errors but stdout is empty", async () => {
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
        "some stderr",
      );
      return {} as ReturnType<typeof exec>;
    });

    const report = await typecheckCollector.collect(defaultOptions());

    expect(report.status).toBe("skip");
  });

  it("report summary counts match items", async () => {
    const tscOutput =
      "src/a.ts(1,1): error TS1005: ';' expected.\n";

    let callCount = 0;
    mockedExec.mockImplementation((_cmd, _opts, callback) => {
      callCount++;
      if (callCount === 1) {
        const err = new Error("errors") as Error & { code?: number; killed?: boolean };
        err.code = 2;
        err.killed = false;
        (callback as (err: Error | null, stdout: string, stderr: string) => void)(
          err,
          tscOutput,
          "",
        );
      } else {
        (callback as (err: Error | null, stdout: string, stderr: string) => void)(
          null,
          "",
          "",
        );
      }
      return {} as ReturnType<typeof exec>;
    });

    const report = await typecheckCollector.collect(defaultOptions());

    expect(report.summary.total).toBe(report.items.length);
    expect(report.summary.failed).toBe(
      report.items.filter((i) => i.status === "fail").length,
    );
  });
});
