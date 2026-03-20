/**
 * Tests for dashboard sanitization utilities
 */

import { describe, it, expect } from "vitest";
import {
  stripHtml,
  redactSecrets,
  truncate,
  normalizeWhitespace,
  sanitize,
  sanitizeCategoryReport,
  sanitizeDashboardReport,
} from "../sanitize.js";
import type { CategoryReport, DashboardReport } from "../schema.js";

// ---------------------------------------------------------------------------
// stripHtml
// ---------------------------------------------------------------------------

describe("stripHtml", () => {
  it("removes script tags", () => {
    expect(stripHtml("<script>alert('xss')</script>")).toBe("alert('xss')");
  });

  it("removes simple tags", () => {
    expect(stripHtml("<b>bold</b>")).toBe("bold");
    expect(stripHtml("<i>italic</i>")).toBe("italic");
  });

  it("handles nested tags", () => {
    expect(stripHtml("<div><span>text</span></div>")).toBe("text");
  });

  it("handles self-closing tags", () => {
    expect(stripHtml("line<br/>break")).toBe("linebreak");
    expect(stripHtml("image<img src='x' />here")).toBe("imagehere");
  });

  it("handles tags with attributes", () => {
    expect(stripHtml('<a href="url">link</a>')).toBe("link");
    expect(stripHtml('<div class="foo" id="bar">text</div>')).toBe("text");
  });

  it("preserves non-HTML text", () => {
    expect(stripHtml("hello world")).toBe("hello world");
    expect(stripHtml("no tags here")).toBe("no tags here");
  });

  it("handles empty input", () => {
    expect(stripHtml("")).toBe("");
  });

  it("handles unclosed tag", () => {
    expect(stripHtml("before<after")).toBe("before");
  });

  it("handles standalone > as text", () => {
    expect(stripHtml("5 > 3")).toBe("5 > 3");
  });

  it("handles multiple tags in sequence", () => {
    expect(stripHtml("<p>one</p><p>two</p>")).toBe("onetwo");
  });
});

// ---------------------------------------------------------------------------
// redactSecrets
// ---------------------------------------------------------------------------

describe("redactSecrets", () => {
  it("redacts GitHub personal access tokens", () => {
    const token = "ghp_" + "A".repeat(36);
    expect(redactSecrets(`token: ${token}`)).toBe("token: [REDACTED]");
  });

  it("redacts GitHub server tokens", () => {
    const token = "ghs_" + "B".repeat(36);
    expect(redactSecrets(token)).toBe("[REDACTED]");
  });

  it("redacts GitHub OAuth tokens", () => {
    const token = "gho_" + "C".repeat(36);
    expect(redactSecrets(token)).toBe("[REDACTED]");
  });

  it("redacts GitHub fine-grained PATs", () => {
    const token = "github_pat_" + "D".repeat(22);
    expect(redactSecrets(token)).toBe("[REDACTED]");
  });

  it("redacts OpenAI/Stripe keys", () => {
    const key = "sk-" + "x".repeat(24);
    expect(redactSecrets(`API key: ${key}`)).toBe("API key: [REDACTED]");
  });

  it("redacts AWS access keys", () => {
    expect(redactSecrets("AKIAIOSFODNN7EXAMPLE")).toBe("[REDACTED]");
  });

  it("redacts AccountKey in connection strings", () => {
    const conn =
      "AccountName=myaccount;AccountKey=abc123def456ghi789;EndpointSuffix=core";
    const result = redactSecrets(conn);
    expect(result).toContain("AccountKey=[REDACTED]");
    expect(result).not.toContain("abc123def456ghi789");
  });

  it("redacts SharedAccessKey", () => {
    const input = "SharedAccessKey=mysupersecretkey123";
    const result = redactSecrets(input);
    expect(result).toContain("SharedAccessKey=[REDACTED]");
    expect(result).not.toContain("mysupersecretkey123");
  });

  it("redacts Password in connection strings", () => {
    const input = "Server=myserver;Password=secret123;User=admin";
    const result = redactSecrets(input);
    expect(result).toContain("Password=[REDACTED]");
    expect(result).not.toContain("secret123");
  });

  it("redacts generic secret key=value patterns", () => {
    expect(redactSecrets("api_key=my_secret_value")).toContain("[REDACTED]");
    expect(redactSecrets("my_secret=hunter2")).toContain("[REDACTED]");
    expect(redactSecrets("auth_token=abc123xyz")).toContain("[REDACTED]");
  });

  it("redacts key:value with colon separator", () => {
    expect(redactSecrets("credential: longvalue123")).toContain("[REDACTED]");
  });

  it("preserves non-secret text", () => {
    const text = "This is a normal log message with no secrets.";
    expect(redactSecrets(text)).toBe(text);
  });

  it("preserves short values that are unlikely secrets", () => {
    const text = "key=ab";
    expect(redactSecrets(text)).toBe(text);
  });

  it("handles multiple secrets in one string", () => {
    const ghp = "ghp_" + "X".repeat(36);
    const input = `token: ${ghp}, Password=secret123`;
    const result = redactSecrets(input);
    expect(result).not.toContain(ghp);
    expect(result).not.toContain("secret123");
  });
});

// ---------------------------------------------------------------------------
// truncate
// ---------------------------------------------------------------------------

describe("truncate", () => {
  it("does not truncate strings at exactly maxLength", () => {
    const input = "a".repeat(500);
    expect(truncate(input)).toBe(input);
    expect(truncate(input).length).toBe(500);
  });

  it("truncates strings longer than maxLength", () => {
    const input = "a".repeat(501);
    const result = truncate(input);
    expect(result).toBe("a".repeat(500) + "...");
    expect(result.length).toBe(503);
  });

  it("does not truncate strings shorter than maxLength", () => {
    const input = "a".repeat(499);
    expect(truncate(input)).toBe(input);
    expect(truncate(input).length).toBe(499);
  });

  it("uses default maxLength of 500", () => {
    const input = "a".repeat(600);
    const result = truncate(input);
    expect(result).toBe("a".repeat(500) + "...");
  });

  it("supports custom maxLength", () => {
    const input = "hello world";
    expect(truncate(input, 5)).toBe("hello...");
  });

  it("handles empty input", () => {
    expect(truncate("")).toBe("");
  });

  it("does not truncate when length equals maxLength exactly", () => {
    const input = "a".repeat(10);
    expect(truncate(input, 10)).toBe(input);
  });
});

// ---------------------------------------------------------------------------
// normalizeWhitespace
// ---------------------------------------------------------------------------

describe("normalizeWhitespace", () => {
  it("collapses multiple spaces", () => {
    expect(normalizeWhitespace("a   b")).toBe("a b");
  });

  it("collapses newlines and tabs to single space", () => {
    expect(normalizeWhitespace("a\n\n  \tb")).toBe("a b");
  });

  it("trims leading and trailing whitespace", () => {
    expect(normalizeWhitespace("  hello  ")).toBe("hello");
  });

  it("handles mixed whitespace types", () => {
    expect(normalizeWhitespace("a\r\n\t  b\n\nc")).toBe("a b c");
  });

  it("handles empty input", () => {
    expect(normalizeWhitespace("")).toBe("");
  });

  it("handles only whitespace", () => {
    expect(normalizeWhitespace("   \n\t  ")).toBe("");
  });

  it("preserves single spaces", () => {
    expect(normalizeWhitespace("a b c")).toBe("a b c");
  });
});

// ---------------------------------------------------------------------------
// sanitize (full pipeline)
// ---------------------------------------------------------------------------

describe("sanitize", () => {
  it("applies all steps in order: stripHtml → redactSecrets → truncate → normalize", () => {
    const ghp = "ghp_" + "A".repeat(36);
    const input = `<b>${ghp}</b>  \n  extra`;
    const result = sanitize(input);
    // HTML stripped, token redacted, whitespace normalized
    expect(result).not.toContain("<b>");
    expect(result).not.toContain("ghp_");
    expect(result).toContain("[REDACTED]");
    expect(result).not.toContain("\n");
  });

  it("truncates long input", () => {
    const input = "a".repeat(600);
    const result = sanitize(input);
    expect(result.length).toBeLessThanOrEqual(503);
  });

  it("supports custom maxLength", () => {
    const input = "a".repeat(50);
    const result = sanitize(input, 10);
    expect(result).toBe("a".repeat(10) + "...");
  });

  it("returns clean text unchanged", () => {
    expect(sanitize("Normal clean text")).toBe("Normal clean text");
  });

  it("handles empty input", () => {
    expect(sanitize("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// sanitizeCategoryReport
// ---------------------------------------------------------------------------

describe("sanitizeCategoryReport", () => {
  function makeReport(
    items: { name: string; status: string; message?: string }[]
  ): CategoryReport {
    return {
      status: "pass",
      summary: {
        total: items.length,
        passed: items.length,
        failed: 0,
        warnings: 0,
        skipped: 0,
      },
      items: items as CategoryReport["items"],
      collectedAt: "2024-01-15T10:30:00Z",
      collectorVersion: "1.0.0",
    };
  }

  it("sanitizes all item messages", () => {
    const report = makeReport([
      { name: "test-1", status: "pass" },
      {
        name: "test-2",
        status: "fail",
        message: "<script>alert('xss')</script>",
      },
    ]);
    const result = sanitizeCategoryReport(report);
    expect(result.items[1].message).not.toContain("<script>");
    expect(result.items[1].message).toBe("alert('xss')");
  });

  it("preserves items without messages", () => {
    const report = makeReport([{ name: "test-1", status: "pass" }]);
    const result = sanitizeCategoryReport(report);
    expect(result.items[0].message).toBeUndefined();
  });

  it("redacts secrets in item messages", () => {
    const token = "ghp_" + "Z".repeat(36);
    const report = makeReport([
      { name: "test-1", status: "fail", message: `Error: ${token}` },
    ]);
    const result = sanitizeCategoryReport(report);
    expect(result.items[0].message).toContain("[REDACTED]");
    expect(result.items[0].message).not.toContain(token);
  });

  it("does not mutate the original report", () => {
    const report = makeReport([
      { name: "t", status: "fail", message: "<b>error</b>" },
    ]);
    const original = report.items[0].message;
    sanitizeCategoryReport(report);
    expect(report.items[0].message).toBe(original);
  });

  it("preserves non-message fields", () => {
    const report = makeReport([{ name: "test-1", status: "pass" }]);
    const result = sanitizeCategoryReport(report);
    expect(result.status).toBe("pass");
    expect(result.summary.total).toBe(1);
    expect(result.collectedAt).toBe("2024-01-15T10:30:00Z");
    expect(result.collectorVersion).toBe("1.0.0");
  });
});

// ---------------------------------------------------------------------------
// sanitizeDashboardReport
// ---------------------------------------------------------------------------

describe("sanitizeDashboardReport", () => {
  function makeReport(overrides: Partial<DashboardReport> = {}): DashboardReport {
    return {
      schema: "dashboard-report/v1",
      generatedAt: "2024-01-15T10:30:00Z",
      branch: "main",
      commit: "a".repeat(40),
      commitMessage: "clean message",
      categories: {},
      ...overrides,
    };
  }

  it("sanitizes commitMessage", () => {
    const ghp = "ghp_" + "X".repeat(36);
    const report = makeReport({
      commitMessage: `<b>fix:</b> ${ghp}`,
    });
    const result = sanitizeDashboardReport(report);
    expect(result.commitMessage).not.toContain("<b>");
    expect(result.commitMessage).not.toContain("ghp_");
    expect(result.commitMessage).toContain("[REDACTED]");
  });

  it("sanitizes all category reports", () => {
    const report = makeReport({
      categories: {
        tests: {
          status: "fail",
          summary: {
            total: 1,
            passed: 0,
            failed: 1,
            warnings: 0,
            skipped: 0,
          },
          items: [
            {
              name: "auth-test",
              status: "fail",
              message: "Password=secret123 leaked",
            },
          ],
          collectedAt: "2024-01-15T10:30:00Z",
          collectorVersion: "1.0.0",
        },
      },
    });
    const result = sanitizeDashboardReport(report);
    expect(result.categories.tests.items[0].message).toContain("[REDACTED]");
    expect(result.categories.tests.items[0].message).not.toContain(
      "secret123"
    );
  });

  it("truncates commitMessage to 200 chars", () => {
    const report = makeReport({ commitMessage: "x".repeat(250) });
    const result = sanitizeDashboardReport(report);
    // 200 content chars + "..." = 203 max
    expect(result.commitMessage.length).toBeLessThanOrEqual(203);
  });

  it("does not mutate the original report", () => {
    const original = "<b>original</b>";
    const report = makeReport({ commitMessage: original });
    sanitizeDashboardReport(report);
    expect(report.commitMessage).toBe(original);
  });

  it("preserves non-sanitized fields", () => {
    const report = makeReport();
    const result = sanitizeDashboardReport(report);
    expect(result.schema).toBe("dashboard-report/v1");
    expect(result.generatedAt).toBe("2024-01-15T10:30:00Z");
    expect(result.branch).toBe("main");
    expect(result.commit).toBe("a".repeat(40));
  });

  it("handles empty categories", () => {
    const report = makeReport({ categories: {} });
    const result = sanitizeDashboardReport(report);
    expect(Object.keys(result.categories)).toHaveLength(0);
  });

  it("handles multiple categories", () => {
    const report = makeReport({
      categories: {
        tests: {
          status: "pass",
          summary: {
            total: 1,
            passed: 1,
            failed: 0,
            warnings: 0,
            skipped: 0,
          },
          items: [
            { name: "t1", status: "pass", message: "<b>ok</b>" },
          ],
          collectedAt: "2024-01-15T10:30:00Z",
          collectorVersion: "1.0.0",
        },
        lint: {
          status: "warn",
          summary: {
            total: 1,
            passed: 0,
            failed: 0,
            warnings: 1,
            skipped: 0,
          },
          items: [
            { name: "l1", status: "warn", message: "api_key=leaked123" },
          ],
          collectedAt: "2024-01-15T10:30:00Z",
          collectorVersion: "2.0.0",
        },
      },
    });
    const result = sanitizeDashboardReport(report);
    expect(result.categories.tests.items[0].message).toBe("ok");
    expect(result.categories.lint.items[0].message).toContain("[REDACTED]");
  });
});
