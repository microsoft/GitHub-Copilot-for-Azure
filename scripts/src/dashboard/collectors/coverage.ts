/**
 * Coverage collector — parses Istanbul/NYC coverage-summary.json files.
 *
 * Looks for coverage summaries in:
 * - `tests/coverage/coverage-summary.json`   (Jest test coverage)
 * - `scripts/coverage/coverage-summary.json`  (Vitest scripts coverage)
 *
 * Both are optional; if neither exists the collector returns `status: "skip"`.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  Collector,
  CollectorOptions,
  CategoryReport,
  CategoryItem,
  CategoryStatus,
} from "../schema.js";
import { sanitize } from "../sanitize.js";

const VERSION = "1.0.0";

// -- Internal types ----------------------------------------------------------

/** A single Istanbul/NYC coverage metric. */
interface CoverageMetric {
  total: number;
  covered: number;
  skipped: number;
  pct: number;
}

/** Aggregate entry from `coverage-summary.json`. */
interface CoverageEntry {
  statements: CoverageMetric;
  branches: CoverageMetric;
  functions: CoverageMetric;
  lines: CoverageMetric;
}

/** Top-level structure of `coverage-summary.json`. */
interface CoverageSummary {
  total: CoverageEntry;
  [filePath: string]: CoverageEntry;
}

// -- Configuration -----------------------------------------------------------

/** Source locations to scan, paired with display names. */
const SOURCES: ReadonlyArray<{ name: string; rel: string }> = [
  { name: "tests", rel: "tests/coverage/coverage-summary.json" },
  { name: "scripts", rel: "scripts/coverage/coverage-summary.json" },
];

// -- Helpers -----------------------------------------------------------------

/** Determine item status from coverage percentages. */
function statusFromPct(pcts: number[]): CategoryStatus {
  if (pcts.some((p) => p < 50)) return "fail";
  if (pcts.some((p) => p < 80)) return "warn";
  return "pass";
}

/** Return the worst status from a list. */
function worstStatus(statuses: CategoryStatus[]): CategoryStatus {
  if (statuses.includes("fail")) return "fail";
  if (statuses.includes("warn")) return "warn";
  return "pass";
}

/** Try to read and parse a JSON file; returns `null` on any error. */
async function tryReadJson(filePath: string): Promise<CoverageSummary | null> {
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as CoverageSummary;
  } catch {
    return null;
  }
}

// -- Collector ---------------------------------------------------------------

const coverageCollector: Collector = {
  name: "coverage",
  version: VERSION,

  async collect(options: CollectorOptions): Promise<CategoryReport> {
    const items: CategoryItem[] = [];

    for (const source of SOURCES) {
      const absPath = path.resolve(options.cwd, source.rel);
      const data = await tryReadJson(absPath);
      if (!data?.total) continue;

      const { statements, branches, functions, lines } = data.total;
      const pcts = [statements.pct, branches.pct, functions.pct, lines.pct];

      items.push({
        name: source.name,
        status: statusFromPct(pcts),
        metadata: {
          statements: statements.pct,
          branches: branches.pct,
          functions: functions.pct,
          lines: lines.pct,
        },
      });
    }

    if (items.length === 0) {
      return {
        status: "skip",
        summary: { total: 0, passed: 0, failed: 0, warnings: 0, skipped: 0 },
        items: [
          {
            name: "coverage",
            status: "skip",
            message: sanitize("No coverage-summary.json files found"),
          },
        ],
        collectedAt: new Date().toISOString(),
        collectorVersion: VERSION,
      };
    }

    const passedCount = items.filter((i) => i.status === "pass").length;
    const failedCount = items.filter((i) => i.status === "fail").length;
    const warnCount = items.filter((i) => i.status === "warn").length;

    return {
      status: worstStatus(items.map((i) => i.status)),
      summary: {
        total: items.length,
        passed: passedCount,
        failed: failedCount,
        warnings: warnCount,
        skipped: 0,
      },
      items,
      collectedAt: new Date().toISOString(),
      collectorVersion: VERSION,
    };
  },
};

export default coverageCollector;
