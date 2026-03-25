/**
 * Integration tests collector — quality metrics with threshold pass/fail.
 *
 * Primary data source: `skill-quality-report.json` in the latest test-run
 * directory (produced by `tests/scripts/generate-quality-report.js`).
 *
 * Fallback: `token-summary.jsonl` + test subdirectories (original approach).
 *
 * Produces four threshold metrics (shown as big cards on the dashboard):
 *   1. Skill Invocation Rate  (threshold ≥ 80 %)
 *   2. End-to-End Pass Rate   (threshold ≥ 70 %)
 *   3. Deploy Retries          (threshold < 3)
 *   4. Confidence Level        (threshold ≥ 80 %)
 *
 * Plus per-skill breakdown items with individual pass rates.
 */

import { readFile, readdir, access } from "node:fs/promises";
import path from "node:path";
import type {
  Collector,
  CollectorOptions,
  CategoryReport,
  CategoryItem,
  CategoryStatus,
} from "../schema.js";
import { sanitize } from "../sanitize.js";

const VERSION = "2.0.0";
const TEST_RUN_PREFIX = "test-run-";

// ---------------------------------------------------------------------------
// Quality Threshold Constants
// ---------------------------------------------------------------------------

/** Minimum percentage of tests where the correct skill was invoked. */
const SKILL_INVOCATION_THRESHOLD = 80;
/** Minimum percentage of tests that passed end-to-end. */
const E2E_PASS_RATE_THRESHOLD = 70;
/** Maximum allowed deployment retries before the metric fails. */
const DEPLOY_RETRY_THRESHOLD = 3;
/** Minimum average path-adherence confidence percentage. */
const CONFIDENCE_THRESHOLD = 80;
/** A metric within this many percentage points of its threshold → "warn". */
const WARN_MARGIN_PCT = 5;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single entry from token-summary.jsonl. */
interface TokenSummaryEntry {
  testName: string;
  prompt?: string;
  timestamp?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  totalApiDurationMs?: number;
  apiCallCount?: number;
}

/** Aggregated data per skill area. */
interface SkillAggregate {
  tests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalDurationMs: number;
  apiCalls: number;
  /** Names of completed tests (from JSONL). */
  completedTests: Set<string>;
  /** Names of all test directories found. */
  allTestDirs: Set<string>;
  /** ISO-8601 date string of the test run this data came from. */
  runDate: string;
}

// ---------------------------------------------------------------------------
// Quality Report Types
// ---------------------------------------------------------------------------

/** Summary block from skill-quality-report.json. */
interface QualityReportSummary {
  totalTests: number;
  passed: number;
  failed: number;
  passRate: number;
  totalInputTokens?: number;
  totalOutputTokens?: number;
  totalLLMCalls?: number;
  totalDurationSec?: number;
}

/** Per-area (per-skill) block from skill-quality-report.json. */
interface QualityReportArea {
  name: string;
  tests: number;
  passed: number;
  failed: number;
  skipped?: number;
  passRate: number;
  totalInputTokens?: number;
  totalOutputTokens?: number;
  totalLLMCalls?: number;
  avgDurationMs?: number;
}

/** Trace block with optional path-adherence data. */
interface QualityReportTrace {
  pathAdherence?: { adherence: number };
}

/** Top-level shape of skill-quality-report.json. */
interface QualityReport {
  version?: string;
  summary: QualityReportSummary;
  areas: QualityReportArea[];
  traces?: Record<string, QualityReportTrace>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a skip report with an explanatory item. */
function makeSkipReport(message: string): CategoryReport {
  return {
    status: "skip",
    summary: { total: 0, passed: 0, failed: 0, warnings: 0, skipped: 0 },
    items: [{ name: "integration", status: "skip", message: sanitize(message) }],
    collectedAt: new Date().toISOString(),
    collectorVersion: VERSION,
  };
}

/**
 * Extract the skill name from an integration test directory or test name.
 *
 * Test names follow two patterns:
 *   New: `{skill}_{suite}_-_Integration_Tests_{test}_{description}`
 *   Old: `{skill}-Integration_Tests_{test}_{description}`
 *
 * For example:
 *   `azure-deploy_avm-flow_-_Integration_Tests_avm-module-priority_prefers_...`
 *   → skill = "azure-deploy"
 *
 *   `azure-deploy-Integration_Tests_skill-invocation_invokes_...`
 *   → skill = "azure-deploy"  (strip `-Integration` suffix)
 */
function extractSkillName(testName: string): string {
  // The skill name is the first segment before the first underscore
  const firstUnderscore = testName.indexOf("_");
  if (firstUnderscore === -1) return testName;
  let skill = testName.substring(0, firstUnderscore);

  // Normalize old naming convention: "{skill}-Integration" → "{skill}"
  const integrationSuffix = "-Integration";
  if (skill.endsWith(integrationSuffix)) {
    skill = skill.substring(0, skill.length - integrationSuffix.length);
  }

  return skill;
}

/**
 * Find all test-run directories, sorted chronologically (oldest first).
 * Directory names contain ISO-8601 timestamps so alphabetical sort works.
 */
async function findAllTestRuns(reportsDir: string): Promise<string[]> {
  try {
    await access(reportsDir);
  } catch {
    return [];
  }

  let entries: string[];
  try {
    const dirEntries = await readdir(reportsDir, { withFileTypes: true });
    entries = dirEntries
      .filter((e) => e.isDirectory() && e.name.startsWith(TEST_RUN_PREFIX))
      .map((e) => e.name);
  } catch {
    return [];
  }

  if (entries.length === 0) return [];

  // Sort oldest-first so later iterations overwrite with newer data
  entries.sort();
  return entries.map((name) => path.join(reportsDir, name));
}

/**
 * Parse a JSONL file into an array of typed entries.
 * Skips blank lines and lines that fail JSON parsing.
 */
function parseJsonl(content: string): TokenSummaryEntry[] {
  const entries: TokenSummaryEntry[] = [];

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && "testName" in parsed) {
        entries.push(parsed as TokenSummaryEntry);
      }
    } catch {
      // Skip malformed lines
    }
  }

  return entries;
}

/**
 * Extract a human-readable run date from the test-run directory name.
 *
 * Directory name format: `test-run-2026-03-06T17-11-25-833Z`
 * Extracts: `2026-03-06T17:11:25.833Z` (converts to valid ISO-8601)
 */
function extractRunDate(dirName: string): string {
  const timestamp = dirName.replace(TEST_RUN_PREFIX, "");
  // Convert `2026-03-06T17-11-25-833Z` → `2026-03-06T17:11:25.833Z`
  // Pattern: date part is fine, time dashes → colons, last dash before Z → dot
  const match = timestamp.match(
    /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d+)Z$/,
  );
  if (match) {
    const [, date, h, m, s, ms] = match;
    return `${date}T${h}:${m}:${s}.${ms}Z`;
  }
  return timestamp;
}

/**
 * List subdirectories inside the test-run directory.
 * Each subdirectory corresponds to a single test execution.
 */
async function listTestDirectories(testRunDir: string): Promise<string[]> {
  try {
    const entries = await readdir(testRunDir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

/**
 * Format a token count for display (e.g. 207901 → "207.9k").
 */
function formatTokens(count: number): string {
  if (count >= 1_000_000) return (count / 1_000_000).toFixed(1) + "M";
  if (count >= 1_000) return (count / 1_000).toFixed(1) + "k";
  return String(count);
}

// ---------------------------------------------------------------------------
// Quality Report Helpers
// ---------------------------------------------------------------------------

/**
 * Attempt to load and parse `skill-quality-report.json` from a test-run dir.
 * Returns `null` if the file is missing or malformed.
 */
async function tryLoadQualityReport(
  testRunDir: string,
): Promise<QualityReport | null> {
  const reportPath = path.join(testRunDir, "skill-quality-report.json");
  try {
    const content = await readFile(reportPath, "utf-8");
    const parsed: unknown = JSON.parse(content);
    if (
      parsed &&
      typeof parsed === "object" &&
      "summary" in parsed &&
      "areas" in parsed
    ) {
      return parsed as QualityReport;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Determine pass/warn/fail status for a threshold metric.
 *
 * @param direction - "above" means higher is better (value ≥ threshold),
 *                    "below" means lower is better (value < threshold).
 */
function computeThresholdStatus(
  value: number,
  threshold: number,
  direction: "above" | "below",
): CategoryStatus {
  if (direction === "above") {
    if (value >= threshold) return "pass";
    if (value >= threshold - WARN_MARGIN_PCT) return "warn";
    return "fail";
  }
  // "below" — strict: pass only when value < threshold
  if (value < threshold) return "pass";
  if (value === threshold) return "warn";
  return "fail";
}

/** Build a single threshold CategoryItem. */
function buildThresholdItem(
  name: string,
  value: number,
  threshold: number,
  direction: "above" | "below",
  unit: string,
): CategoryItem {
  const status = computeThresholdStatus(value, threshold, direction);
  const displayValue =
    unit === "%" ? `${Math.round(value)}%` : String(value);
  const thresholdDisplay =
    direction === "below"
      ? `fewer than ${threshold}`
      : `${threshold}${unit === "%" ? "%" : ""}`;
  return {
    name,
    status,
    message: `${displayValue} (threshold: ${thresholdDisplay})`,
    metadata: {
      metricType: "threshold",
      rate: Math.round(value * 100) / 100,
      threshold,
      met: status === "pass",
      unit,
      direction,
    },
  };
}

/** Percentage of areas where at least one test passed (skill invoked). */
function computeSkillInvocationRate(areas: QualityReportArea[]): number {
  if (areas.length === 0) return 0;
  const invoked = areas.filter((a) => a.passRate > 0).length;
  return (invoked / areas.length) * 100;
}

/** Count of failed tests across all azure-deploy areas. */
function computeDeployRetries(areas: QualityReportArea[]): number {
  return areas
    .filter((a) => a.name.startsWith("azure-deploy"))
    .reduce((sum, a) => sum + a.failed, 0);
}

/** Average path-adherence across all traces, or -1 if unavailable. */
function computeConfidenceLevel(
  traces: Record<string, QualityReportTrace> | undefined,
): number {
  if (!traces) return -1;
  const scores: number[] = [];
  for (const trace of Object.values(traces)) {
    if (trace.pathAdherence?.adherence !== undefined) {
      scores.push(trace.pathAdherence.adherence);
    }
  }
  if (scores.length === 0) return -1;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

/**
 * Build threshold + skill items from a parsed quality report.
 */
function buildFromQualityReport(
  report: QualityReport,
  runDate: string,
): { thresholdItems: CategoryItem[]; skillItems: CategoryItem[] } {
  const invocationRate = computeSkillInvocationRate(report.areas);
  const e2ePassRate = report.summary.passRate;
  const deployRetries = computeDeployRetries(report.areas);
  const confidenceLevel = computeConfidenceLevel(report.traces);

  const thresholdItems: CategoryItem[] = [
    buildThresholdItem(
      "Skill Invocation Rate",
      invocationRate,
      SKILL_INVOCATION_THRESHOLD,
      "above",
      "%",
    ),
    buildThresholdItem(
      "End-to-End Pass Rate",
      e2ePassRate,
      E2E_PASS_RATE_THRESHOLD,
      "above",
      "%",
    ),
    buildThresholdItem(
      "Deploy Retries",
      deployRetries,
      DEPLOY_RETRY_THRESHOLD,
      "below",
      "count",
    ),
  ];

  if (confidenceLevel >= 0) {
    thresholdItems.push(
      buildThresholdItem(
        "Confidence Level",
        confidenceLevel,
        CONFIDENCE_THRESHOLD,
        "above",
        "%",
      ),
    );
  } else {
    thresholdItems.push({
      name: "Confidence Level",
      status: "skip",
      message: "No path adherence data available",
      metadata: {
        metricType: "threshold",
        rate: 0,
        threshold: CONFIDENCE_THRESHOLD,
        met: false,
        unit: "%",
        direction: "above",
      },
    });
  }

  const skillItems: CategoryItem[] = report.areas.map((area) => {
    const totalTokens =
      (area.totalInputTokens ?? 0) + (area.totalOutputTokens ?? 0);
    const areaStatus: CategoryStatus =
      area.passRate >= 100 ? "pass" : area.passRate > 0 ? "warn" : "fail";
    return {
      name: sanitize(area.name),
      status: areaStatus,
      message: `${area.passed}/${area.tests} tests passed (${Math.round(area.passRate)}%)`,
      metadata: {
        metricType: "skill",
        tests: area.tests,
        passed: area.passed,
        failed: area.failed,
        passRate: Math.round(area.passRate),
        tokenUsage: totalTokens,
        tokenDisplay: formatTokens(totalTokens),
        avgDurationMs: area.avgDurationMs ?? 0,
        runDate,
      },
    };
  });

  skillItems.sort((a, b) => a.name.localeCompare(b.name));
  return { thresholdItems, skillItems };
}

/**
 * Derive threshold items from JSONL-based skill aggregates (fallback).
 */
function computeThresholdsFromSkillData(
  skillMap: Map<string, SkillAggregate>,
): CategoryItem[] {
  const skills = [...skillMap.entries()];
  if (skills.length === 0) return [];

  // Skill invocation rate: skills with ≥ 1 completed test
  const invoked = skills.filter(
    ([, agg]) => agg.completedTests.size > 0,
  ).length;
  const invocationRate = (invoked / skills.length) * 100;

  // E2E pass rate: completed / total
  let totalTests = 0;
  let totalCompleted = 0;
  for (const [, agg] of skills) {
    totalTests += agg.tests;
    totalCompleted += agg.completedTests.size;
  }
  const e2ePassRate =
    totalTests > 0 ? (totalCompleted / totalTests) * 100 : 0;

  // Deploy retries: failures in azure-deploy skills
  let deployRetries = 0;
  for (const [skill, agg] of skills) {
    if (skill.startsWith("azure-deploy")) {
      deployRetries += agg.tests - agg.completedTests.size;
    }
  }

  return [
    buildThresholdItem(
      "Skill Invocation Rate",
      invocationRate,
      SKILL_INVOCATION_THRESHOLD,
      "above",
      "%",
    ),
    buildThresholdItem(
      "End-to-End Pass Rate",
      e2ePassRate,
      E2E_PASS_RATE_THRESHOLD,
      "above",
      "%",
    ),
    buildThresholdItem(
      "Deploy Retries",
      deployRetries,
      DEPLOY_RETRY_THRESHOLD,
      "below",
      "count",
    ),
    {
      name: "Confidence Level",
      status: "skip" as CategoryStatus,
      message: "Requires quality report (run npm run quality-report)",
      metadata: {
        metricType: "threshold",
        rate: 0,
        threshold: CONFIDENCE_THRESHOLD,
        met: false,
        unit: "%",
        direction: "above",
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// Collector
// ---------------------------------------------------------------------------

const integrationCollector: Collector = {
  name: "integration",
  version: VERSION,

  async collect(options: CollectorOptions): Promise<CategoryReport> {
    const reportsDir = path.resolve(options.cwd, "tests/reports");

    // 1. Find ALL test-run directories (sorted oldest-first)
    const testRunDirs = await findAllTestRuns(reportsDir);
    if (testRunDirs.length === 0) {
      return makeSkipReport("No test-run directories found");
    }

    // 2. Try to load a quality report from the latest test run
    const latestDir = testRunDirs[testRunDirs.length - 1];
    const latestRunDate = extractRunDate(path.basename(latestDir));
    const qualityReport = await tryLoadQualityReport(latestDir);

    let thresholdItems: CategoryItem[];
    let skillItems: CategoryItem[];

    if (qualityReport) {
      // ── Quality-report path ───────────────────────────────────────────
      const result = buildFromQualityReport(qualityReport, latestRunDate);
      thresholdItems = result.thresholdItems;
      skillItems = result.skillItems;
    } else {
      // ── JSONL fallback path (original logic) ──────────────────────────
      const skillMap = new Map<string, SkillAggregate>();
      let anyDataFound = false;

      for (const testRunDir of testRunDirs) {
        const testRunDirName = path.basename(testRunDir);
        const runDate = extractRunDate(testRunDirName);

        // Read token-summary.jsonl (optional)
        const jsonlPath = path.join(testRunDir, "token-summary.jsonl");
        let entries: TokenSummaryEntry[] = [];
        try {
          const jsonlContent = await readFile(jsonlPath, "utf-8");
          if (jsonlContent.trim()) {
            entries = parseJsonl(jsonlContent);
          }
        } catch {
          // JSONL missing — we still read subdirectories below
        }

        const testDirs = await listTestDirectories(testRunDir);
        if (entries.length === 0 && testDirs.length === 0) continue;
        anyDataFound = true;

        const runSkillMap = new Map<string, SkillAggregate>();

        for (const dir of testDirs) {
          const skill = extractSkillName(dir);
          if (!runSkillMap.has(skill)) {
            runSkillMap.set(skill, {
              tests: 0,
              totalInputTokens: 0,
              totalOutputTokens: 0,
              totalDurationMs: 0,
              apiCalls: 0,
              completedTests: new Set(),
              allTestDirs: new Set(),
              runDate,
            });
          }
          runSkillMap.get(skill)!.allTestDirs.add(dir);
        }

        for (const entry of entries) {
          const skill = extractSkillName(entry.testName);
          if (!runSkillMap.has(skill)) {
            runSkillMap.set(skill, {
              tests: 0,
              totalInputTokens: 0,
              totalOutputTokens: 0,
              totalDurationMs: 0,
              apiCalls: 0,
              completedTests: new Set(),
              allTestDirs: new Set(),
              runDate,
            });
          }
          const agg = runSkillMap.get(skill)!;
          agg.completedTests.add(entry.testName);
          agg.totalInputTokens += entry.inputTokens ?? 0;
          agg.totalOutputTokens += entry.outputTokens ?? 0;
          agg.totalDurationMs += entry.totalApiDurationMs ?? 0;
          agg.apiCalls += entry.apiCallCount ?? 0;
        }

        for (const agg of runSkillMap.values()) {
          agg.tests = Math.max(agg.completedTests.size, agg.allTestDirs.size);
        }

        for (const [skill, agg] of runSkillMap) {
          skillMap.set(skill, agg);
        }
      }

      if (!anyDataFound) {
        return makeSkipReport("No valid test data found across test runs");
      }

      // Build skill items from JSONL data
      skillItems = [];
      for (const [skill, agg] of skillMap) {
        const passed = agg.completedTests.size;
        const total = agg.tests;
        const failed = total - passed;
        const totalTokens = agg.totalInputTokens + agg.totalOutputTokens;

        skillItems.push({
          name: sanitize(skill),
          status: failed > 0 ? "fail" : "pass",
          message: `${passed}/${total} tests completed`,
          metadata: {
            metricType: "skill",
            tests: total,
            passed,
            failed,
            tokenUsage: totalTokens,
            tokenDisplay: formatTokens(totalTokens),
            inputTokens: agg.totalInputTokens,
            outputTokens: agg.totalOutputTokens,
            durationMs: agg.totalDurationMs,
            apiCalls: agg.apiCalls,
            runDate: agg.runDate,
          },
        });
      }

      skillItems.sort((a, b) => a.name.localeCompare(b.name));
      thresholdItems = computeThresholdsFromSkillData(skillMap);
    }

    // 3. Combine items: thresholds first, then per-skill breakdown
    const items = [...thresholdItems, ...skillItems];

    // 4. Overall status from non-skipped thresholds
    const activeThresholds = thresholdItems.filter(
      (i) => i.status !== "skip",
    );
    const hasFailedThreshold = activeThresholds.some(
      (i) => i.status === "fail",
    );
    const hasWarnThreshold = activeThresholds.some(
      (i) => i.status === "warn",
    );
    const overallStatus: CategoryStatus = hasFailedThreshold
      ? "fail"
      : hasWarnThreshold
        ? "warn"
        : "pass";

    return {
      status: overallStatus,
      summary: {
        total: thresholdItems.length,
        passed: thresholdItems.filter((i) => i.status === "pass").length,
        failed: thresholdItems.filter((i) => i.status === "fail").length,
        warnings: thresholdItems.filter((i) => i.status === "warn").length,
        skipped: thresholdItems.filter((i) => i.status === "skip").length,
      },
      items,
      collectedAt: new Date().toISOString(),
      collectorVersion: VERSION,
    };
  },
};

export default integrationCollector;
