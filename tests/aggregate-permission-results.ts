/**
 * Combine one skill's permission-specific report artifacts into
 * reports/test-run-all-integration/. Merges testResults.json, concatenates
 * JSONL files (including results.jsonl and token-summary.jsonl), copies per-test
 * directories, and preserves other files under permission-metadata/<group>/.
 * Does not read or publish anything from the raw results/ directory.
 *
 * Used by the report job in .github/workflows/test-all-integration.yml after
 * downloading test artifacts into tests/permission-artifacts/. The combined
 * reports feed skill report generation, artifact/storage uploads, and usage uploads.
 *
 * Requires SKILL (plugin/skill), RUN_ATTEMPT, EXPECTED_PERMISSIONS (JSON array),
 * and GITHUB_OUTPUT. Writes a has-results step output and aggregation.json
 * completeness summary. Missing artifacts or required reports retain available
 * data but cause a nonzero exit; invalid manifests and duplicate tests or report
 * directories throw rather than silently overwrite data.
 * Run from tests/: npx tsx aggregate-permission-results.ts
 */
import {
  appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync,
} from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function latestDirectory(parent: string, prefix = ""): string | undefined {
  if (!existsSync(parent)) {
    return undefined;
  }
  const directory = readdirSync(parent, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name.startsWith(prefix))
    .map(entry => entry.name).sort().at(-1);
  return directory ? path.join(parent, directory) : undefined;
}

function appendJsonl(source: string, destination: string): void {
  const content = readFileSync(source, "utf8").trimEnd();
  if (content) {
    appendFileSync(destination, `${content}\n`, "utf8");
  }
}

export function aggregatePermissionResults(
  artifactsDir: string,
  outputDir: string,
  artifactKey: string,
  attempt: string,
  permissions: string[],
) {
  const reportsDir = path.join(outputDir, "reports/test-run-all-integration");
  mkdirSync(reportsDir, { recursive: true });
  const testResults: Record<string, unknown> = {};
  const issues: string[] = [];
  const outcomes: Record<string, string> = {};

  for (const permission of permissions) {
    const group = permission === "" ? "default" : permission;
    if (!["default", "read", "none"].includes(group)) {
      throw new Error(`Unsupported permission: ${permission}`);
    }
    const artifactDir = path.join(artifactsDir, `integration-${artifactKey}-${group}-${attempt}`);
    const manifestFile = path.join(artifactDir, "permission-run.json");
    if (!existsSync(manifestFile)) {
      issues.push(`Missing execution manifest for ${group}`);
      continue;
    }
    const manifest: unknown = JSON.parse(readFileSync(manifestFile, "utf8"));
    if (!isObject(manifest) || manifest.permission !== permission || typeof manifest.outcome !== "string") {
      throw new Error(`Invalid execution manifest for ${group}`);
    }
    outcomes[group] = manifest.outcome;
    if (!["success", "failure"].includes(manifest.outcome)) {
      issues.push(`Tests did not execute for ${group}: ${manifest.outcome}`);
    }

    const sourceReports = latestDirectory(path.join(artifactDir, "reports"), "test-run-");
    if (!sourceReports) {
      issues.push(`Missing reports directory for ${group}`);
      continue;
    }
    if (!existsSync(path.join(sourceReports, "results.jsonl"))) {
      issues.push(`Missing results.jsonl for ${group}`);
    }
    const testResultsFile = path.join(sourceReports, "testResults.json");
    if (!existsSync(testResultsFile)) {
      issues.push(`Missing testResults.json for ${group}`);
    } else {
      const groupResults: unknown = JSON.parse(readFileSync(testResultsFile, "utf8"));
      if (!isObject(groupResults)) {
        throw new Error(`Invalid testResults.json for ${group}`);
      }
      for (const [test, result] of Object.entries(groupResults)) {
        if (Object.hasOwn(testResults, test)) {
          throw new Error(`Duplicate test across permission groups: ${test}`);
        }
        testResults[test] = result;
      }
    }

    for (const entry of readdirSync(sourceReports, { withFileTypes: true })) {
      const source = path.join(sourceReports, entry.name);
      if (entry.name === "testResults.json") {
        continue;
      }
      if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        appendJsonl(source, path.join(reportsDir, entry.name));
      } else if (entry.isDirectory()) {
        const destination = path.join(reportsDir, entry.name);
        if (existsSync(destination)) {
          throw new Error(`Duplicate report directory across permission groups: ${entry.name}`);
        }
        cpSync(source, destination, { recursive: true, errorOnExist: true, force: false });
      } else {
        const metadataDir = path.join(reportsDir, "permission-metadata", group);
        mkdirSync(metadataDir, { recursive: true });
        cpSync(source, path.join(metadataDir, entry.name), { errorOnExist: true, force: false });
      }
    }
  }

  writeFileSync(path.join(reportsDir, "testResults.json"), JSON.stringify(testResults, null, 2));
  const summary = { complete: issues.length === 0, permissions, outcomes, issues };
  writeFileSync(path.join(reportsDir, "aggregation.json"), JSON.stringify(summary, null, 2));
  return { ...summary, hasResults: Object.keys(testResults).length > 0 };
}

function main(): void {
  const { SKILL, RUN_ATTEMPT, EXPECTED_PERMISSIONS, GITHUB_OUTPUT } = process.env;
  if (!SKILL || !RUN_ATTEMPT || !EXPECTED_PERMISSIONS || !GITHUB_OUTPUT) {
    throw new Error("SKILL, RUN_ATTEMPT, EXPECTED_PERMISSIONS, and GITHUB_OUTPUT are required");
  }
  const permissions: unknown = JSON.parse(EXPECTED_PERMISSIONS);
  if (!Array.isArray(permissions) || !permissions.every((value): value is string => typeof value === "string")) {
    throw new Error("EXPECTED_PERMISSIONS must be an array of strings");
  }
  const summary = aggregatePermissionResults(
    path.resolve("permission-artifacts"), process.cwd(), SKILL.replace("/", "__"), RUN_ATTEMPT, permissions,
  );
  appendFileSync(GITHUB_OUTPUT, `has-results=${summary.hasResults}\n`);
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.complete) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
