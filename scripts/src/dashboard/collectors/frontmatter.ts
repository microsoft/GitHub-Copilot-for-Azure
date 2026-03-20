/**
 * Frontmatter collector for the dashboard pipeline.
 *
 * Shells out to `npm run frontmatter -- --json` and transforms the JSON
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

// Re-declare the types locally to avoid importing from the frontmatter CLI
// (which has side-effects).  These mirror the exported interfaces in
// `src/frontmatter/cli.ts`.

interface FrontmatterSkillResult {
  name: string;
  path: string;
  status: "pass" | "fail" | "warn";
  errors: string[];
  warnings: string[];
  checks: Record<string, boolean>;
}

interface FrontmatterJsonResult {
  skills: FrontmatterSkillResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
}

const COLLECTOR_VERSION = "1.0.0";

function mapStatus(status: "pass" | "fail" | "warn"): CategoryStatus {
  return status;
}

function buildItems(skills: FrontmatterSkillResult[]): CategoryItem[] {
  return skills.map((skill) => {
    const messages: string[] = [
      ...skill.errors,
      ...skill.warnings,
    ];

    const totalChecks = Object.keys(skill.checks).length;

    return {
      name: skill.name,
      status: mapStatus(skill.status),
      message: messages.length > 0
        ? sanitize(messages.join("; "))
        : undefined,
      metadata: {
        errors: skill.errors.length,
        warnings: skill.warnings.length,
        checks: totalChecks,
      },
    };
  });
}

function overallStatus(summary: FrontmatterJsonResult["summary"]): CategoryStatus {
  if (summary.failed > 0) return "fail";
  if (summary.warnings > 0) return "warn";
  return "pass";
}

export function parseFrontmatterJson(raw: string): CategoryReport {
  // npm may emit log lines before the JSON payload — locate the first `{`.
  const jsonStart = raw.indexOf("{");
  const jsonStr = jsonStart >= 0 ? raw.slice(jsonStart) : raw;
  const data = JSON.parse(jsonStr) as FrontmatterJsonResult;

  return {
    status: overallStatus(data.summary),
    summary: {
      total: data.summary.total,
      passed: data.summary.passed,
      failed: data.summary.failed,
      warnings: data.summary.warnings,
      skipped: 0,
    },
    items: buildItems(data.skills),
    collectedAt: new Date().toISOString(),
    collectorVersion: COLLECTOR_VERSION,
  };
}

export const frontmatterCollector: Collector = {
  name: "frontmatter",
  version: COLLECTOR_VERSION,

  async collect(options: CollectorOptions): Promise<CategoryReport> {
    // The frontmatter npm script lives in scripts/package.json, so we
    // must run from the scripts/ directory, not the repo root.
    const scriptsCwd = resolve(options.cwd, "scripts");
    let stdout: string;
    try {
      stdout = execSync("npm run frontmatter -- --json", {
        cwd: scriptsCwd,
        timeout: options.timeout,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (err: unknown) {
      // The frontmatter CLI exits with code 1 when there are failures,
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

    return parseFrontmatterJson(stdout);
  },
};
