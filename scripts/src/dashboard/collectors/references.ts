/**
 * References collector for the dashboard pipeline.
 *
 * Shells out to `npm run references -- --json` and transforms the JSON
 * output into a {@link CategoryReport}.
 */

import { execSync } from "node:child_process";
import { resolve } from "node:path";
import type {
  Collector,
  CollectorOptions,
  CategoryReport,
  CategoryItem,
  CategoryStatus,
} from "../schema.js";
import { sanitize } from "../sanitize.js";

// Re-declare the types locally to avoid importing from the references CLI
// (which has side-effects).  These mirror the exported interfaces in
// `src/references/cli.ts`.

interface ReferenceEntry {
  source: string;
  target: string;
  status: "valid" | "broken" | "warning";
  message?: string;
}

interface ReferencesJsonResult {
  references: ReferenceEntry[];
  summary: {
    total: number;
    valid: number;
    broken: number;
    warnings: number;
  };
}

const COLLECTOR_VERSION = "1.0.0";

function mapRefStatus(status: "valid" | "broken" | "warning"): CategoryStatus {
  switch (status) {
    case "valid":
      return "pass";
    case "broken":
      return "fail";
    case "warning":
      return "warn";
  }
}

function buildItems(refs: ReferenceEntry[]): CategoryItem[] {
  return refs.map((ref) => {
    const parts: string[] = [ref.target];
    if (ref.message) {
      parts.push(ref.message);
    }

    return {
      name: ref.source,
      status: mapRefStatus(ref.status),
      message: sanitize(parts.join(" — ")),
    };
  });
}

function overallStatus(summary: ReferencesJsonResult["summary"]): CategoryStatus {
  if (summary.broken > 0) return "fail";
  if (summary.warnings > 0) return "warn";
  return "pass";
}

export function parseReferencesJson(raw: string): CategoryReport {
  // npm may emit log lines before the JSON payload — locate the first `{`.
  const jsonStart = raw.indexOf("{");
  const jsonStr = jsonStart >= 0 ? raw.slice(jsonStart) : raw;
  const data = JSON.parse(jsonStr) as ReferencesJsonResult;

  return {
    status: overallStatus(data.summary),
    summary: {
      total: data.summary.total,
      passed: data.summary.valid,
      failed: data.summary.broken,
      warnings: data.summary.warnings,
      skipped: 0,
    },
    items: buildItems(data.references),
    collectedAt: new Date().toISOString(),
    collectorVersion: COLLECTOR_VERSION,
  };
}

export const referencesCollector: Collector = {
  name: "references",
  version: COLLECTOR_VERSION,

  async collect(options: CollectorOptions): Promise<CategoryReport> {
    // The references npm script lives in scripts/package.json, so we
    // must run from the scripts/ directory, not the repo root.
    const scriptsCwd = resolve(options.cwd, "scripts");
    let stdout: string;
    try {
      stdout = execSync("npm run references -- --json", {
        cwd: scriptsCwd,
        timeout: options.timeout,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (err: unknown) {
      // The references CLI exits with code 1 when there are broken refs,
      // but still writes valid JSON to stdout.
      const execErr = err as { stdout?: string; status?: number };
      if (execErr.stdout && execErr.stdout.trim().startsWith("{")) {
        stdout = execErr.stdout;
      } else {
        return {
          status: "skip",
          summary: { total: 0, passed: 0, failed: 0, warnings: 0, skipped: 0 },
          items: [],
          collectedAt: new Date().toISOString(),
          collectorVersion: COLLECTOR_VERSION,
        };
      }
    }

    return parseReferencesJson(stdout);
  },
};
