/**
 * Tests for the references dashboard collector.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CategoryReport } from "../../schema.js";
import { parseReferencesJson } from "../../collectors/references.js";

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function makeReferencesJson(overrides?: {
  references?: Array<{
    source: string;
    target: string;
    status: "valid" | "broken" | "warning";
    message?: string;
  }>;
  summary?: { total: number; valid: number; broken: number; warnings: number };
}) {
  const defaults = {
    references: [],
    summary: { total: 5, valid: 5, broken: 0, warnings: 0 },
  };

  return JSON.stringify({ ...defaults, ...overrides });
}

// ---------------------------------------------------------------------------
// parseReferencesJson (pure function — no mocks needed)
// ---------------------------------------------------------------------------

describe("parseReferencesJson", () => {
  it("maps all-valid references to status pass", () => {
    const raw = makeReferencesJson();
    const report = parseReferencesJson(raw);

    expect(report.status).toBe("pass");
    expect(report.summary.total).toBe(5);
    expect(report.summary.passed).toBe(5);
    expect(report.summary.failed).toBe(0);
    expect(report.items).toHaveLength(0); // no references entries when all valid
  });

  it("maps broken references to status fail", () => {
    const raw = makeReferencesJson({
      references: [
        {
          source: "plugin/skills/foo/SKILL.md",
          target: "./missing.md",
          status: "broken",
          message: "Target does not exist: ./missing.md",
        },
      ],
      summary: { total: 3, valid: 2, broken: 1, warnings: 0 },
    });

    const report = parseReferencesJson(raw);

    expect(report.status).toBe("fail");
    expect(report.summary.failed).toBe(1);
    expect(report.items).toHaveLength(1);
    expect(report.items[0].name).toBe("plugin/skills/foo/SKILL.md");
    expect(report.items[0].status).toBe("fail");
    expect(report.items[0].message).toContain("missing.md");
  });

  it("maps warning references to status warn", () => {
    const raw = makeReferencesJson({
      references: [
        {
          source: "plugin/skills/bar/references/orphan.md",
          target: "bar/SKILL.md",
          status: "warning",
          message: "File exists in references directory but is not linked",
        },
      ],
      summary: { total: 3, valid: 2, broken: 0, warnings: 1 },
    });

    const report = parseReferencesJson(raw);

    expect(report.status).toBe("warn");
    expect(report.summary.warnings).toBe(1);
    expect(report.items[0].status).toBe("warn");
    expect(report.items[0].message).toContain("not linked");
  });

  it("combines target and message in item message", () => {
    const raw = makeReferencesJson({
      references: [
        {
          source: "file.md",
          target: "./ref.md",
          status: "broken",
          message: "Target does not exist",
        },
      ],
      summary: { total: 1, valid: 0, broken: 1, warnings: 0 },
    });

    const report = parseReferencesJson(raw);
    const msg = report.items[0].message!;

    expect(msg).toContain("./ref.md");
    expect(msg).toContain("Target does not exist");
  });

  it("handles references with no message field", () => {
    const raw = makeReferencesJson({
      references: [
        {
          source: "file.md",
          target: "./ref.md",
          status: "broken",
        },
      ],
      summary: { total: 1, valid: 0, broken: 1, warnings: 0 },
    });

    const report = parseReferencesJson(raw);
    expect(report.items[0].message).toBe("./ref.md");
  });

  it("sets skipped to 0 in summary", () => {
    const report = parseReferencesJson(makeReferencesJson());
    expect(report.summary.skipped).toBe(0);
  });

  it("includes collectorVersion and collectedAt", () => {
    const report = parseReferencesJson(makeReferencesJson());
    expect(report.collectorVersion).toMatch(/^\d+\.\d+\.\d+/);
    expect(report.collectedAt).toBeTruthy();
    expect(new Date(report.collectedAt).getTime()).not.toBeNaN();
  });

  it("prefers fail over warn when both broken and warnings exist", () => {
    const raw = makeReferencesJson({
      references: [
        { source: "a.md", target: "./x.md", status: "broken", message: "missing" },
        { source: "b.md", target: "c/SKILL.md", status: "warning", message: "orphan" },
      ],
      summary: { total: 3, valid: 1, broken: 1, warnings: 1 },
    });

    const report = parseReferencesJson(raw);
    expect(report.status).toBe("fail");
  });
});

// ---------------------------------------------------------------------------
// referencesCollector.collect (requires mocking execSync)
// ---------------------------------------------------------------------------

describe("referencesCollector.collect", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns a valid CategoryReport from CLI output", async () => {
    const jsonOutput = makeReferencesJson();

    vi.doMock("node:child_process", () => ({
      execSync: () => jsonOutput,
    }));

    const { referencesCollector } = await import(
      "../../collectors/references.js"
    );

    const report: CategoryReport = await referencesCollector.collect({
      cwd: "/fake",
      timeout: 5000,
    });

    expect(report.status).toBe("pass");
    expect(report.summary.total).toBe(5);
  });

  it("handles non-zero exit with valid JSON stdout", async () => {
    const jsonOutput = makeReferencesJson({
      references: [
        {
          source: "file.md",
          target: "./broken.md",
          status: "broken",
          message: "does not exist",
        },
      ],
      summary: { total: 1, valid: 0, broken: 1, warnings: 0 },
    });

    vi.doMock("node:child_process", () => ({
      execSync: () => {
        const err = new Error("exit code 1") as Error & { stdout: string };
        err.stdout = jsonOutput;
        throw err;
      },
    }));

    const { referencesCollector } = await import(
      "../../collectors/references.js"
    );

    const report = await referencesCollector.collect({
      cwd: "/fake",
      timeout: 5000,
    });

    expect(report.status).toBe("fail");
  });

  it("returns skip when CLI is not found", async () => {
    vi.doMock("node:child_process", () => ({
      execSync: () => {
        throw new Error("ENOENT: npm not found");
      },
    }));

    const { referencesCollector } = await import(
      "../../collectors/references.js"
    );

    const report = await referencesCollector.collect({
      cwd: "/fake",
      timeout: 5000,
    });

    expect(report.status).toBe("skip");
    expect(report.summary.total).toBe(0);
  });
});
