/**
 * Tests for the coverage summary collector.
 */

import { vi, describe, it, expect, beforeEach } from "vitest";
import { readFile } from "node:fs/promises";
import coverageCollector from "../../collectors/coverage.js";
import type { CollectorOptions } from "../../schema.js";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}));

const mockReadFile = readFile as unknown as ReturnType<typeof vi.fn>;

const defaultOptions: CollectorOptions = {
  cwd: "/repo",
  timeout: 30_000,
};

// -- Test helpers -----------------------------------------------------------

/** Build a valid `coverage-summary.json` with uniform percentages. */
function makeCoverageSummary(pct: number): string {
  const metric = (p: number) => ({
    total: 100,
    covered: p,
    skipped: 0,
    pct: p,
  });
  return JSON.stringify({
    total: {
      statements: metric(pct),
      branches: metric(pct),
      functions: metric(pct),
      lines: metric(pct),
    },
  });
}

/** Build a coverage summary with distinct percentages per metric. */
function makeMixedCoverage(
  stmts: number,
  branches: number,
  fns: number,
  lines: number,
): string {
  const metric = (p: number) => ({
    total: 100,
    covered: p,
    skipped: 0,
    pct: p,
  });
  return JSON.stringify({
    total: {
      statements: metric(stmts),
      branches: metric(branches),
      functions: metric(fns),
      lines: metric(lines),
    },
  });
}

// ---------------------------------------------------------------------------
// coverageCollector
// ---------------------------------------------------------------------------

describe("coverageCollector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has correct name and version", () => {
    expect(coverageCollector.name).toBe("coverage");
    expect(coverageCollector.version).toBe("1.0.0");
  });

  it("returns skip when no coverage files exist", async () => {
    mockReadFile.mockRejectedValue(new Error("ENOENT"));

    const report = await coverageCollector.collect(defaultOptions);

    expect(report.status).toBe("skip");
    expect(report.items[0].message).toContain("No coverage-summary.json");
  });

  it("returns pass for high coverage in both sources", async () => {
    mockReadFile
      .mockResolvedValueOnce(makeCoverageSummary(90))
      .mockResolvedValueOnce(makeCoverageSummary(85));

    const report = await coverageCollector.collect(defaultOptions);

    expect(report.status).toBe("pass");
    expect(report.items).toHaveLength(2);
    expect(report.items[0].name).toBe("tests");
    expect(report.items[0].status).toBe("pass");
    expect(report.items[1].name).toBe("scripts");
    expect(report.items[1].status).toBe("pass");
    expect(report.summary.total).toBe(2);
    expect(report.summary.passed).toBe(2);
  });

  it("returns warn when coverage is below 80% but above 50%", async () => {
    mockReadFile
      .mockResolvedValueOnce(makeCoverageSummary(75))
      .mockRejectedValueOnce(new Error("ENOENT"));

    const report = await coverageCollector.collect(defaultOptions);

    expect(report.status).toBe("warn");
    expect(report.items).toHaveLength(1);
    expect(report.items[0].status).toBe("warn");
    expect(report.summary.warnings).toBe(1);
  });

  it("returns fail when coverage is below 50%", async () => {
    mockReadFile
      .mockResolvedValueOnce(makeCoverageSummary(40))
      .mockRejectedValueOnce(new Error("ENOENT"));

    const report = await coverageCollector.collect(defaultOptions);

    expect(report.status).toBe("fail");
    expect(report.items[0].status).toBe("fail");
    expect(report.summary.failed).toBe(1);
  });

  it("skips files that fail to parse as JSON", async () => {
    mockReadFile
      .mockResolvedValueOnce("not json {{{")
      .mockResolvedValueOnce(makeCoverageSummary(90));

    const report = await coverageCollector.collect(defaultOptions);

    expect(report.status).toBe("pass");
    expect(report.items).toHaveLength(1);
    expect(report.items[0].name).toBe("scripts");
  });

  it("includes correct metadata percentages", async () => {
    mockReadFile
      .mockResolvedValueOnce(makeMixedCoverage(95, 85, 90, 92))
      .mockRejectedValueOnce(new Error("ENOENT"));

    const report = await coverageCollector.collect(defaultOptions);

    expect(report.items[0].metadata).toEqual({
      statements: 95,
      branches: 85,
      functions: 90,
      lines: 92,
    });
  });

  it("handles only the second file existing", async () => {
    mockReadFile
      .mockRejectedValueOnce(new Error("ENOENT"))
      .mockResolvedValueOnce(makeCoverageSummary(88));

    const report = await coverageCollector.collect(defaultOptions);

    expect(report.status).toBe("pass");
    expect(report.items).toHaveLength(1);
    expect(report.items[0].name).toBe("scripts");
  });

  it("uses worst status across multiple sources", async () => {
    mockReadFile
      .mockResolvedValueOnce(makeCoverageSummary(90))
      .mockResolvedValueOnce(makeCoverageSummary(45));

    const report = await coverageCollector.collect(defaultOptions);

    expect(report.status).toBe("fail");
    expect(report.summary.passed).toBe(1);
    expect(report.summary.failed).toBe(1);
  });

  it("returns valid collectorVersion and collectedAt", async () => {
    mockReadFile.mockRejectedValue(new Error("ENOENT"));

    const report = await coverageCollector.collect(defaultOptions);

    expect(report.collectorVersion).toBe("1.0.0");
    expect(new Date(report.collectedAt).getTime()).not.toBeNaN();
  });

  it("skips entries without a total property", async () => {
    mockReadFile
      .mockResolvedValueOnce(JSON.stringify({ "/file.ts": {} }))
      .mockRejectedValueOnce(new Error("ENOENT"));

    const report = await coverageCollector.collect(defaultOptions);

    expect(report.status).toBe("skip");
  });
});
