/**
 * Jest Global Teardown
 *
 * Runs exactly once after all workers finish.
 * Aggregates per-worker result files into a single testResults.json.
 */

import { readdirSync, readFileSync, writeFileSync, unlinkSync, statSync } from "node:fs";
import { fileURLToPath } from "url";
import * as path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default function globalTeardown() {
  const reportsDir = path.join(__dirname, "reports");
  let files;
  try {
    files = readdirSync(reportsDir).filter((f) => f.startsWith("results-") && f.endsWith(".json"));
  } catch {
    console.log("No reports directory found");
    return;
  }

  if (files.length === 0) {
    console.log("No test results to write");
    return;
  }

  const merged = {};
  for (const file of files) {
    const filePath = path.join(reportsDir, file);
    try {
      const data = JSON.parse(readFileSync(filePath, "utf-8"));
      Object.assign(merged, data);
    } catch (e) {
      console.warn(`Failed to read ${file}: ${e.message}`);
    }
    unlinkSync(filePath);
  }

  if (Object.keys(merged).length === 0) {
    return;
  }

  // Find the most recently created test-run-* folder
  let testRunDirs;
  try {
    testRunDirs = readdirSync(reportsDir)
      .filter((f) => f.startsWith("test-run-"))
      .map((f) => {
        const full = path.join(reportsDir, f);
        return { name: f, path: full, ctime: statSync(full).ctimeMs };
      })
      .filter((entry) => statSync(entry.path).isDirectory())
      .sort((a, b) => b.ctime - a.ctime);
  } catch {
    testRunDirs = [];
  }

  if (testRunDirs.length === 0) {
    console.log("No test-run-* directory found, writing testResults.json to reports/");
    writeFileSync(path.join(reportsDir, "testResults.json"), JSON.stringify(merged, null, 2));
    return;
  }

  const targetDir = testRunDirs[0].path;
  writeFileSync(path.join(targetDir, "testResults.json"), JSON.stringify(merged, null, 2));
  console.log(`Wrote testResults.json to ${testRunDirs[0].name}`);
}
