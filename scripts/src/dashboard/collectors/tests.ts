/**
 * Tests collector — parses JUnit XML reports.
 *
 * Reads `tests/reports/junit.xml` relative to the repository root and
 * produces a {@link CategoryReport} with one item per test suite.
 */

import { readFile, readdir, open } from "node:fs/promises";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";
import type {
  Collector,
  CollectorOptions,
  CategoryReport,
  CategoryItem,
} from "../schema.js";
import { sanitize } from "../sanitize.js";

const VERSION = "1.0.0";

/** Build a skip report with an explanatory item. */
function makeSkipReport(message: string): CategoryReport {
  return {
    status: "skip",
    summary: { total: 0, passed: 0, failed: 0, warnings: 0, skipped: 0 },
    items: [{ name: "tests", status: "skip", message: sanitize(message) }],
    collectedAt: new Date().toISOString(),
    collectorVersion: VERSION,
  };
}

/**
 * Extract an array of test-suite nodes from the parsed XML object.
 *
 * Handles both `<testsuites><testsuite …>` (standard JUnit) and
 * bare `<testsuite …>` at the document root.  Also handles the case
 * where fast-xml-parser returns a single object instead of an array
 * when only one `<testsuite>` element exists.
 */
function extractSuites(parsed: unknown): Record<string, unknown>[] {
  if (!parsed || typeof parsed !== "object") return [];

  const obj = parsed as Record<string, unknown>;

  // <testsuites><testsuite …>
  if (obj.testsuites && typeof obj.testsuites === "object") {
    const wrapper = obj.testsuites as Record<string, unknown>;
    if (Array.isArray(wrapper.testsuite)) {
      return wrapper.testsuite as Record<string, unknown>[];
    }
    if (wrapper.testsuite && typeof wrapper.testsuite === "object") {
      return [wrapper.testsuite as Record<string, unknown>];
    }
  }

  // <testsuite …> at root (no wrapper)
  if (Array.isArray(obj.testsuite)) {
    return obj.testsuite as Record<string, unknown>[];
  }
  if (obj.testsuite && typeof obj.testsuite === "object") {
    return [obj.testsuite as Record<string, unknown>];
  }

  return [];
}

const testsCollector: Collector = {
  name: "tests",
  version: VERSION,

  async collect(options: CollectorOptions): Promise<CategoryReport> {
    const reportsDir = path.resolve(options.cwd, "tests/reports");
    const primaryPath = path.join(reportsDir, "junit.xml");

    // 1. Open and read primary file via file descriptor to avoid TOCTOU races
    let xml: string;
    let fd;
    try {
      fd = await open(primaryPath, "r");
      xml = await fd.readFile("utf-8");
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        return makeSkipReport("JUnit XML not found");
      }
      return makeSkipReport(String(err));
    } finally {
      await fd?.close();
    }

    if (!xml.trim()) {
      return makeSkipReport("JUnit XML is empty");
    }

    // 2. Parse primary XML
    let parsed: unknown;
    try {
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        processEntities: false,
      });
      parsed = parser.parse(xml);
    } catch (err) {
      return makeSkipReport(`Malformed XML: ${String(err)}`);
    }

    // 3. Extract suites from primary file
    const suites = extractSuites(parsed);

    // 4. Scan for additional JUnit XML files (e.g. integration tests)
    try {
      const entries = await readdir(reportsDir, { recursive: true });
      for (const entry of entries) {
        const entryStr = String(entry);
        if (path.basename(entryStr) !== "junit.xml") continue;
        const fullPath = path.join(reportsDir, entryStr);
        if (fullPath === primaryPath) continue;

        try {
          const extraXml = await readFile(fullPath, "utf-8");
          if (!extraXml.trim()) continue;
          const extraParser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: "@_",
            processEntities: false,
          });
          const extraParsed = extraParser.parse(extraXml);
          suites.push(...extractSuites(extraParsed));
        } catch {
          // Skip unreadable additional files
        }
      }
    } catch {
      // readdir failed — use only primary results
    }

    if (suites.length === 0) {
      return makeSkipReport("No test suites found in JUnit XML");
    }

    // 5. Build items
    const items: CategoryItem[] = [];
    for (const suite of suites) {
      const name = String(suite["@_name"] ?? "unnamed");
      const tests = Number(suite["@_tests"] ?? 0);
      const failures = Number(suite["@_failures"] ?? 0);
      const errors = Number(suite["@_errors"] ?? 0);
      const time = Number(suite["@_time"] ?? 0);
      const hasFailed = failures > 0 || errors > 0;

      items.push({
        name: sanitize(name),
        status: hasFailed ? "fail" : "pass",
        metadata: { tests, failures, errors, time },
      });
    }

    // 6. Compute overall
    const passedCount = items.filter((i) => i.status === "pass").length;
    const failedCount = items.filter((i) => i.status === "fail").length;

    return {
      status: failedCount > 0 ? "fail" : "pass",
      summary: {
        total: items.length,
        passed: passedCount,
        failed: failedCount,
        warnings: 0,
        skipped: 0,
      },
      items,
      collectedAt: new Date().toISOString(),
      collectorVersion: VERSION,
    };
  },
};

export default testsCollector;
