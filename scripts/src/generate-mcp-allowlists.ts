#!/usr/bin/env node
/**
 * Generate MCP Allowlists
 *
 * Generates `allowed-skill-names.json` and `allowed-plugin-file-references.json`
 * for the Azure MCP server allowlists.
 *
 * Usage:
 *   npm run generateMcpAllowlists -- <skills_dir> [output_dir]
 *
 * Outputs two JSON files in <output_dir> (defaults to current working directory):
 *   allowed-skill-names.json
 *   allowed-plugin-file-references.json
 */

import * as fs from "node:fs";
import * as path from "node:path";

const EXCLUDED_FILENAMES = new Set([
  "SKILL.md",
  "version.json",
  "LICENSE",
  "LICENSE.txt",
  "LICENSE.md",
]);

function walkDir(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      // Skip symlinks (defense-in-depth against symlink traversal)
      continue;
    }
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath));
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }
  return results;
}

function generateAllowlists(skillsDir: string, outputDir: string): void {
  if (!fs.existsSync(skillsDir) || !fs.statSync(skillsDir).isDirectory()) {
    console.error(`ERROR: skills directory not found: ${skillsDir}`);
    process.exit(1);
  }

  // Get sorted list of skill directory names (exclude hidden directories)
  const skillNames = fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name)
    .sort();

  if (skillNames.length === 0) {
    console.error(
      `ERROR: No skills found in ${skillsDir} - aborting to prevent empty sync`
    );
    process.exit(1);
  }

  // Collect all reference file paths (Windows-style backslash separators).
  // Exclude SKILL.md, version.json, and license files.
  const referenceFiles: string[] = [];
  for (const skill of skillNames) {
    const skillPath = path.join(skillsDir, skill);
    for (const filePath of walkDir(skillPath)) {
      const filename = path.basename(filePath);
      if (EXCLUDED_FILENAMES.has(filename)) {
        continue;
      }
      const relPath = path
        .relative(skillsDir, filePath)
        .replace(/\//g, "\\");
      referenceFiles.push(relPath);
    }
  }

  // Sort globally to guarantee stable lexicographic ordering
  referenceFiles.sort();

  // Write allowed-skill-names.json
  const skillNamesPath = path.join(outputDir, "allowed-skill-names.json");
  fs.writeFileSync(skillNamesPath, JSON.stringify(skillNames, null, 2) + "\n");

  // Write allowed-plugin-file-references.json
  const referencesPath = path.join(
    outputDir,
    "allowed-plugin-file-references.json"
  );
  fs.writeFileSync(referencesPath, JSON.stringify(referenceFiles, null, 2) + "\n");

  console.log(
    `Generated ${skillNames.length} skill names and ${referenceFiles.length} reference file paths.`
  );
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.length < 1 || args.length > 2) {
    console.error(
      "Usage: node generate-mcp-allowlists.ts <skills_dir> [output_dir]"
    );
    process.exit(1);
  }

  const skillsDir = path.resolve(args[0]);
  const outputDir = args[1] ? path.resolve(args[1]) : process.cwd();

  generateAllowlists(skillsDir, outputDir);
}

main();
