import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { collectFixtureManifests } from "../fixture-manifest-collect.js";

const tempDirectories: string[] = [];

function writeJson(path: string, value: unknown): void {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, JSON.stringify(value), "utf8");
}

function fixtureManifest(id: string, fixtureId: string, version: number): object {
  return {
    id,
    schemaVersion: 1,
    version,
    type: "readOnly",
    description: "Test fixture",
    bicepConfigs: [{ fixtureId }],
  };
}

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("collectFixtureManifests", () => {
  it("writes fixture manifests and excludes ignored and non-fixture manifests", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "fixture-manifest-collect-"));
    tempDirectories.push(repoRoot);
    execFileSync("git", ["init"], { cwd: repoRoot, stdio: "ignore" });

    writeFileSync(join(repoRoot, ".gitignore"), "ignored/\n", "utf8");
    writeJson(
      join(repoRoot, "evals", "skill-a", "azure.manifest.json"),
      fixtureManifest("manifest-a", "fixture-a", 3),
    );
    writeJson(
      join(repoRoot, "evals", "skill-b", "azure.manifest.json"),
      {
        ...fixtureManifest("manifest-b", "fixture-b-primary", 7),
        bicepConfigs: [
          { fixtureId: "fixture-b-primary" },
          { fixtureId: "fixture-b-secondary" },
        ],
      },
    );
    writeJson(join(repoRoot, "config", "tool.manifest.json"), { name: "not-a-fixture" });
    writeJson(
      join(repoRoot, "ignored", "azure.manifest.json"),
      fixtureManifest("ignored-manifest", "ignored-fixture", 1),
    );
    const deletedManifestPath = join(repoRoot, "deleted.manifest.json");
    writeJson(deletedManifestPath, fixtureManifest("deleted-manifest", "deleted-fixture", 1));
    execFileSync("git", ["add", "deleted.manifest.json"], { cwd: repoRoot, stdio: "ignore" });
    rmSync(deletedManifestPath);

    const inventory = collectFixtureManifests(repoRoot);

    expect(inventory).toEqual({
      fixtureManifests: [
        {
          id: "manifest-a",
          fixtures: [{ fixtureId: "fixture-a", fixtureVersion: 3 }],
        },
        {
          id: "manifest-b",
          fixtures: [
            { fixtureId: "fixture-b-primary", fixtureVersion: 7 },
            { fixtureId: "fixture-b-secondary", fixtureVersion: 7 },
          ],
        },
      ],
    });
    expect(
      JSON.parse(
        readFileSync(join(repoRoot, "dashboard", "data", "fixtureManifests.json"), "utf8"),
      ),
    ).toEqual(inventory);
  });

  it("fails with the manifest path when fixture data is invalid", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "fixture-manifest-collect-"));
    tempDirectories.push(repoRoot);
    execFileSync("git", ["init"], { cwd: repoRoot, stdio: "ignore" });
    writeJson(join(repoRoot, "fixtures", "broken.manifest.json"), {
      id: "broken-manifest",
      version: 1,
      type: "readOnly",
      bicepConfigs: [{}],
    });

    expect(() => collectFixtureManifests(repoRoot)).toThrow(
      "Fixture manifest fixtures/broken.manifest.json has an invalid fixtureId at bicepConfigs[0]",
    );
  });

  it("fails when a fixture manifest has no id", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "fixture-manifest-collect-"));
    tempDirectories.push(repoRoot);
    execFileSync("git", ["init"], { cwd: repoRoot, stdio: "ignore" });
    writeJson(join(repoRoot, "fixtures", "missing-id.manifest.json"), {
      version: 1,
      type: "readOnly",
      bicepConfigs: [{ fixtureId: "fixture-a" }],
    });

    expect(() => collectFixtureManifests(repoRoot)).toThrow(
      "Fixture manifest fixtures/missing-id.manifest.json has an invalid id",
    );
  });
});
