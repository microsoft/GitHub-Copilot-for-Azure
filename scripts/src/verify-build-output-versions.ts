#!/usr/bin/env node
/**
 * Verify Build Output Versions
 *
 * Validates that all SKILL.md and plugin.json files in the build output
 * have valid semver versions (not placeholders). This confirms that the
 * NBGV stamping pipeline ran successfully.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const SEMVER_RE = /^\d+\.\d+\.\d+$/;
const PLACEHOLDER = "0.0.0-placeholder";

function verifyBuildOutputVersions(outputDir: string): boolean {
  let hasError = false;

  // Check all SKILL.md files have real semver versions (not placeholder)
  const skillsDir = path.join(outputDir, "skills");
  if (fs.existsSync(skillsDir)) {
    for (const dir of fs.readdirSync(skillsDir)) {
      const skillPath = path.join(skillsDir, dir, "SKILL.md");
      if (!fs.existsSync(skillPath)) continue;
      const content = fs.readFileSync(skillPath, "utf8");
      const match = content.match(/^\s*version:\s*"([^"]+)"/m);
      if (!match) {
        console.log(`❌ ${skillPath}: no version found in frontmatter`);
        hasError = true;
      } else if (match[1] === PLACEHOLDER) {
        console.log(
          `❌ ${skillPath}: version is still placeholder "${PLACEHOLDER}"`
        );
        hasError = true;
      } else if (!SEMVER_RE.test(match[1])) {
        console.log(
          `❌ ${skillPath}: version "${match[1]}" is not valid semver`
        );
        hasError = true;
      } else {
        console.log(`✅ ${skillPath}: ${match[1]}`);
      }
    }
  }

  // Check all plugin.json files have real semver versions (not placeholder)
  const pluginDirs = [".plugin", ".claude-plugin", ".cursor-plugin"];
  for (const dir of pluginDirs) {
    const jsonPath = path.join(outputDir, dir, "plugin.json");
    if (!fs.existsSync(jsonPath)) continue;
    const json = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    if (json.version === PLACEHOLDER) {
      console.log(
        `❌ ${jsonPath}: version is still placeholder "${PLACEHOLDER}"`
      );
      hasError = true;
    } else if (!SEMVER_RE.test(json.version)) {
      console.log(
        `❌ ${jsonPath}: version "${json.version}" is not valid semver`
      );
      hasError = true;
    } else {
      console.log(`✅ ${jsonPath}: ${json.version}`);
    }
  }

  return !hasError;
}

function main(): void {
  const outputDir =
    process.argv[2] ||
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../output");

  console.log(`🔍 Verifying build output versions in ${outputDir}\n`);

  if (!fs.existsSync(outputDir)) {
    console.error(`❌ Output directory not found: ${outputDir}`);
    process.exit(1);
  }

  const ok = verifyBuildOutputVersions(outputDir);

  if (ok) {
    console.log("\n✅ All built output files have valid semver versions.");
  } else {
    console.error(
      "\n❌ Build output contains invalid or placeholder versions. NBGV stamping may have failed."
    );
    process.exit(1);
  }
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}

export { verifyBuildOutputVersions };
