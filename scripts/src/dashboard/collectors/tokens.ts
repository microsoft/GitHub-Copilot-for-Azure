/**
 * Tokens dashboard collector.
 *
 * Shells out to the tokens CLI (`npm run tokens check -- --json`) and maps the
 * {@link ValidationReport} output into a {@link CategoryReport}.
 */

import { exec } from "node:child_process";
import { resolve } from "node:path";
import { sanitize } from "../sanitize.js";
import type {
  Collector,
  CollectorOptions,
  CategoryReport,
  CategoryItem,
  CategoryStatus,
} from "../schema.js";
import type {
  ValidationReport,
  ValidationResult,
} from "../../tokens/commands/types.js";

const COLLECTOR_VERSION = "1.0.0";

/**
 * Percentage of limit at which a file is considered "warning" territory.
 * Files using more than this fraction of their limit but not exceeding it
 * are reported as `"warn"`.
 */
const WARN_THRESHOLD = 0.8;

/**
 * Run the tokens CLI and capture JSON output.
 *
 * @returns Parsed {@link ValidationReport}, or `null` when the CLI is
 *   unavailable or times out.
 */
export function runTokensCli(
  cwd: string,
  timeout: number,
): Promise<ValidationReport | null> {
  return new Promise((resolvePromise) => {
    const child = exec(
      "npm run tokens check -- --json",
      {
        cwd,
        timeout,
        windowsHide: true,
        // Increase buffer — token reports can be large.
        maxBuffer: 10 * 1024 * 1024,
      },
      (error, stdout) => {
        if (error) {
          const code =
            (error as NodeJS.ErrnoException).code;
          if (
            code === "ENOENT" ||
            code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER" ||
            error.killed
          ) {
            resolvePromise(null);
            return;
          }

          // npm may exit non-zero if the check finds exceeded files but
          // still writes JSON to stdout. Try to parse anyway.
          if (stdout) {
            const report = tryParseReport(stdout);
            resolvePromise(report);
            return;
          }

          resolvePromise(null);
          return;
        }

        resolvePromise(tryParseReport(stdout));
      },
    );

    child.on("error", () => resolvePromise(null));
  });
}

/**
 * Extract the JSON object from stdout, which may contain npm log lines
 * before the actual JSON payload.
 */
export function tryParseReport(stdout: string): ValidationReport | null {
  // The npm script may emit log lines before the JSON. Find the first `{`.
  const jsonStart = stdout.indexOf("{");
  if (jsonStart === -1) return null;

  try {
    const parsed: unknown = JSON.parse(stdout.slice(jsonStart));
    if (isValidationReport(parsed)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function isValidationReport(value: unknown): value is ValidationReport {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.timestamp === "string" &&
    typeof obj.totalFiles === "number" &&
    typeof obj.exceededCount === "number" &&
    Array.isArray(obj.results)
  );
}

function itemStatusForResult(result: ValidationResult): CategoryStatus {
  if (result.exceeded) return "fail";
  const percentUsed = result.limit > 0 ? result.tokens / result.limit : 0;
  if (percentUsed > WARN_THRESHOLD) return "warn";
  return "pass";
}

function resultToItem(result: ValidationResult): CategoryItem {
  const status = itemStatusForResult(result);
  const percentUsed =
    result.limit > 0
      ? Math.round((result.tokens / result.limit) * 100)
      : 0;

  const item: CategoryItem = {
    name: result.file,
    status,
    metadata: {
      tokenCount: result.tokens,
      limit: result.limit,
      percentUsed,
      pattern: result.pattern,
    },
  };

  if (status === "fail") {
    item.message = sanitize(
      `Exceeded token limit: ${result.tokens} / ${result.limit} tokens (${percentUsed}%)`,
    );
  } else if (status === "warn") {
    item.message = sanitize(
      `Approaching token limit: ${result.tokens} / ${result.limit} tokens (${percentUsed}%)`,
    );
  }

  return item;
}

function overallStatus(items: CategoryItem[]): CategoryStatus {
  if (items.some((i) => i.status === "fail")) return "fail";
  if (items.some((i) => i.status === "warn")) return "warn";
  return "pass";
}

export const tokensCollector: Collector = {
  name: "tokens",
  version: COLLECTOR_VERSION,

  async collect(options: CollectorOptions): Promise<CategoryReport> {
    const scriptsDir = resolve(options.cwd, "scripts");
    const report = await runTokensCli(scriptsDir, options.timeout);

    if (report === null) {
      return {
        status: "skip",
        summary: {
          total: 0,
          passed: 0,
          failed: 0,
          warnings: 0,
          skipped: 0,
        },
        items: [],
        collectedAt: new Date().toISOString(),
        collectorVersion: COLLECTOR_VERSION,
      };
    }

    const items = report.results.map(resultToItem);
    const status = overallStatus(items);

    const failed = items.filter((i) => i.status === "fail").length;
    const warnings = items.filter((i) => i.status === "warn").length;
    const passed = items.filter((i) => i.status === "pass").length;

    return {
      status,
      summary: {
        total: items.length,
        passed,
        failed,
        warnings,
        skipped: 0,
      },
      items,
      collectedAt: new Date().toISOString(),
      collectorVersion: COLLECTOR_VERSION,
    };
  },
};

export default tokensCollector;
