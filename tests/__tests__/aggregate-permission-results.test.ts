import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { aggregatePermissionResults } from "../aggregate-permission-results.ts";

describe("aggregatePermissionResults", () => {
  let directory: string;
  let artifacts: string;
  let output: string;

  beforeEach(() => {
    directory = mkdtempSync(path.join(tmpdir(), "aggregate-permissions-"));
    artifacts = path.join(directory, "artifacts");
    output = path.join(directory, "output");
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  function addArtifact(permission: string, testName: string, outcome = "success") {
    const group = permission || "default";
    const artifact = path.join(artifacts, `integration-plugin__skill-${group}-1`);
    const reports = path.join(artifact, "reports/test-run-2026-10-27");
    mkdirSync(path.join(reports, testName), { recursive: true });
    writeFileSync(path.join(artifact, "permission-run.json"), JSON.stringify({ permission, outcome }));
    writeFileSync(path.join(reports, "testResults.json"), JSON.stringify({ [testName]: { isPass: outcome === "success" } }));
    writeFileSync(path.join(reports, testName, "trajectory.md"), group);
    writeFileSync(path.join(reports, testName, ".hidden"), "preserved");
    writeFileSync(path.join(reports, "token-summary.jsonl"), JSON.stringify({ testName }));
    writeFileSync(path.join(reports, "results.jsonl"), JSON.stringify({ group }));
    writeFileSync(path.join(reports, "metadata.json"), JSON.stringify({ group }));
    return artifact;
  }

  test("merges reports and concatenates both JSONL files from all three groups", () => {
    addArtifact("read", "skill_read");
    addArtifact("none", "skill_none");
    addArtifact("", "skill_default");
    const summary = aggregatePermissionResults(artifacts, output, "plugin__skill", "1", ["read", "none", ""]);
    expect(summary.complete).toBe(true);
    expect(summary.hasResults).toBe(true);
    const reports = path.join(output, "reports/test-run-all-integration");
    expect(Object.keys(JSON.parse(readFileSync(path.join(reports, "testResults.json"), "utf8"))))
      .toEqual(["skill_read", "skill_none", "skill_default"]);
    expect(readFileSync(path.join(reports, "token-summary.jsonl"), "utf8"))
      .toBe('{"testName":"skill_read"}\n{"testName":"skill_none"}\n{"testName":"skill_default"}\n');
    expect(readFileSync(path.join(reports, "results.jsonl"), "utf8"))
      .toBe('{"group":"read"}\n{"group":"none"}\n{"group":"default"}\n');
    expect(readFileSync(path.join(reports, "skill_none/.hidden"), "utf8")).toBe("preserved");
    expect(readFileSync(path.join(reports, "permission-metadata/read/metadata.json"), "utf8")).toBe('{"group":"read"}');
    expect(existsSync(path.join(output, "results"))).toBe(false);
  });

  test("preserves available results and marks missing groups incomplete", () => {
    addArtifact("read", "skill_read");
    const summary = aggregatePermissionResults(artifacts, output, "plugin__skill", "1", ["read", "none"]);
    expect(summary.complete).toBe(false);
    expect(summary.hasResults).toBe(true);
    expect(summary.issues).toContain("Missing execution manifest for none");
  });

  test("accepts failed tests with complete result files", () => {
    addArtifact("read", "skill_read", "failure");
    const summary = aggregatePermissionResults(artifacts, output, "plugin__skill", "1", ["read"]);
    expect(summary.complete).toBe(true);
    expect(summary.outcomes).toEqual({ read: "failure" });
  });

  test("rejects duplicate test keys rather than overwriting them", () => {
    addArtifact("read", "skill_same");
    addArtifact("", "skill_same");
    expect(() => aggregatePermissionResults(artifacts, output, "plugin__skill", "1", ["read", ""]))
      .toThrow("Duplicate test");
  });

  test("marks jobs that never ran their tests as incomplete", () => {
    addArtifact("read", "skill_read", "skipped");
    const summary = aggregatePermissionResults(artifacts, output, "plugin__skill", "1", ["read"]);
    expect(summary.complete).toBe(false);
    expect(summary.issues).toContain("Tests did not execute for read: skipped");
  });

  test("marks a missing reports results.jsonl as incomplete", () => {
    const artifact = addArtifact("read", "skill_read");
    unlinkSync(path.join(artifact, "reports/test-run-2026-10-27/results.jsonl"));
    const summary = aggregatePermissionResults(artifacts, output, "plugin__skill", "1", ["read"]);
    expect(summary.complete).toBe(false);
    expect(summary.issues).toContain("Missing results.jsonl for read");
  });
});
