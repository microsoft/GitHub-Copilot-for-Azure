/**
 * Frontmatter collector for the dashboard pipeline.
 *
 * Shells out to `npm run frontmatter -- --json` and transforms the JSON
 * output into a {@link CategoryReport}.
 */

import { execSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
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
  description?: string;
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

const COLLECTOR_VERSION = "1.1.0";

/**
 * Count files (not directories) recursively under `dir`.
 *
 * Returns 0 when the directory is missing or unreadable. Nested sub-skill
 * files are intentionally included so a parent skill's count reflects every
 * file shipped under its directory in the built output.
 */
function countFilesRecursive(dir: string): number {
  let count = 0;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      count += countFilesRecursive(full);
    } else if (entry.isFile()) {
      count += 1;
    }
  }
  return count;
}

/**
 * Populate `metadata.fileCount` on each item from the number of files in the
 * built/output skill directory (the directory containing the skill's
 * SKILL.md, as recorded in `metadata.path`). Mutates and returns `report`.
 */
function addFileCounts(report: CategoryReport, cwd: string): CategoryReport {
  for (const item of report.items) {
    const path = item.metadata?.path;
    if (typeof path !== "string" || path.length === 0) continue;
    const skillDir = resolve(cwd, dirname(path));
    const metadata = item.metadata ?? {};
    metadata.fileCount = countFilesRecursive(skillDir);
    item.metadata = metadata;
  }
  return report;
}

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

    const metadata: Record<string, string | number | boolean> = {
      errors: skill.errors.length,
      warnings: skill.warnings.length,
      checks: totalChecks,
      path: skill.path,
    };
    if (typeof skill.description === "string") {
      // Store the raw description exactly as parsed from the SKILL.md YAML
      // frontmatter — no truncation, sanitizing, or whitespace changes — so
      // consumers (e.g. the Skills dashboard) see the full text and an
      // accurate character length.
      metadata.description = skill.description;
    }

    return {
      name: skill.name,
      status: mapStatus(skill.status),
      message: messages.length > 0
        ? sanitize(messages.join("; "))
        : undefined,
      metadata,
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
    // Validate the built output (output/) rather than the source
    // (plugins/) so that stamped version numbers are used and the
    // CLI does not fail on placeholder versions.
    const builtSkillsDir = resolve(options.cwd, "output");
    let stdout: string;
    try {
      stdout = execSync(
        `npm run frontmatter -- --json "${builtSkillsDir}"`,
        {
          cwd: scriptsCwd,
          timeout: options.timeout,
          encoding: "utf-8",
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
    } catch (err: unknown) {
      // The frontmatter CLI exits with code 1 when there are failures,
      // but still writes valid JSON to stdout.
      const execErr = err as { stdout?: string; status?: number };

      if (typeof execErr.stdout === "string" && execErr.stdout.trim().length > 0) {
        try {
          return addFileCounts(parseFrontmatterJson(execErr.stdout), options.cwd);
        } catch {
          // Fall through to the skip report below when stdout is not valid JSON.
        }
      }

      return {
        status: "skip",
        summary: { total: 0, passed: 0, failed: 0, warnings: 0, skipped: 0 },
        items: [],
        collectedAt: new Date().toISOString(),
        collectorVersion: COLLECTOR_VERSION,
      };
    }

    return addFileCounts(parseFrontmatterJson(stdout), options.cwd);
  },
};
