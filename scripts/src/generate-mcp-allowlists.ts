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
import { collectPluginAllowlists } from "./plugin-allowlists.cjs";

/**
 * JSON schema of the allowed-skill-names.json output
 */
type AllowedSkillNames = {
  /**
   * Plugin dirname to its skill names
   */
  skills: Record<string, string[]>;
};

/**
 * JSON schema of the allowed-plugin-file-references.json output
 */
type AllowedPluginFileReferences = {
  /**
   * Plugin dirname to its reference file names
   */
  references: Record<string, string[]>;
};

function generateAllowlists(skillsDirs: string[], outputDir: string): void {
  const allSkillNames: AllowedSkillNames = { skills: {} };
  const allReferenceFiles: AllowedPluginFileReferences = { references: {} };

  for (const skillsDir of skillsDirs) {
    if (!fs.existsSync(skillsDir) || !fs.statSync(skillsDir).isDirectory()) {
      console.error(`ERROR: skills directory not found: ${skillsDir}`);
      process.exit(1);
    }

    // skillsDir ends with <plugin-dirname>/skills
    const pluginDirname = skillsDir.split(/\/|\\/).at(-2) as string;

    const { skills: skillNames, references: referenceFiles } = collectPluginAllowlists(skillsDir);

    if (skillNames.length === 0) {
      console.error(
        `ERROR: No skills found in ${skillsDir} - aborting to prevent empty sync`
      );
      process.exit(1);
    }

    allSkillNames.skills[pluginDirname] = skillNames;

    allReferenceFiles.references[pluginDirname] = referenceFiles;
  }

  // Write allowed-skill-names.json
  const skillNamesPath = path.join(outputDir, "allowed-skill-names.json");
  fs.writeFileSync(skillNamesPath, JSON.stringify(allSkillNames, null, 2) + "\n");

  // Write allowed-plugin-file-references.json
  const referencesPath = path.join(
    outputDir,
    "allowed-plugin-file-references.json"
  );
  fs.writeFileSync(referencesPath, JSON.stringify(allReferenceFiles, null, 2) + "\n");

  console.log(
    `Generated mcp allowlist for ${Object.keys(allSkillNames.skills).length} plugins.`
  );
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error(
      "Usage: node generate-mcp-allowlists.ts <skills_dir_1> ... <skills_dir_N> <output_dir>"
    );
    process.exit(1);
  }

  const outputDir = path.resolve(args[args.length - 1]);
  const skillsDirs = args.slice(0, -1).map((dir) => path.resolve(dir));

  generateAllowlists(skillsDirs, outputDir);
}

main();
