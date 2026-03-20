/**
 * Tests for the frontmatter dashboard collector.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CategoryReport } from "../../schema.js";
import { parseFrontmatterJson } from "../../collectors/frontmatter.js";

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function makeFrontmatterJson(overrides?: {
  skills?: Array<{
    name: string;
    path: string;
    status: "pass" | "fail" | "warn";
    errors: string[];
    warnings: string[];
    checks: Record<string, boolean>;
  }>;
  summary?: { total: number; passed: number; failed: number; warnings: number };
}) {
  const defaults = {
    skills: [
      {
        name: "skill-a",
        path: "plugin/skills/skill-a/SKILL.md",
        status: "pass" as const,
        errors: [],
        warnings: [],
        checks: { "name-format": true, "description-format": true },
      },
      {
        name: "skill-b",
        path: "plugin/skills/skill-b/SKILL.md",
        status: "pass" as const,
        errors: [],
        warnings: [],
        checks: { "name-format": true, "description-format": true },
      },
    ],
    summary: { total: 2, passed: 2, failed: 0, warnings: 0 },
  };

  return JSON.stringify({ ...defaults, ...overrides });
}

// ---------------------------------------------------------------------------
// parseFrontmatterJson (pure function — no mocks needed)
// ---------------------------------------------------------------------------

describe("parseFrontmatterJson", () => {
  it("maps all-passing skills to status pass", () => {
    const raw = makeFrontmatterJson();
    const report = parseFrontmatterJson(raw);

    expect(report.status).toBe("pass");
    expect(report.summary.total).toBe(2);
    expect(report.summary.passed).toBe(2);
    expect(report.summary.failed).toBe(0);
    expect(report.items).toHaveLength(2);
    expect(report.items[0].name).toBe("skill-a");
    expect(report.items[0].status).toBe("pass");
    expect(report.items[0].message).toBeUndefined();
  });

  it("maps failing skills to status fail", () => {
    const raw = makeFrontmatterJson({
      skills: [
        {
          name: "bad-skill",
          path: "plugin/skills/bad-skill/SKILL.md",
          status: "fail",
          errors: ["[name-format] name uses uppercase"],
          warnings: [],
          checks: { "name-format": false, "description-format": true },
        },
      ],
      summary: { total: 1, passed: 0, failed: 1, warnings: 0 },
    });

    const report = parseFrontmatterJson(raw);

    expect(report.status).toBe("fail");
    expect(report.summary.failed).toBe(1);
    expect(report.items).toHaveLength(1);
    expect(report.items[0].status).toBe("fail");
    expect(report.items[0].message).toContain("name uses uppercase");
  });

  it("maps warning-only skills to status warn", () => {
    const raw = makeFrontmatterJson({
      skills: [
        {
          name: "warn-skill",
          path: "plugin/skills/warn-skill/SKILL.md",
          status: "warn",
          errors: [],
          warnings: ["[description-length] description is very long"],
          checks: { "name-format": true, "description-length": false },
        },
      ],
      summary: { total: 1, passed: 0, failed: 0, warnings: 1 },
    });

    const report = parseFrontmatterJson(raw);

    expect(report.status).toBe("warn");
    expect(report.summary.warnings).toBe(1);
    expect(report.items[0].status).toBe("warn");
    expect(report.items[0].message).toContain("description is very long");
  });

  it("joins multiple errors and warnings into one message", () => {
    const raw = makeFrontmatterJson({
      skills: [
        {
          name: "multi-issue",
          path: "plugin/skills/multi-issue/SKILL.md",
          status: "fail",
          errors: ["[name-format] bad name", "[no-xml-tags] has XML"],
          warnings: ["[description-length] too long"],
          checks: {},
        },
      ],
      summary: { total: 1, passed: 0, failed: 1, warnings: 0 },
    });

    const report = parseFrontmatterJson(raw);

    expect(report.items[0].message).toContain("bad name");
    expect(report.items[0].message).toContain("has XML");
    expect(report.items[0].message).toContain("too long");
  });

  it("populates metadata with error/warning/check counts", () => {
    const raw = makeFrontmatterJson({
      skills: [
        {
          name: "counted",
          path: "plugin/skills/counted/SKILL.md",
          status: "fail",
          errors: ["err1", "err2"],
          warnings: ["warn1"],
          checks: { a: true, b: false, c: true },
        },
      ],
      summary: { total: 1, passed: 0, failed: 1, warnings: 0 },
    });

    const report = parseFrontmatterJson(raw);
    const meta = report.items[0].metadata;

    expect(meta).toBeDefined();
    expect(meta!.errors).toBe(2);
    expect(meta!.warnings).toBe(1);
    expect(meta!.checks).toBe(3);
  });

  it("sets skipped to 0 in summary", () => {
    const report = parseFrontmatterJson(makeFrontmatterJson());
    expect(report.summary.skipped).toBe(0);
  });

  it("includes collectorVersion and collectedAt", () => {
    const report = parseFrontmatterJson(makeFrontmatterJson());
    expect(report.collectorVersion).toMatch(/^\d+\.\d+\.\d+/);
    expect(report.collectedAt).toBeTruthy();
    // Verify collectedAt is a valid ISO date
    expect(new Date(report.collectedAt).getTime()).not.toBeNaN();
  });
});

// ---------------------------------------------------------------------------
// frontmatterCollector.collect (requires mocking execSync)
// ---------------------------------------------------------------------------

describe("frontmatterCollector.collect", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns a valid CategoryReport from CLI output", async () => {
    const jsonOutput = makeFrontmatterJson();

    vi.doMock("node:child_process", () => ({
      execSync: () => jsonOutput,
    }));

    const { frontmatterCollector } = await import(
      "../../collectors/frontmatter.js"
    );

    const report: CategoryReport = await frontmatterCollector.collect({
      cwd: "/fake",
      timeout: 5000,
    });

    expect(report.status).toBe("pass");
    expect(report.items).toHaveLength(2);
  });

  it("handles non-zero exit with valid JSON stdout", async () => {
    const jsonOutput = makeFrontmatterJson({
      skills: [
        {
          name: "fail-skill",
          path: "plugin/skills/fail-skill/SKILL.md",
          status: "fail",
          errors: ["problem"],
          warnings: [],
          checks: {},
        },
      ],
      summary: { total: 1, passed: 0, failed: 1, warnings: 0 },
    });

    vi.doMock("node:child_process", () => ({
      execSync: () => {
        const err = new Error("exit code 1") as Error & { stdout: string };
        err.stdout = jsonOutput;
        throw err;
      },
    }));

    const { frontmatterCollector } = await import(
      "../../collectors/frontmatter.js"
    );

    const report = await frontmatterCollector.collect({
      cwd: "/fake",
      timeout: 5000,
    });

    expect(report.status).toBe("fail");
    expect(report.items).toHaveLength(1);
  });

  it("returns skip when CLI is not found", async () => {
    vi.doMock("node:child_process", () => ({
      execSync: () => {
        throw new Error("ENOENT: npm not found");
      },
    }));

    const { frontmatterCollector } = await import(
      "../../collectors/frontmatter.js"
    );

    const report = await frontmatterCollector.collect({
      cwd: "/fake",
      timeout: 5000,
    });

    expect(report.status).toBe("skip");
    expect(report.summary.total).toBe(0);
  });
});
