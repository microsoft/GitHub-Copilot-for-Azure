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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PLUGIN_RELATIVE_PATHS = [
  ".plugin/plugin.json",
  ".claude-plugin/plugin.json",
  ".cursor-plugin/plugin.json"
] as const;

const EXPECTED_VERSION = "0.0.0-placeholder";

function getPluginDirectoryNames(repoRoot: string): string[] {
  const pluginsRoot = path.resolve(repoRoot, "plugins");
  if (!fs.existsSync(pluginsRoot)) {
    return [];
  }

  return fs
    .readdirSync(pluginsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function getPluginJsonPaths(repoRoot: string, pluginDirname: string): string[] {
  const pluginRoot = path.resolve(repoRoot, "plugins", pluginDirname);
  return PLUGIN_RELATIVE_PATHS.map(relativePath => path.resolve(pluginRoot, relativePath));
}

interface PluginConfig {
  version: string;
  [key: string]: unknown;
}

/**
 * Check that all plugin.json files have the placeholder version.
 */
function checkPluginVersionPlaceholders(): void {
  const repoRoot = path.resolve(__dirname, "../..");
  const pluginDirs = getPluginDirectoryNames(repoRoot);

  let hasErrors = false;

  if (pluginDirs.length === 0) {
    console.log("  ℹ️  No plugin directories found under plugins/, skipping...");
  }

  for (const pluginDir of pluginDirs) {
    const pluginJsonPaths = getPluginJsonPaths(repoRoot, pluginDir);

    for (let index = 0; index < pluginJsonPaths.length; index += 1) {
      const fullPath = pluginJsonPaths[index];
      const relativePath = PLUGIN_RELATIVE_PATHS[index];
      const displayPath = path.join("plugins", pluginDir, relativePath).replace(/\\/g, "/");

      if (!fs.existsSync(fullPath)) {
        console.log(`  ℹ️  ${displayPath} not found, skipping...`);
        continue;
      }

      const content = fs.readFileSync(fullPath, "utf8");
      const json: PluginConfig = JSON.parse(content);

      if (json.version === EXPECTED_VERSION) {
        console.log(`  ✅ ${displayPath}: version is "${EXPECTED_VERSION}"`);
      } else {
        console.error(`  ❌ ${displayPath}: expected version "${EXPECTED_VERSION}", found "${json.version}"`);
        hasErrors = true;
      }
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

if (__filename === path.resolve(process.argv[1])) {
  main();
}

export { checkPluginVersionPlaceholders, type PluginConfig };