#!/usr/bin/env node
/**
 * Dashboard Composer — runs all collectors and produces a unified report.
 *
 * Usage:
 *   npm run dashboard:collect
 *   npm run dashboard:collect -- --output path/to/report.json
 *   npm run dashboard:collect -- --only frontmatter,references
 *   npm run dashboard:collect -- --timeout 60000
 */

import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync, statSync } from "node:fs";
import { resolve, dirname, parse as parsePath } from "node:path";
import { parseArgs } from "node:util";
import type {
  Collector,
  CollectorOptions,
  CategoryReport,
  DashboardReport,
} from "./schema.js";
import { validateDashboardReport } from "./schema.js";
import { sanitizeDashboardReport } from "./sanitize.js";

// ---------------------------------------------------------------------------
// Collector registry — dynamic imports with graceful fallback
// ---------------------------------------------------------------------------

interface CollectorModule {
  default?: Collector;
  [key: string]: unknown;
}

/**
 * Attempt to import a collector module.  Returns `null` when the module
 * does not exist (e.g. being built by a parallel agent).
 */
async function tryImportCollector(
  specifier: string,
  exportName: string,
): Promise<Collector | null> {
  try {
    const mod = (await import(specifier)) as CollectorModule;
    const collector = mod[exportName];
    if (
      collector &&
      typeof collector === "object" &&
      "collect" in collector &&
      typeof (collector as Collector).collect === "function"
    ) {
      return collector as Collector;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Build the full registry of available collectors.
 *
 * Collectors that are not yet on disk (being built by parallel agents) are
 * silently skipped — they will be picked up on the next run.
 */
async function loadCollectors(): Promise<Collector[]> {
  const entries: Array<{ specifier: string; exportName: string }> = [
    { specifier: "./collectors/tests.js", exportName: "default" },
    { specifier: "./collectors/coverage.js", exportName: "default" },
    { specifier: "./collectors/lint.js", exportName: "default" },
    { specifier: "./collectors/typecheck.js", exportName: "default" },
    { specifier: "./collectors/tokens.js", exportName: "default" },
    { specifier: "./collectors/frontmatter.js", exportName: "frontmatterCollector" },
    { specifier: "./collectors/references.js", exportName: "referencesCollector" },
    { specifier: "./collectors/integration.js", exportName: "default" },
  ];

  const collectors: Collector[] = [];

  for (const entry of entries) {
    const collector = await tryImportCollector(entry.specifier, entry.exportName);
    if (collector) {
      collectors.push(collector);
    } else {
      console.error(`[compose] skipping unavailable collector: ${entry.exportName}`);
    }
  }

  return collectors;
}

// ---------------------------------------------------------------------------
// Git metadata helpers
// ---------------------------------------------------------------------------

function gitExec(cmd: string, cwd: string): string {
  try {
    return execSync(cmd, {
      cwd,
      encoding: "utf-8",
      timeout: 5_000,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return "";
  }
}

interface GitMetadata {
  branch: string;
  commit: string;
  commitMessage: string;
}

function getGitMetadata(cwd: string): GitMetadata {
  return {
    branch: gitExec("git rev-parse --abbrev-ref HEAD", cwd),
    commit: gitExec("git rev-parse HEAD", cwd),
    commitMessage: gitExec("git log -1 --pretty=%s", cwd),
  };
}

// ---------------------------------------------------------------------------
// Repo root discovery
// ---------------------------------------------------------------------------

/**
 * Walk up from `startDir` looking for a `.git` directory — the first match
 * is the repo root.
 */
function findRepoRoot(startDir: string): string {
  let dir = resolve(startDir);
  const { root } = parsePath(dir);

  while (dir !== root) {
    try {
      const gitDir = resolve(dir, ".git");
      const gitStat = statSync(gitDir);
      if (gitStat.isDirectory()) return dir;
    } catch {
      // keep walking
    }
    dir = dirname(dir);
  }

  // Fallback — just use startDir
  return startDir;
}

// ---------------------------------------------------------------------------
// Create a skip report for collectors that error out
// ---------------------------------------------------------------------------

function makeSkipReport(collectorName: string, reason: string): CategoryReport {
  return {
    status: "skip",
    summary: { total: 0, passed: 0, failed: 0, warnings: 0, skipped: 0 },
    items: [
      {
        name: collectorName,
        status: "skip",
        message: reason,
      },
    ],
    collectedAt: new Date().toISOString(),
    collectorVersion: "0.0.0",
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      output: { type: "string" },
      only: { type: "string" },
      cwd: { type: "string" },
      timeout: { type: "string" },
    },
    strict: true,
  });

  // Resolve working directory
  const scriptDir = dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"));
  const cwd = values.cwd
    ? resolve(values.cwd)
    : findRepoRoot(scriptDir);

  const timeout = values.timeout ? parseInt(values.timeout, 10) : 30_000;

  // Default output path
  const outputPath = values.output
    ? resolve(values.output)
    : resolve(cwd, "dashboard", "data", "latest.json");

  // Load collectors
  let collectors = await loadCollectors();

  // Filter by --only
  if (values.only) {
    const allowed = new Set(values.only.split(",").map((s) => s.trim()));
    collectors = collectors.filter((c) => allowed.has(c.name));

    if (collectors.length === 0) {
      console.error(`[compose] no matching collectors for --only=${values.only}`);
      console.error(`[compose] available: ${(await loadCollectors()).map((c) => c.name).join(", ")}`);
      process.exitCode = 1;
      return;
    }
  }

  console.error(`[compose] running ${collectors.length} collector(s): ${collectors.map((c) => c.name).join(", ")}`);

  // Run each collector with error isolation
  const collectorOptions: CollectorOptions = { cwd, timeout };
  const categories: Record<string, CategoryReport> = {};

  for (const collector of collectors) {
    console.error(`[compose]   → ${collector.name}...`);
    try {
      const report = await collector.collect(collectorOptions);
      categories[collector.name] = report;
      console.error(`[compose]     ${report.status} (${report.summary.total} items)`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[compose]     ERROR: ${message}`);
      categories[collector.name] = makeSkipReport(collector.name, message);
    }
  }

  // Inject git metadata
  const git = getGitMetadata(cwd);

  // Assemble report
  const report: DashboardReport = {
    schema: "dashboard-report/v1",
    generatedAt: new Date().toISOString(),
    branch: git.branch,
    commit: git.commit,
    commitMessage: git.commitMessage,
    categories,
  };

  // Validate
  const validation = validateDashboardReport(report);
  if (!validation.valid) {
    console.error("[compose] WARNING: report failed validation:");
    for (const err of validation.errors) {
      console.error(`  - ${err}`);
    }
  }

  // Sanitize
  const sanitized = sanitizeDashboardReport(report);

  // Write output
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(sanitized, null, 2), "utf-8");

  console.error(`[compose] report written to ${outputPath}`);
  console.error(`[compose] categories: ${Object.keys(categories).join(", ")}`);

  // Summary
  const statuses = Object.entries(categories).map(
    ([name, cat]) => `${name}=${cat.status}`,
  );
  console.error(`[compose] status: ${statuses.join(", ")}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
