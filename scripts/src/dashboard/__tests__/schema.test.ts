/**
 * Tests for dashboard schema validation
 */

import { describe, it, expect } from "vitest";
import {
  validateDashboardReport,
  validateCategoryReport,
} from "../schema.js";

// -- Test helpers -----------------------------------------------------------

/** Build a valid CategoryReport object for testing. */
function makeValidCategoryReport() {
  return {
    status: "pass",
    summary: {
      total: 10,
      passed: 8,
      failed: 1,
      warnings: 1,
      skipped: 0,
    },
    items: [
      { name: "test-1", status: "pass" },
      { name: "test-2", status: "fail", message: "assertion failed" },
    ],
    collectedAt: "2024-01-15T10:30:00Z",
    collectorVersion: "1.0.0",
  };
}

/** Build a valid DashboardReport object for testing. */
function makeValidDashboardReport() {
  return {
    schema: "dashboard-report/v1",
    generatedAt: "2024-01-15T10:30:00Z",
    branch: "main",
    commit: "a".repeat(40),
    commitMessage: "fix: resolve issue with token counting",
    categories: {
      tests: makeValidCategoryReport(),
    },
  };
}

// ---------------------------------------------------------------------------
// validateDashboardReport
// ---------------------------------------------------------------------------

describe("validateDashboardReport", () => {
  it("returns valid for a correct report", () => {
    const result = validateDashboardReport(makeValidDashboardReport());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("returns valid with empty categories", () => {
    const report = { ...makeValidDashboardReport(), categories: {} };
    const result = validateDashboardReport(report);
    expect(result.valid).toBe(true);
  });

  it("returns valid with empty commit (no-git scenario)", () => {
    const report = { ...makeValidDashboardReport(), commit: "" };
    const result = validateDashboardReport(report);
    expect(result.valid).toBe(true);
  });

  it("returns valid with multiple categories", () => {
    const report = {
      ...makeValidDashboardReport(),
      categories: {
        tests: makeValidCategoryReport(),
        lint: { ...makeValidCategoryReport(), status: "warn" },
        coverage: { ...makeValidCategoryReport(), status: "skip" },
      },
    };
    const result = validateDashboardReport(report);
    expect(result.valid).toBe(true);
  });

  it("returns errors for missing required fields", () => {
    const result = validateDashboardReport({});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes("schema"))).toBe(true);
    expect(result.errors.some((e) => e.includes("generatedAt"))).toBe(true);
    expect(result.errors.some((e) => e.includes("branch"))).toBe(true);
    expect(result.errors.some((e) => e.includes("commit"))).toBe(true);
    expect(result.errors.some((e) => e.includes("commitMessage"))).toBe(true);
    expect(result.errors.some((e) => e.includes("categories"))).toBe(true);
  });

  it("returns error for wrong schema version", () => {
    const report = {
      ...makeValidDashboardReport(),
      schema: "dashboard-report/v2",
    };
    const result = validateDashboardReport(report);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("schema"))).toBe(true);
    expect(
      result.errors.some((e) => e.includes("dashboard-report/v1"))
    ).toBe(true);
  });

  it("returns error for invalid generatedAt date", () => {
    const report = {
      ...makeValidDashboardReport(),
      generatedAt: "not-a-date",
    };
    const result = validateDashboardReport(report);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("generatedAt"))).toBe(true);
  });

  it("returns error for invalid commit SHA (too short)", () => {
    const report = { ...makeValidDashboardReport(), commit: "abc123" };
    const result = validateDashboardReport(report);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("commit"))).toBe(true);
  });

  it("returns error for non-hex commit SHA", () => {
    const report = { ...makeValidDashboardReport(), commit: "z".repeat(40) };
    const result = validateDashboardReport(report);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("commit"))).toBe(true);
  });

  it("returns error when branch is not a string", () => {
    const report = { ...makeValidDashboardReport(), branch: 42 };
    const result = validateDashboardReport(report);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("branch"))).toBe(true);
  });

  it("returns error when commitMessage is not a string", () => {
    const report = { ...makeValidDashboardReport(), commitMessage: 123 };
    const result = validateDashboardReport(report);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("commitMessage"))).toBe(true);
  });

  it("returns error when data is not an object", () => {
    expect(validateDashboardReport(null).valid).toBe(false);
    expect(validateDashboardReport(undefined).valid).toBe(false);
    expect(validateDashboardReport(42).valid).toBe(false);
    expect(validateDashboardReport("string").valid).toBe(false);
    expect(validateDashboardReport([]).valid).toBe(false);
  });

  it("returns error when categories is not an object", () => {
    const report = { ...makeValidDashboardReport(), categories: "bad" };
    const result = validateDashboardReport(report);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("categories"))).toBe(true);
  });

  it("propagates category validation errors", () => {
    const report = {
      ...makeValidDashboardReport(),
      categories: { broken: { status: "invalid" } },
    };
    const result = validateDashboardReport(report);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.includes("categories.broken"))
    ).toBe(true);
  });

  it("accepts extra unknown fields for forward compatibility", () => {
    const report = {
      ...makeValidDashboardReport(),
      futureField: "hello",
      anotherField: 42,
    };
    const result = validateDashboardReport(report);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// validateCategoryReport
// ---------------------------------------------------------------------------

describe("validateCategoryReport", () => {
  it("returns valid for a correct category report", () => {
    const result = validateCategoryReport(makeValidCategoryReport());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("returns valid with empty items array", () => {
    const report = { ...makeValidCategoryReport(), items: [] };
    const result = validateCategoryReport(report);
    expect(result.valid).toBe(true);
  });

  it("accepts all valid status values", () => {
    for (const status of ["pass", "fail", "warn", "skip"]) {
      const report = { ...makeValidCategoryReport(), status };
      const result = validateCategoryReport(report);
      expect(result.valid).toBe(true);
    }
  });

  it("returns errors for missing required fields", () => {
    const result = validateCategoryReport({});
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("status"))).toBe(true);
    expect(result.errors.some((e) => e.includes("summary"))).toBe(true);
    expect(result.errors.some((e) => e.includes("items"))).toBe(true);
    expect(result.errors.some((e) => e.includes("collectedAt"))).toBe(true);
    expect(
      result.errors.some((e) => e.includes("collectorVersion"))
    ).toBe(true);
  });

  it("returns error for invalid status", () => {
    const report = { ...makeValidCategoryReport(), status: "unknown" };
    const result = validateCategoryReport(report);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("status"))).toBe(true);
  });

  it("returns error for negative summary numbers", () => {
    const report = {
      ...makeValidCategoryReport(),
      summary: { total: -1, passed: 0, failed: 0, warnings: 0, skipped: 0 },
    };
    const result = validateCategoryReport(report);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("summary.total"))).toBe(true);
  });

  it("returns error for non-integer summary numbers", () => {
    const report = {
      ...makeValidCategoryReport(),
      summary: { total: 1.5, passed: 0, failed: 0, warnings: 0, skipped: 0 },
    };
    const result = validateCategoryReport(report);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("summary.total"))).toBe(true);
  });

  it("returns error for missing summary fields", () => {
    const report = {
      ...makeValidCategoryReport(),
      summary: { total: 5 },
    };
    const result = validateCategoryReport(report);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("summary.passed"))).toBe(true);
    expect(result.errors.some((e) => e.includes("summary.failed"))).toBe(true);
  });

  it("returns error when summary is not an object", () => {
    const report = { ...makeValidCategoryReport(), summary: "bad" };
    const result = validateCategoryReport(report);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("summary"))).toBe(true);
  });

  it("returns error for invalid collectedAt date", () => {
    const report = {
      ...makeValidCategoryReport(),
      collectedAt: "bad-date",
    };
    const result = validateCategoryReport(report);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("collectedAt"))).toBe(true);
  });

  it("returns error for invalid collectorVersion (not semver)", () => {
    const report = {
      ...makeValidCategoryReport(),
      collectorVersion: "not-semver",
    };
    const result = validateCategoryReport(report);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.includes("collectorVersion"))
    ).toBe(true);
  });

  it("returns error for non-string collectorVersion", () => {
    const report = { ...makeValidCategoryReport(), collectorVersion: 123 };
    const result = validateCategoryReport(report);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.includes("collectorVersion"))
    ).toBe(true);
  });

  it("validates item name is a string", () => {
    const report = {
      ...makeValidCategoryReport(),
      items: [{ name: 42, status: "pass" }],
    };
    const result = validateCategoryReport(report);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("items[0].name"))).toBe(true);
  });

  it("validates item status values", () => {
    const report = {
      ...makeValidCategoryReport(),
      items: [{ name: "bad-item", status: "oops" }],
    };
    const result = validateCategoryReport(report);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.includes("items[0].status"))
    ).toBe(true);
  });

  it("validates item message is a string when present", () => {
    const report = {
      ...makeValidCategoryReport(),
      items: [{ name: "item", status: "pass", message: 123 }],
    };
    const result = validateCategoryReport(report);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.includes("items[0].message"))
    ).toBe(true);
  });

  it("validates item metadata value types", () => {
    const report = {
      ...makeValidCategoryReport(),
      items: [
        {
          name: "item",
          status: "pass",
          metadata: { nested: { bad: true } },
        },
      ],
    };
    const result = validateCategoryReport(report);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.includes("metadata.nested"))
    ).toBe(true);
  });

  it("accepts valid metadata value types", () => {
    const report = {
      ...makeValidCategoryReport(),
      items: [
        {
          name: "item",
          status: "pass",
          metadata: { str: "hello", num: 42, bool: true },
        },
      ],
    };
    const result = validateCategoryReport(report);
    expect(result.valid).toBe(true);
  });

  it("validates item metadata is an object when present", () => {
    const report = {
      ...makeValidCategoryReport(),
      items: [{ name: "item", status: "pass", metadata: "bad" }],
    };
    const result = validateCategoryReport(report);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.includes("metadata"))
    ).toBe(true);
  });

  it("returns error when items is not an array", () => {
    const report = { ...makeValidCategoryReport(), items: "bad" };
    const result = validateCategoryReport(report);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("items"))).toBe(true);
  });

  it("returns error when item is not an object", () => {
    const report = { ...makeValidCategoryReport(), items: ["bad"] };
    const result = validateCategoryReport(report);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("items[0]"))).toBe(true);
  });

  it("returns error when data is not an object", () => {
    expect(validateCategoryReport(null).valid).toBe(false);
    expect(validateCategoryReport(undefined).valid).toBe(false);
    expect(validateCategoryReport("string").valid).toBe(false);
    expect(validateCategoryReport(42).valid).toBe(false);
    expect(validateCategoryReport([]).valid).toBe(false);
  });

  it("accepts extra unknown fields for forward compatibility", () => {
    const report = { ...makeValidCategoryReport(), futureFlag: true };
    const result = validateCategoryReport(report);
    expect(result.valid).toBe(true);
  });
});
