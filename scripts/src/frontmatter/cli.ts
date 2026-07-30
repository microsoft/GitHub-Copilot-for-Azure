#!/usr/bin/env node
/**
 * Frontmatter Spec Validator
 *
 * Validates SKILL.md frontmatter against agentskills.io specification rules:
 *   1. Name must be lowercase alphanumeric + hyphens, no consecutive hyphens,
 *      no start/end hyphen, length 1–64, and must match the parent directory.
 *   2. Description must use inline double-quoted strings — not >- folded
 *      scalars or | literal blocks (incompatible with skills.sh).
 *   3. Frontmatter must not contain XML tags (< or >) — security risk since
 *      frontmatter appears in the system prompt.
 *   4. Name must not start with reserved prefixes (claude- or anthropic-).
 *
 * Usage:
 *   npm run frontmatter                        # Validate skills in all plugins
 *   npm run frontmatter <path/SKILL.md>        # Validate a specific SKILL.md file
 *   npm run frontmatter <path/skills/mySkill>  # Validate a single skill folder
 *   npm run frontmatter <path/skills>          # Validate all skills in a directory
 *   npm run frontmatter <path1> <path2> ...    # Mix of the above
 */

import { parseArgs } from "node:util";
import { buildJsonResult, buildSkillRoutingContexts, resolveSkillFiles, validateSkillFile, validateTriggerOverlapDisambiguation, ValidationResult } from "./helpers.js";

function main(): void {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      json: { type: "boolean", default: false },
    },
    strict: false,
    allowPositionals: true,
  });

  const jsonOutput = values.json ?? false;

  if (positionals.length === 0) {
    // Use default build output location
    // Note that the path is relative to the scripts/ directory, not this module.
    positionals.push("../output");
  }

  const skillFiles: string[] = [];

  for (const relativePath of positionals) {
    const result = resolveSkillFiles(relativePath);
    if (result.errorMessage) {
      console.error(`\n❌ ${result.errorMessage}\n`);
      process.exitCode = 1;
      return;
    }
    skillFiles.push(...result.files);
  }

  // Validate all skill files
  const results: ValidationResult[] = [];
  const routingContexts = buildSkillRoutingContexts(skillFiles);
  const routingContextByName = new Map(routingContexts.map((context) => [context.name, context]));

  for (const file of skillFiles) {
    const result = validateSkillFile(file);
    const routingContext = routingContextByName.get(result.skill);
    if (routingContext) {
      result.issues.push(...validateTriggerOverlapDisambiguation(routingContext, routingContexts));
    }
    results.push(result);
  }

  // ── JSON output mode ────────────────────────────────────────────────────
  if (jsonOutput) {
    const jsonResult = buildJsonResult(results);
    console.log(JSON.stringify(jsonResult, null, 2));
    const hasErrors = results.some(r => r.issues.some(i => i.severity !== "warning"));
    if (hasErrors) {
      process.exitCode = 1;
    }
    return;
  }

  // ── Console output mode (default) ───────────────────────────────────────
  console.log("\n📋 Frontmatter Spec Validator\n");
  console.log("────────────────────────────────────────────────────────────");

  let totalErrors = 0;
  let totalWarnings = 0;
  let skillsWithIssues = 0;

  for (const result of results) {
    const errors = result.issues.filter(i => i.severity !== "warning");
    const warnings = result.issues.filter(i => i.severity === "warning");

    if (result.issues.length === 0) {
      console.log(`  ✅ ${result.skill}`);
    } else {
      if (errors.length > 0) skillsWithIssues++;
      totalErrors += errors.length;
      totalWarnings += warnings.length;

      const icon = errors.length > 0 ? "❌" : "⚠️";
      console.log(`  ${icon} ${result.skill} — ${errors.length} error(s), ${warnings.length} warning(s)`);
      for (const issue of errors) {
        console.log(`     ❌ [${issue.check}] ${issue.message}`);
      }
      for (const issue of warnings) {
        console.log(`     ⚠️  [${issue.check}] ${issue.message}`);
      }
    }
  }

  console.log("\n────────────────────────────────────────────────────────────");

  if (totalErrors === 0 && totalWarnings === 0) {
    console.log(`\n✅ All ${skillFiles.length} skill(s) passed frontmatter validation.\n`);
  } else if (totalErrors === 0) {
    console.log(`\n✅ All ${skillFiles.length} skill(s) passed with ${totalWarnings} warning(s).\n`);
  } else {
    console.log(`\n❌ ${totalErrors} error(s) and ${totalWarnings} warning(s) found in ${skillsWithIssues} skill(s).\n`);
    process.exitCode = 1;
  }
}

main();
