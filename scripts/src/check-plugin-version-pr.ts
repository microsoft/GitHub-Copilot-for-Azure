#!/usr/bin/env node
/**
 * PR Plugin Version Check
 * 
 * Validates that all plugin.json files use the "0.0.0-placeholder" version.
 * Real versions are stamped at build time by NBGV, so the source should
 * never contain a real version number.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const PLUGIN_PATHS = [
  "plugin/.plugin/plugin.json",
  "plugin/.claude-plugin/plugin.json",
  "plugin/.cursor-plugin/plugin.json"
] as const;

const EXPECTED_VERSION = "0.0.0-placeholder";

interface PluginConfig {
  version: string;
  [key: string]: unknown;
}

/**
 * Check that all plugin.json files have the placeholder version.
 */
function checkPluginVersionPlaceholders(): void {
  const repoRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../.."
  );

  let hasErrors = false;

  for (const pluginPath of PLUGIN_PATHS) {
    const fullPath = path.resolve(repoRoot, pluginPath);

    if (!fs.existsSync(fullPath)) {
      console.log(`  ℹ️  ${pluginPath} not found, skipping...`);
      continue;
    }

    const content = fs.readFileSync(fullPath, "utf8");
    const json: PluginConfig = JSON.parse(content);

    if (json.version === EXPECTED_VERSION) {
      console.log(`  ✅ ${pluginPath}: version is "${EXPECTED_VERSION}"`);
    } else {
      console.error(`  ❌ ${pluginPath}: expected version "${EXPECTED_VERSION}", found "${json.version}"`);
      hasErrors = true;
    }
  }

  if (hasErrors) {
    console.error("\n❌ Plugin version check failed!");
    console.error("   Plugin versions are stamped automatically at build time by NBGV.");
    console.error(`   Source files must always use "${EXPECTED_VERSION}".\n`);
    process.exit(1);
  } else {
    console.log("\n✅ All plugin.json files have the correct placeholder version.");
  }
}

function main(): void {
  console.log("🔍 Checking plugin.json versions are placeholders...\n");
  checkPluginVersionPlaceholders();
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}

export { checkPluginVersionPlaceholders, type PluginConfig };