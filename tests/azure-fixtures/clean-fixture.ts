/**
 * Delete every Azure fixture provisioned from a manifest.
 */

import { resolve } from "node:path";

import { deleteResourceGroup, findFixtureResourceGroups, readManifest } from "./fixture-common.ts";

function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1) {
    console.error("Usage: tsx clean-fixture.ts <manifest-path>");
    process.exit(2);
  }

  try {
    const manifest = readManifest(resolve(args[0]));

    for (const bicepConfig of manifest.bicepConfigs) {
      const groups = findFixtureResourceGroups(bicepConfig.fixtureId);

      if (groups.length === 0) {
        console.log(`No resource group found for fixture ${bicepConfig.fixtureId}.`);
        continue;
      }

      for (const group of groups) {
        // Deleting a resource group can take a significantly long time until completion.
        deleteResourceGroup(group.name);
        console.log(`Scheduled deletion of ${group.name} for fixture ${bicepConfig.fixtureId}.`);
      }
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
