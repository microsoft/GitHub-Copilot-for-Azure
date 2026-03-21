/**
 * TypeCheck dashboard collector.
 *
 * Shells out to `tsc --noEmit` for each project directory (scripts/ and tests/)
 * and parses compiler error output into {@link CategoryItem} entries.
 */

import { exec } from "node:child_process";
import { resolve, relative } from "node:path";
import { sanitize } from "../sanitize.js";
import type {
  Collector,
  CollectorOptions,
  CategoryReport,
  CategoryItem,
  CategoryStatus,
} from "../schema.js";

/** Regex for tsc plain-text diagnostic lines: `file(line,col): error TSxxxx: message` */
const TSC_ERROR_REGEX =
  /^(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/;

/** Directories (relative to repo root) whose tsconfigs are checked. */
const PROJECT_DIRS = ["scripts", "tests"];

const COLLECTOR_VERSION = "1.0.0";

export interface TscError {
  file: string;
  line: number;
  column: number;
  code: string;
  message: string;
}

/**
 * Parse the stdout produced by `tsc --noEmit --pretty false`.
 *
 * Each diagnostic line has the format:
 *   path/to/file.ts(line,col): error TSxxxx: description text
 *
 * Lines that do not match (summary, blank) are silently ignored.
 */
export function parseTscOutput(stdout: string): TscError[] {
  const errors: TscError[] = [];
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = TSC_ERROR_REGEX.exec(trimmed);
    if (match) {
      errors.push({
        file: match[1],
        line: Number(match[2]),
        column: Number(match[3]),
        code: match[4],
        message: match[5],
      });
    }
  }
  return errors;
}

/**
 * Run `tsc --noEmit --pretty false` inside {@link cwd} and collect errors.
 *
 * @returns Parsed errors, or `null` when tsc is not available / times out.
 */
function runTsc(
  cwd: string,
  timeout: number,
): Promise<TscError[] | null> {
  return new Promise((resolve) => {
    const child = exec(
      "npx tsc --noEmit --pretty false",
      { cwd, timeout, windowsHide: true },
      (error, stdout) => {
        // tsc exits with code 2 when there are type errors — expected.
        // A genuine "not found" error surfaces as ENOENT or code 127.
        if (error) {
          const code =
            (error as NodeJS.ErrnoException).code;
          if (code === "ENOENT" || code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
            resolve(null);
            return;
          }

          if (error.killed) {
            // Timeout — process was killed.
            resolve(null);
            return;
          }

          // Exit code 2 is "type errors found" — parse stdout.
          if (stdout) {
            resolve(parseTscOutput(stdout));
            return;
          }
          resolve(null);
          return;
        }

        // Exit 0: no errors at all — return empty array.
        resolve([]);
      },
    );

    // Belt-and-suspenders: in case exec timeout doesn't fire.
    child.on("error", () => resolve(null));
  });
}

function errorsToItems(
  errors: TscError[],
  projectDir: string,
  repoRoot: string,
): CategoryItem[] {
  return errors.map((err) => {
    const relPath = relative(repoRoot, resolve(projectDir, err.file));
    return {
      name: relPath.replace(/\\/g, "/"),
      status: "fail" as CategoryStatus,
      message: sanitize(err.message),
      metadata: {
        code: err.code,
        line: err.line,
        column: err.column,
      },
    };
  });
}

function buildReport(
  items: CategoryItem[],
  status: CategoryStatus,
): CategoryReport {
  const failed = items.filter((i) => i.status === "fail").length;
  return {
    status,
    summary: {
      total: items.length,
      passed: items.length - failed,
      failed,
      warnings: 0,
      skipped: 0,
    },
    items,
    collectedAt: new Date().toISOString(),
    collectorVersion: COLLECTOR_VERSION,
  };
}

export const typecheckCollector: Collector = {
  name: "typecheck",
  version: COLLECTOR_VERSION,

  async collect(options: CollectorOptions): Promise<CategoryReport> {
    const { cwd, timeout } = options;

    const allItems: CategoryItem[] = [];
    let anySkipped = false;

    for (const dir of PROJECT_DIRS) {
      const projectDir = resolve(cwd, dir);

      const errors = await runTsc(projectDir, timeout);

      if (errors === null) {
        anySkipped = true;
        continue;
      }

      const items = errorsToItems(errors, projectDir, cwd);
      allItems.push(...items);
    }

    if (anySkipped && allItems.length === 0) {
      return buildReport([], "skip");
    }

    const status: CategoryStatus = allItems.length > 0 ? "fail" : "pass";
    return buildReport(allItems, status);
  },
};

export default typecheckCollector;
