import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { FixtureManifest } from "../fixture-common.ts";
import { provision } from "../provision-fixture.ts";

if (process.env.RUN_LIVE_AZURE_FIXTURE_TESTS !== "true") {
  throw new Error("Set RUN_LIVE_AZURE_FIXTURE_TESTS=true to run the live Azure fixture test");
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const manifestPath = resolve(scriptDirectory, "workflow-fixture-live.manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as FixtureManifest;
const result = await provision(manifestPath, manifest);

process.stdout.write(`${result.output}\n`);
