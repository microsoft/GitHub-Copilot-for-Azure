/**
 * Tests for the integration tests collector (v2 — quality metrics).
 */

import { vi, describe, it, expect, beforeEach } from "vitest";
import { readFile, readdir, access } from "node:fs/promises";
import integrationCollector from "../../collectors/integration.js";
import type { CollectorOptions, CategoryItem } from "../../schema.js";

vi.mock("node:fs/promises", () => ({
  access: vi.fn(),
  readFile: vi.fn(),
  readdir: vi.fn(),
  stat: vi.fn(),
}));

const mockAccess = access as unknown as ReturnType<typeof vi.fn>;
const mockReadFile = readFile as unknown as ReturnType<typeof vi.fn>;
const mockReaddir = readdir as unknown as ReturnType<typeof vi.fn>;

const defaultOptions: CollectorOptions = {
  cwd: "/repo",
  timeout: 30_000,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getThresholdItems(items: CategoryItem[]): CategoryItem[] {
  return items.filter((i) => i.metadata?.metricType === "threshold");
}

function getSkillItems(items: CategoryItem[]): CategoryItem[] {
  return items.filter((i) => i.metadata?.metricType === "skill");
}

function findThreshold(
  items: CategoryItem[],
  name: string,
): CategoryItem | undefined {
  return getThresholdItems(items).find((i) => i.name === name);
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const SINGLE_SKILL_JSONL = [
  JSON.stringify({
    testName:
      "azure-deploy_avm-flow_-_Integration_Tests_avm-module-priority_prefers_AVM",
    timestamp: "2026-03-06T17:12:01.245Z",
    model: "claude-sonnet-4.5",
    inputTokens: 76693,
    outputTokens: 931,
    totalApiDurationMs: 18791,
    apiCallCount: 2,
  }),
  JSON.stringify({
    testName:
      "azure-deploy_avm-flow_-_Integration_Tests_avm-fallback-behavior_stays_within",
    timestamp: "2026-03-06T17:12:31.049Z",
    model: "claude-sonnet-4.5",
    inputTokens: 76696,
    outputTokens: 1187,
    totalApiDurationMs: 23321,
    apiCallCount: 2,
  }),
].join("\n");

const MULTI_SKILL_JSONL = [
  JSON.stringify({
    testName: "azure-deploy_avm-flow_-_Integration_Tests_test1",
    inputTokens: 50000,
    outputTokens: 1000,
    totalApiDurationMs: 10000,
    apiCallCount: 2,
  }),
  JSON.stringify({
    testName: "microsoft-foundry_deploy-model_-_Integration_Tests_test2",
    inputTokens: 30000,
    outputTokens: 500,
    totalApiDurationMs: 5000,
    apiCallCount: 1,
  }),
].join("\n");

/** A valid quality report for the quality-report path. */
const QUALITY_REPORT = JSON.stringify({
  version: "1.0",
  summary: {
    totalTests: 10,
    passed: 8,
    failed: 2,
    passRate: 80,
    totalInputTokens: 500000,
    totalOutputTokens: 10000,
    totalLLMCalls: 20,
    totalDurationSec: 120,
  },
  areas: [
    {
      name: "azure-deploy/avm-flow",
      tests: 5,
      passed: 5,
      failed: 0,
      passRate: 100,
      totalInputTokens: 300000,
      totalOutputTokens: 6000,
      avgDurationMs: 15000,
    },
    {
      name: "microsoft-foundry/deploy-model",
      tests: 3,
      passed: 2,
      failed: 1,
      passRate: 66.7,
      totalInputTokens: 150000,
      totalOutputTokens: 3000,
      avgDurationMs: 8000,
    },
    {
      name: "azure-functions/http-trigger",
      tests: 2,
      passed: 1,
      failed: 1,
      passRate: 50,
      totalInputTokens: 50000,
      totalOutputTokens: 1000,
      avgDurationMs: 5000,
    },
  ],
  traces: {
    test1: { pathAdherence: { adherence: 90 } },
    test2: { pathAdherence: { adherence: 85 } },
    test3: { pathAdherence: { adherence: 95 } },
  },
});

function mockDirent(name: string, isDir: boolean) {
  return {
    name,
    isDirectory: () => isDir,
    isFile: () => !isDir,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isFIFO: () => false,
    isSocket: () => false,
    isSymbolicLink: () => false,
    parentPath: "",
    path: "",
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("integrationCollector", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("has correct name and version", () => {
    expect(integrationCollector.name).toBe("integration");
    expect(integrationCollector.version).toBe("2.0.0");
  });

  // ── Skip cases ──────────────────────────────────────────────────────────

  it("returns skip when reports directory does not exist", async () => {
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    const report = await integrationCollector.collect(defaultOptions);

    expect(report.status).toBe("skip");
    expect(report.items).toHaveLength(1);
    expect(report.items[0].message).toContain("No test-run directories");
  });

  it("returns skip when no test-run directories exist", async () => {
    mockAccess.mockResolvedValue(undefined);
    mockReaddir.mockResolvedValueOnce([
      mockDirent("junit.xml", false),
      mockDirent("some-other-dir", true),
    ]);

    const report = await integrationCollector.collect(defaultOptions);

    expect(report.status).toBe("skip");
    expect(report.items[0].message).toContain("No test-run directories");
  });

  it("returns skip when no test-run directories have valid data", async () => {
    mockAccess.mockResolvedValue(undefined);
    mockReaddir.mockResolvedValueOnce([
      mockDirent("test-run-2026-03-06T17-11-25-833Z", true),
    ]);
    mockReadFile.mockRejectedValue(new Error("ENOENT"));

    const report = await integrationCollector.collect(defaultOptions);

    expect(report.status).toBe("skip");
    expect(report.items[0].message).toContain("No valid test data");
  });

  it("returns skip when token-summary.jsonl is empty", async () => {
    mockAccess.mockResolvedValue(undefined);
    mockReaddir.mockResolvedValueOnce([
      mockDirent("test-run-2026-03-06T17-11-25-833Z", true),
    ]);
    mockReadFile.mockResolvedValue("");

    const report = await integrationCollector.collect(defaultOptions);

    expect(report.status).toBe("skip");
    expect(report.items[0].message).toContain("No valid test data");
  });

  it("returns skip when JSONL has no valid entries", async () => {
    mockAccess.mockResolvedValue(undefined);
    mockReaddir.mockResolvedValueOnce([
      mockDirent("test-run-2026-03-06T17-11-25-833Z", true),
    ]);
    mockReadFile.mockResolvedValue("not valid json\nalso bad\n");

    const report = await integrationCollector.collect(defaultOptions);

    expect(report.status).toBe("skip");
    expect(report.items[0].message).toContain("No valid test data");
  });

  // ── JSONL fallback path ────────────────────────────────────────────────

  it("produces threshold + skill items for single skill via JSONL", async () => {
    mockAccess.mockResolvedValue(undefined);
    mockReaddir.mockResolvedValueOnce([
      mockDirent("test-run-2026-03-06T17-11-25-833Z", true),
    ]);
    mockReadFile.mockResolvedValue(SINGLE_SKILL_JSONL);
    mockReaddir.mockResolvedValueOnce([
      mockDirent(
        "azure-deploy_avm-flow_-_Integration_Tests_avm-module-priority_prefers_AVM",
        true,
      ),
      mockDirent(
        "azure-deploy_avm-flow_-_Integration_Tests_avm-fallback-behavior_stays_within",
        true,
      ),
    ]);

    const report = await integrationCollector.collect(defaultOptions);

    // 4 threshold items + 1 skill item
    expect(getThresholdItems(report.items)).toHaveLength(4);

    const skills = getSkillItems(report.items);
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("azure-deploy");
    expect(skills[0].status).toBe("pass");
    expect(skills[0].message).toBe("2/2 tests completed");
    expect(skills[0].metadata?.tests).toBe(2);
    expect(skills[0].metadata?.passed).toBe(2);
    expect(skills[0].metadata?.failed).toBe(0);
    expect(skills[0].metadata?.inputTokens).toBe(153389);
    expect(skills[0].metadata?.outputTokens).toBe(2118);
    expect(skills[0].metadata?.tokenUsage).toBe(155507);
    expect(skills[0].metadata?.apiCalls).toBe(4);
    expect(skills[0].metadata?.metricType).toBe("skill");

    // Thresholds: invocation=100%, e2e=100%, retries=0, confidence=skip
    const invocation = findThreshold(report.items, "Skill Invocation Rate");
    expect(invocation?.status).toBe("pass");
    expect(invocation?.metadata?.rate).toBe(100);

    const e2e = findThreshold(report.items, "End-to-End Pass Rate");
    expect(e2e?.status).toBe("pass");
    expect(e2e?.metadata?.rate).toBe(100);

    const retries = findThreshold(report.items, "Deploy Retries");
    expect(retries?.status).toBe("pass");
    expect(retries?.metadata?.rate).toBe(0);

    const confidence = findThreshold(report.items, "Confidence Level");
    expect(confidence?.status).toBe("skip");

    // Overall: pass (all non-skipped thresholds met)
    expect(report.status).toBe("pass");
    expect(report.summary.total).toBe(4);
    expect(report.summary.passed).toBe(3);
    expect(report.summary.skipped).toBe(1);
  });

  it("groups items by skill across multiple skills via JSONL", async () => {
    mockAccess.mockResolvedValue(undefined);
    mockReaddir.mockResolvedValueOnce([
      mockDirent("test-run-2026-03-06T17-11-25-833Z", true),
    ]);
    mockReadFile.mockResolvedValue(MULTI_SKILL_JSONL);
    mockReaddir.mockResolvedValueOnce([
      mockDirent("azure-deploy_avm-flow_-_Integration_Tests_test1", true),
      mockDirent(
        "microsoft-foundry_deploy-model_-_Integration_Tests_test2",
        true,
      ),
    ]);

    const report = await integrationCollector.collect(defaultOptions);

    expect(report.status).toBe("pass");

    const skills = getSkillItems(report.items);
    expect(skills).toHaveLength(2);
    expect(skills[0].name).toBe("azure-deploy");
    expect(skills[0].metadata?.inputTokens).toBe(50000);
    expect(skills[1].name).toBe("microsoft-foundry");
    expect(skills[1].metadata?.inputTokens).toBe(30000);
  });

  it("marks fail when a test directory has no JSONL entry", async () => {
    mockAccess.mockResolvedValue(undefined);
    mockReaddir.mockResolvedValueOnce([
      mockDirent("test-run-2026-03-06T17-11-25-833Z", true),
    ]);
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        testName: "azure-deploy_avm-flow_-_Integration_Tests_test1",
        inputTokens: 50000,
        outputTokens: 1000,
        totalApiDurationMs: 10000,
        apiCallCount: 2,
      }),
    );
    mockReaddir.mockResolvedValueOnce([
      mockDirent("azure-deploy_avm-flow_-_Integration_Tests_test1", true),
      mockDirent(
        "azure-deploy_avm-flow_-_Integration_Tests_test2_incomplete",
        true,
      ),
    ]);

    const report = await integrationCollector.collect(defaultOptions);

    // E2E pass rate = 50% < 70% → fail
    expect(report.status).toBe("fail");

    const skills = getSkillItems(report.items);
    expect(skills).toHaveLength(1);
    expect(skills[0].status).toBe("fail");
    expect(skills[0].message).toBe("1/2 tests completed");
    expect(skills[0].metadata?.passed).toBe(1);
    expect(skills[0].metadata?.failed).toBe(1);

    const e2e = findThreshold(report.items, "End-to-End Pass Rate");
    expect(e2e?.status).toBe("fail");
    expect(e2e?.metadata?.rate).toBe(50);
  });

  it("handles JSONL with malformed lines gracefully", async () => {
    const mixedJsonl = [
      "not json at all",
      JSON.stringify({
        testName: "azure-deploy_test",
        inputTokens: 100,
        outputTokens: 50,
        totalApiDurationMs: 500,
        apiCallCount: 1,
      }),
      "{ invalid json",
      "",
    ].join("\n");

    mockAccess.mockResolvedValue(undefined);
    mockReaddir.mockResolvedValueOnce([
      mockDirent("test-run-2026-03-06T17-11-25-833Z", true),
    ]);
    mockReadFile.mockResolvedValue(mixedJsonl);
    mockReaddir.mockResolvedValueOnce([
      mockDirent("azure-deploy_test", true),
    ]);

    const report = await integrationCollector.collect(defaultOptions);

    expect(report.status).toBe("pass");
    const skills = getSkillItems(report.items);
    expect(skills).toHaveLength(1);
    expect(skills[0].metadata?.tests).toBe(1);
  });

  it("sanitizes skill names", async () => {
    const jsonl = JSON.stringify({
      testName: "<script>alert</script>_test",
      inputTokens: 100,
      outputTokens: 50,
      totalApiDurationMs: 500,
      apiCallCount: 1,
    });

    mockAccess.mockResolvedValue(undefined);
    mockReaddir.mockResolvedValueOnce([
      mockDirent("test-run-2026-03-06T17-11-25-833Z", true),
    ]);
    mockReadFile.mockResolvedValue(jsonl);
    mockReaddir.mockResolvedValueOnce([]);

    const report = await integrationCollector.collect(defaultOptions);

    const skills = getSkillItems(report.items);
    expect(skills[0].name).not.toContain("<script>");
  });

  it("returns valid collectorVersion and collectedAt", async () => {
    mockAccess.mockResolvedValue(undefined);
    mockReaddir.mockResolvedValueOnce([
      mockDirent("test-run-2026-03-06T17-11-25-833Z", true),
    ]);
    mockReadFile.mockResolvedValue(SINGLE_SKILL_JSONL);
    mockReaddir.mockResolvedValueOnce([]);

    const report = await integrationCollector.collect(defaultOptions);

    expect(report.collectorVersion).toBe("2.0.0");
    expect(new Date(report.collectedAt).getTime()).not.toBeNaN();
  });

  it("handles readdir error for subdirectories gracefully", async () => {
    mockAccess.mockResolvedValue(undefined);
    mockReaddir.mockResolvedValueOnce([
      mockDirent("test-run-2026-03-06T17-11-25-833Z", true),
    ]);
    mockReadFile.mockResolvedValue(SINGLE_SKILL_JSONL);
    mockReaddir.mockRejectedValueOnce(new Error("Permission denied"));

    const report = await integrationCollector.collect(defaultOptions);

    expect(report.status).toBe("pass");
    const skills = getSkillItems(report.items);
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("azure-deploy");
  });

  it("handles JSONL entries with missing optional fields", async () => {
    const minimalJsonl = JSON.stringify({
      testName: "azure-deploy_minimal-test",
    });

    mockAccess.mockResolvedValue(undefined);
    mockReaddir.mockResolvedValueOnce([
      mockDirent("test-run-2026-03-06T17-11-25-833Z", true),
    ]);
    mockReadFile.mockResolvedValue(minimalJsonl);
    mockReaddir.mockResolvedValueOnce([]);

    const report = await integrationCollector.collect(defaultOptions);

    expect(report.status).toBe("pass");
    const skills = getSkillItems(report.items);
    expect(skills[0].metadata?.inputTokens).toBe(0);
    expect(skills[0].metadata?.outputTokens).toBe(0);
    expect(skills[0].metadata?.apiCalls).toBe(0);
  });

  it("extracts run date from directory name correctly", async () => {
    mockAccess.mockResolvedValue(undefined);
    mockReaddir.mockResolvedValueOnce([
      mockDirent("test-run-2026-03-06T17-11-25-833Z", true),
    ]);
    mockReadFile.mockResolvedValue(SINGLE_SKILL_JSONL);
    mockReaddir.mockResolvedValueOnce([]);

    const report = await integrationCollector.collect(defaultOptions);

    const skills = getSkillItems(report.items);
    expect(skills[0].metadata?.runDate).toBe("2026-03-06T17:11:25.833Z");
  });

  it("formats token display correctly", async () => {
    const largeTokenJsonl = JSON.stringify({
      testName: "azure-deploy_large-test",
      inputTokens: 1500000,
      outputTokens: 50000,
    });

    mockAccess.mockResolvedValue(undefined);
    mockReaddir.mockResolvedValueOnce([
      mockDirent("test-run-2026-03-06T17-11-25-833Z", true),
    ]);
    mockReadFile.mockResolvedValue(largeTokenJsonl);
    mockReaddir.mockResolvedValueOnce([]);

    const report = await integrationCollector.collect(defaultOptions);

    const skills = getSkillItems(report.items);
    expect(skills[0].metadata?.tokenDisplay).toBe("1.6M");
  });

  it("extracts skill name for test names without underscores", async () => {
    const noUnderscoreJsonl = JSON.stringify({
      testName: "simple-test",
      inputTokens: 100,
      outputTokens: 50,
    });

    mockAccess.mockResolvedValue(undefined);
    mockReaddir.mockResolvedValueOnce([
      mockDirent("test-run-2026-03-06T17-11-25-833Z", true),
    ]);
    mockReadFile.mockResolvedValue(noUnderscoreJsonl);
    mockReaddir.mockResolvedValueOnce([]);

    const report = await integrationCollector.collect(defaultOptions);

    const skills = getSkillItems(report.items);
    expect(skills[0].name).toBe("simple-test");
  });

  it("aggregates skills from multiple test runs via JSONL", async () => {
    const olderSkillJsonl = JSON.stringify({
      testName: "microsoft-foundry_deploy-model_-_Integration_Tests_test1",
      inputTokens: 30000,
      outputTokens: 500,
      totalApiDurationMs: 5000,
      apiCallCount: 1,
    });
    const newerSkillJsonl = JSON.stringify({
      testName: "azure-deploy_avm-flow_-_Integration_Tests_test1",
      inputTokens: 50000,
      outputTokens: 1000,
      totalApiDurationMs: 10000,
      apiCallCount: 2,
    });

    mockAccess.mockResolvedValue(undefined);
    mockReaddir.mockResolvedValueOnce([
      mockDirent("test-run-2026-03-01T10-00-00-000Z", true),
      mockDirent("test-run-2026-03-06T17-11-25-833Z", true),
      mockDirent("test-run-2026-03-03T12-00-00-000Z", true),
    ]);

    // Quality-report attempt for latest dir (03-06) — single JSON object,
    // but missing "summary"/"areas" so tryLoadQualityReport returns null.
    mockReadFile.mockResolvedValueOnce(newerSkillJsonl);

    // Run 1 (oldest: 03-01)
    mockReadFile.mockResolvedValueOnce(olderSkillJsonl);
    mockReaddir.mockResolvedValueOnce([
      mockDirent(
        "microsoft-foundry_deploy-model_-_Integration_Tests_test1",
        true,
      ),
    ]);

    // Run 2 (middle: 03-03)
    mockReadFile.mockResolvedValueOnce(olderSkillJsonl);
    mockReaddir.mockResolvedValueOnce([
      mockDirent(
        "microsoft-foundry_deploy-model_-_Integration_Tests_test1",
        true,
      ),
    ]);

    // Run 3 (newest: 03-06)
    mockReadFile.mockResolvedValueOnce(newerSkillJsonl);
    mockReaddir.mockResolvedValueOnce([
      mockDirent(
        "azure-deploy_avm-flow_-_Integration_Tests_test1",
        true,
      ),
    ]);

    const report = await integrationCollector.collect(defaultOptions);

    expect(report.status).toBe("pass");
    const skills = getSkillItems(report.items);
    expect(skills).toHaveLength(2);
    expect(skills[0].name).toBe("azure-deploy");
    expect(skills[0].metadata?.runDate).toBe("2026-03-06T17:11:25.833Z");
    expect(skills[1].name).toBe("microsoft-foundry");
    expect(skills[1].metadata?.runDate).toBe("2026-03-03T12:00:00.000Z");
  });

  // ── Quality report path ────────────────────────────────────────────────

  it("uses quality report when available", async () => {
    mockAccess.mockResolvedValue(undefined);
    mockReaddir.mockResolvedValueOnce([
      mockDirent("test-run-2026-03-06T17-11-25-833Z", true),
    ]);
    mockReadFile.mockResolvedValueOnce(QUALITY_REPORT);

    const report = await integrationCollector.collect(defaultOptions);

    const thresholds = getThresholdItems(report.items);
    expect(thresholds).toHaveLength(4);

    // Skill Invocation Rate: 3/3 areas have passRate > 0 → 100%
    const invocation = findThreshold(report.items, "Skill Invocation Rate");
    expect(invocation?.status).toBe("pass");
    expect(invocation?.metadata?.rate).toBe(100);

    // E2E Pass Rate: 80%
    const e2e = findThreshold(report.items, "End-to-End Pass Rate");
    expect(e2e?.status).toBe("pass");
    expect(e2e?.metadata?.rate).toBe(80);

    // Deploy Retries: azure-deploy area has 0 failures
    const retries = findThreshold(report.items, "Deploy Retries");
    expect(retries?.status).toBe("pass");
    expect(retries?.metadata?.rate).toBe(0);

    // Confidence: avg(90, 85, 95) = 90%
    const confidence = findThreshold(report.items, "Confidence Level");
    expect(confidence?.status).toBe("pass");
    expect(confidence?.metadata?.rate).toBe(90);

    // Skill items from areas
    const skills = getSkillItems(report.items);
    expect(skills).toHaveLength(3);
    expect(skills[0].name).toBe("azure-deploy/avm-flow");
    expect(skills[0].status).toBe("pass");
    expect(skills[0].metadata?.tests).toBe(5);
    expect(skills[0].metadata?.passRate).toBe(100);

    expect(skills[1].name).toBe("azure-functions/http-trigger");
    expect(skills[1].status).toBe("warn");

    expect(skills[2].name).toBe("microsoft-foundry/deploy-model");
    expect(skills[2].status).toBe("warn");

    // Overall: pass (all thresholds met)
    expect(report.status).toBe("pass");
    expect(report.summary.total).toBe(4);
    expect(report.summary.passed).toBe(4);
    expect(report.summary.failed).toBe(0);
  });

  it("fails when quality report shows low pass rate", async () => {
    const lowPassReport = JSON.stringify({
      version: "1.0",
      summary: { totalTests: 10, passed: 5, failed: 5, passRate: 50 },
      areas: [
        {
          name: "azure-deploy/test",
          tests: 5,
          passed: 2,
          failed: 3,
          passRate: 40,
        },
        {
          name: "azure-ai/test",
          tests: 5,
          passed: 3,
          failed: 2,
          passRate: 60,
        },
      ],
      traces: {},
    });

    mockAccess.mockResolvedValue(undefined);
    mockReaddir.mockResolvedValueOnce([
      mockDirent("test-run-2026-03-06T17-11-25-833Z", true),
    ]);
    mockReadFile.mockResolvedValueOnce(lowPassReport);

    const report = await integrationCollector.collect(defaultOptions);

    expect(report.status).toBe("fail");

    const e2e = findThreshold(report.items, "End-to-End Pass Rate");
    expect(e2e?.status).toBe("fail");

    // Deploy Retries: 3 failures → warn (equals threshold)
    const retries = findThreshold(report.items, "Deploy Retries");
    expect(retries?.status).toBe("warn");
    expect(retries?.metadata?.rate).toBe(3);
  });

  it("skips confidence when no traces available", async () => {
    const noTracesReport = JSON.stringify({
      version: "1.0",
      summary: { totalTests: 3, passed: 3, failed: 0, passRate: 100 },
      areas: [
        {
          name: "azure-deploy",
          tests: 3,
          passed: 3,
          failed: 0,
          passRate: 100,
        },
      ],
    });

    mockAccess.mockResolvedValue(undefined);
    mockReaddir.mockResolvedValueOnce([
      mockDirent("test-run-2026-03-06T17-11-25-833Z", true),
    ]);
    mockReadFile.mockResolvedValueOnce(noTracesReport);

    const report = await integrationCollector.collect(defaultOptions);

    const confidence = findThreshold(report.items, "Confidence Level");
    expect(confidence?.status).toBe("skip");
  });

  it("computes warn status when metric is near threshold", async () => {
    const nearThresholdReport = JSON.stringify({
      version: "1.0",
      summary: { totalTests: 9, passed: 6, failed: 3, passRate: 67 },
      areas: [
        {
          name: "azure-deploy",
          tests: 9,
          passed: 6,
          failed: 3,
          passRate: 67,
        },
      ],
      traces: { t1: { pathAdherence: { adherence: 76 } } },
    });

    mockAccess.mockResolvedValue(undefined);
    mockReaddir.mockResolvedValueOnce([
      mockDirent("test-run-2026-03-06T17-11-25-833Z", true),
    ]);
    mockReadFile.mockResolvedValueOnce(nearThresholdReport);

    const report = await integrationCollector.collect(defaultOptions);

    // E2E 67% ∈ [65%, 70%) → warn
    const e2e = findThreshold(report.items, "End-to-End Pass Rate");
    expect(e2e?.status).toBe("warn");

    // Confidence 76% ∈ [75%, 80%) → warn
    const confidence = findThreshold(report.items, "Confidence Level");
    expect(confidence?.status).toBe("warn");

    expect(report.status).toBe("warn");
  });

  it("includes metricType in all item metadata", async () => {
    mockAccess.mockResolvedValue(undefined);
    mockReaddir.mockResolvedValueOnce([
      mockDirent("test-run-2026-03-06T17-11-25-833Z", true),
    ]);
    mockReadFile.mockResolvedValue(SINGLE_SKILL_JSONL);
    mockReaddir.mockResolvedValueOnce([]);

    const report = await integrationCollector.collect(defaultOptions);

    for (const item of report.items) {
      expect(item.metadata?.metricType).toBeDefined();
      expect(["threshold", "skill"]).toContain(item.metadata?.metricType);
    }
  });

  it("threshold items have correct metadata shape", async () => {
    mockAccess.mockResolvedValue(undefined);
    mockReaddir.mockResolvedValueOnce([
      mockDirent("test-run-2026-03-06T17-11-25-833Z", true),
    ]);
    mockReadFile.mockResolvedValueOnce(QUALITY_REPORT);

    const report = await integrationCollector.collect(defaultOptions);

    for (const item of getThresholdItems(report.items)) {
      expect(item.metadata).toBeDefined();
      expect(typeof item.metadata?.rate).toBe("number");
      expect(typeof item.metadata?.threshold).toBe("number");
      expect(typeof item.metadata?.met).toBe("boolean");
      expect(typeof item.metadata?.unit).toBe("string");
      expect(typeof item.metadata?.direction).toBe("string");
    }
  });
});
