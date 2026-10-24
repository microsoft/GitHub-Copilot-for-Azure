import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

interface FixtureRecord {
  fixtureId: string;
  fixtureVersion: number;
}

interface FixtureManifestRecord {
  id: string;
  fixtures: FixtureRecord[];
}

interface FixtureManifestInventory {
  fixtureManifests: FixtureManifestRecord[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function manifestSource(repoRoot: string, manifestPath: string): string {
  return relative(repoRoot, manifestPath)
    .replaceAll("\\", "/");
}

function parseFixtureManifest(
  repoRoot: string,
  manifestPath: string,
): FixtureManifestRecord | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as unknown;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse ${manifestSource(repoRoot, manifestPath)}: ${message}`, { cause: error });
  }

  if (
    !isRecord(parsed)
    || (parsed.type !== "readOnly" && parsed.type !== "readWrite")
    || !Array.isArray(parsed.bicepConfigs)
  ) {
    return undefined;
  }

  if (typeof parsed.id !== "string" || !parsed.id.trim()) {
    throw new Error(`Fixture manifest ${manifestSource(repoRoot, manifestPath)} has an invalid id`);
  }

  if (!Number.isInteger(parsed.version) || (parsed.version as number) < 0) {
    throw new Error(`Fixture manifest ${manifestSource(repoRoot, manifestPath)} has an invalid version`);
  }

  const fixtureVersion = parsed.version as number;
  const fixtures = parsed.bicepConfigs.map((config, index): FixtureRecord => {
    if (!isRecord(config) || typeof config.fixtureId !== "string" || !config.fixtureId.trim()) {
      throw new Error(
        `Fixture manifest ${manifestSource(repoRoot, manifestPath)} has an invalid fixtureId at bicepConfigs[${index}]`,
      );
    }
    return {
      fixtureId: config.fixtureId,
      fixtureVersion,
    };
  });

  return {
    id: parsed.id,
    fixtures,
  };
}

function listManifestPaths(repoRoot: string): string[] {
  const output = execFileSync(
    "git",
    ["ls-files", "-co", "--exclude-standard", "--", "*.manifest.json"],
    {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map((path) => resolve(repoRoot, path))
    .filter((path) => existsSync(path))
    .sort();
}

export function collectFixtureManifests(repoRoot: string): FixtureManifestInventory {
  const fixtureManifests = listManifestPaths(repoRoot)
    .map((path) => parseFixtureManifest(repoRoot, path))
    .filter((manifest): manifest is FixtureManifestRecord => manifest !== undefined);

  const inventory = { fixtureManifests };
  const outputPath = resolve(repoRoot, "dashboard", "data", "fixtureManifests.json");
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(inventory, null, 2)}\n`, "utf8");
  return inventory;
}
