#!/usr/bin/env node
/**
 * PR Plugin Version Check
 * 
 * This script ensures that plugin versions are not manually updated in PRs.
 * Plugin versions should be updated automatically through CI/CD processes.
 */

import { execFileSync } from "node:child_process";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const PLUGIN_PATHS = [
  "plugin/.plugin/plugin.json",
  "plugin/.claude-plugin/plugin.json",
  "plugin/.cursor-plugin/plugin.json"
] as const;

interface PluginConfig {
  version: string;
  name?: string;
  description?: string;
  [key: string]: unknown;
}

interface VersionChange {
  file: string;
  baseVersion: string | undefined;
  headVersion: string | undefined;
}

/**
 * Get file content at a specific git reference
 */
function getFileAtRef(filePath: string, ref: string): string | null {
  try {
    const content = execFileSync("git", ["show", `${ref}:${filePath}`], {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"] // Suppress stderr
    });
    return content.trim();
  } catch (error) {
    console.error(`Error retrieving ${filePath} at ${ref}:`, error);
    return null;
  }
}

/**
 * Parse JSON content safely
 */
function parseJsonSafely(content: string | null): PluginConfig | null {
  try {
    return content ? JSON.parse(content) : null;
  } catch (error) {
    console.error("Error parsing JSON content for:\n", content, "\nHere is the error:", error);
    return null;
  }
}

/**
 * Validate that a git ref is a safe commit SHA.
 * We are intentionally conservative and only allow full/abbreviated hex SHAs.
 */
function validateGitRef(ref: string): boolean {
  // Disallow values that could be parsed as options or complex revision syntax.
  // Accept only hex commit SHAs (7-40 characters).
  return /^[0-9a-fA-F]{7,40}$/.test(ref);
}

/**
 * Check if plugin versions have changed between base and head
 */
function checkPluginVersionChanges(): void {
  const baseSha = process.env.BASE_SHA;
  const headSha = process.env.HEAD_SHA;

  if (!baseSha || !headSha) {
    console.error("❌ Missing BASE_SHA or HEAD_SHA environment variables");
    return;
  }

  if (!validateGitRef(baseSha) || !validateGitRef(headSha)) {
    console.error("❌ Invalid BASE_SHA or HEAD_SHA value. Expected a commit SHA.");
    return;
  }

  console.log(`🔍 Checking plugin version changes between ${baseSha} and ${headSha}`);

  let hasVersionChanges = false;
  const changes: VersionChange[] = [];

  for (const pluginPath of PLUGIN_PATHS) {
    console.log(`\n📝 Checking ${pluginPath}...`);

    // Get file content at base and head
    const baseContent = getFileAtRef(pluginPath, baseSha);
    const headContent = getFileAtRef(pluginPath, headSha);

    if (baseContent === null || headContent === null) {
      console.log(`  ℹ️  File not found in either version of ${pluginPath}, skipping...`);
      continue;
    }

    // Parse JSON
    const baseJson = parseJsonSafely(baseContent);
    const headJson = parseJsonSafely(headContent);

    if (baseJson === null || headJson === null) {
      console.log(`  ℹ️  Failed to parse JSON content in either version of ${pluginPath}, skipping...`);
      continue;
    }

    // Compare versions
    const baseVersion = baseJson?.version;
    const headVersion = headJson?.version;

    if (baseVersion !== headVersion) {
      hasVersionChanges = true;
      changes.push({
        file: pluginPath,
        baseVersion,
        headVersion
      });
      console.log(`  ❌ Version changed: ${baseVersion} → ${headVersion}`);
    } else {
      console.log(`  ✅ Version unchanged: ${baseVersion}`);
    }
  }

  // Report results
  if (hasVersionChanges) {
    console.error("\n❌ Plugin version changes detected in this PR!\n");
    console.error("The following plugin versions were modified:");

    for (const change of changes) {
      console.error(`  📄 ${change.file}`);
      console.error(`     ${change.baseVersion} → ${change.headVersion}`);
    }

    console.error("\n🚫 Plugin versions should not be updated manually in PRs.");
    console.error("   Plugin versions are managed automatically through CI/CD.");
    console.error("   Please revert the version changes in your PR.\n");

    process.exit(1);
  } else {
    console.log("\n✅ No plugin version changes detected. PR check passed!");
  }
}

/**
 * Main function for CLI execution
 */
function main(): void {
  checkPluginVersionChanges();
}

// Only run main if this file is executed directly (not imported)
// Convert import.meta.url to file path and compare with resolved argv[1]
if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}

export { checkPluginVersionChanges, type PluginConfig, type VersionChange };