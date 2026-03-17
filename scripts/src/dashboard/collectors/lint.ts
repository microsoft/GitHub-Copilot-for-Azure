/**
 * Lint collector — runs ESLint in JSON format and parses results.
 *
 * Shells out to `npx eslint --format json .` in both the `scripts/` and
 * `tests/` directories, then aggregates file-level results into a
 * {@link CategoryReport}.
 */

import { execFile } from "node:child_process";
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

/** A single lint message from ESLint's JSON formatter. */
interface EslintMessage {
  ruleId: string | null;
  message: string;
  severity: number;
  line: number;
  column: number;
}

/** A single file entry from ESLint's JSON formatter. */
interface EslintFileResult {
  filePath: string;
  errorCount: number;
  warningCount: number;
  fixableErrorCount: number;
  fixableWarningCount: number;
  messages?: EslintMessage[];
}

// -- Configuration -----------------------------------------------------------

/** Directories to lint, relative to the repo root. */
const LINT_DIRS: readonly string[] = ["scripts", "tests"];

// -- Helpers -----------------------------------------------------------------

/**
 * Run a command via `execFile` and return stdout.
 *
 * Tolerates non-zero exit codes when stdout is available (ESLint exits
 * with code 1 when linting errors are present but still writes JSON).
 */
function execFileAsync(
  command: string,
  args: string[],
  options: { cwd: string; timeout: number },
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      {
        cwd: options.cwd,
        timeout: options.timeout,
        maxBuffer: 10 * 1024 * 1024,
        shell: true,
      },
      (error, stdout) => {
        if (error) {
          // ESLint exits non-zero when errors exist — still parse stdout
          if (stdout) {
            resolve(String(stdout));
            return;
          }
          reject(error);
          return;
        }
        resolve(String(stdout));
      },
    );
  });
}

/**
 * Parse ESLint JSON output into file results; returns `[]` on bad input.
 *
 * When invoked via `npx`/`npm exec`, stdout may contain log lines before
 * the actual JSON array.  We locate the first `[` and parse from there.
 */
function parseEslintOutput(raw: string): EslintFileResult[] {
  const jsonStart = raw.indexOf("[");
  if (jsonStart === -1) return [];

  try {
    const parsed: unknown = JSON.parse(raw.slice(jsonStart));
    if (!Array.isArray(parsed)) return [];
    return parsed as EslintFileResult[];
  } catch {
    return [];
  }
}

// -- Collector ---------------------------------------------------------------

const lintCollector: Collector = {
  name: "lint",
  version: VERSION,

  async collect(options: CollectorOptions): Promise<CategoryReport> {
    const allResults: EslintFileResult[] = [];
    const baseCwd = options.cwd;

    for (const dir of LINT_DIRS) {
      const dirPath = path.resolve(baseCwd, dir);
      try {
        const stdout = await execFileAsync(
          "npx",
          ["eslint", "--format", "json", "."],
          { cwd: dirPath, timeout: options.timeout },
        );
        const results = parseEslintOutput(stdout);
        allResults.push(...results);
      } catch {
        // ESLint not found, config missing, or timeout — skip this dir
      }
    }

    if (allResults.length === 0) {
      return {
        status: "skip",
        summary: { total: 0, passed: 0, failed: 0, warnings: 0, skipped: 0 },
        items: [
          {
            name: "lint",
            status: "skip",
            message: sanitize("ESLint produced no results"),
          },
        ],
        collectedAt: new Date().toISOString(),
        collectorVersion: VERSION,
      };
    }

    // Build items for every file processed
    const items: CategoryItem[] = [];
    for (const file of allResults) {
      const relPath = path.relative(baseCwd, file.filePath);
      let status: CategoryStatus = "pass";
      if (file.errorCount > 0) status = "fail";
      else if (file.warningCount > 0) status = "warn";

      // Build descriptive message from individual ESLint messages
      const msgs = (file.messages || []).filter(
        (m): m is EslintMessage & { ruleId: string } => m.ruleId !== null,
      );
      let message: string | undefined;
      if (msgs.length > 0) {
        const descriptions = msgs
          .slice(0, 3)
          .map((m) => m.ruleId + ": " + m.message);
        if (msgs.length > 3) {
          descriptions.push("+" + (msgs.length - 3) + " more");
        }
        message = sanitize(descriptions.join("; "));
      }

      items.push({
        name: sanitize(relPath),
        status,
        message,
        metadata: {
          errors: file.errorCount,
          warnings: file.warningCount,
          fixable: file.fixableErrorCount + file.fixableWarningCount,
        },
      });
    }

    const passedCount = items.filter((i) => i.status === "pass").length;
    const failedCount = items.filter((i) => i.status === "fail").length;
    const warnCount = items.filter((i) => i.status === "warn").length;

    let overall: CategoryStatus = "pass";
    if (failedCount > 0) overall = "fail";
    else if (warnCount > 0) overall = "warn";

    return {
      status: overall,
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

export default lintCollector;
