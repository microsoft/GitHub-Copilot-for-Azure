#!/usr/bin/env node
/**
 * Markdown Reference Validator
 *
 * Checks every skill's markdown files to ensure:
 *   1. Every local markdown link points to an actual file.
 *   2. Every local markdown link resolves to a path inside the skill's
 *      own directory.
 *   3. No local markdown link points to a directory instead of a file.
 *   4. All files in the skill's "references" directory are reachable
 *      through a chain of markdown links starting from SKILL.md.
 *
 * Usage:
 *   npm run references              # Validate all skills
 *   npm run references <skill>      # Validate a single skill
 */

import { dirname, resolve, relative, normalize } from "node:path";
import { existsSync, readdirSync, statSync } from "node:fs";
import { extractLocalLinks } from "./link-helpers.js";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

// ── Paths ────────────────────────────────────────────────────────────────────

function getRepoRoot(): string {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  return resolve(scriptDir, "../../..");
}

const REPO_ROOT = getRepoRoot();
let SKILLS_DIR = resolve(REPO_ROOT, "plugin", "skills");

// ── Types ────────────────────────────────────────────────────────────────────

interface LinkIssue {
  file: string;       // Markdown file that contains the link
  line: number;       // 1-based line number
  link: string;       // Raw link target from the markdown
  reason: string;     // Human-readable explanation
}

interface OrphanedFile {
  file: string;       // Path to the orphaned file
  reason: string;     // Human-readable explanation
}

interface ValidationResult {
  skill: string;
  issues: LinkIssue[];
  orphanedFiles: OrphanedFile[];
}

// ── Markdown file discovery ──────────────────────────────────────────────────

function findMarkdownFiles(dir: string): string[] {
  const results: string[] = [];

  function walk(current: string): void {
    let entries: string[];
    try {
      entries = readdirSync(current);
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = resolve(current, entry);
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          walk(fullPath);
        } else if (entry.endsWith(".md")) {
          results.push(fullPath);
        }
      } catch {
        // skip inaccessible entries
      }
    }
  }

  walk(dir);
  return results;
}

/**
 * Collect all files under the "references" directory (non-recursively for 
 * directories, but recursively for files).
 */
function findReferenceFiles(skillDir: string): string[] {
  const referencesDir = resolve(skillDir, "references");
  if (!existsSync(referencesDir)) {
    return [];
  }

  const results: string[] = [];

  function walk(current: string): void {
    let entries: string[];
    try {
      entries = readdirSync(current);
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = resolve(current, entry);
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          walk(fullPath);
        } else {
          results.push(fullPath);
        }
      } catch {
        // skip inaccessible entries
      }
    }
  }

  walk(referencesDir);
  return results;
}

// ── Validation logic ─────────────────────────────────────────────────────────

function validateFile(mdFile: string, skillDir: string): LinkIssue[] {
  const localLinks = extractLocalLinks(mdFile, skillDir);
  const issues: LinkIssue[] = [];

  // Check 1: find all references that don't exist
  issues.push(...localLinks.filter((item) => {
    return !item.exists;
  }).map((item) => {
    return {
      file: mdFile,
      line: item.line,
      link: item.link,
      reason: `Target does not exist: ${item.link}`,
    };
  }));

  // Check 2: find all references that are directories
  issues.push(...localLinks.filter((item) => {
    return item.exists && item.isDirectory;
  }).map((item) => {
    return {
      file: mdFile,
      line: item.line,
      link: item.absPath,
      reason: `Reference points to a directory, not a file: ${item.link}`,
    };
  }));

  // Check 3: find all references outside the skills directory
  issues.push(...localLinks.map((item) => {
    const normalizedResolved = normalize(item.absPath).toLowerCase();
    const normalizedSkillDir = normalize(skillDir).toLowerCase();

    const insideSkill = normalizedResolved.startsWith(normalizedSkillDir + "\\")
      || normalizedResolved.startsWith(normalizedSkillDir + "/")
      || normalizedResolved === normalizedSkillDir;

    if (!insideSkill) {
      const rel = relative(SKILLS_DIR, item.absPath).replace(/\\/g, "/");
      return {
        file: mdFile,
        line: item.line,
        link: item.absPath,
        reason: `Reference escapes skill directory → resolves to: ${rel}`,
      };
    } else {
      return undefined;
    }
  }).filter((issue) => issue !== undefined));

  return issues;
}

function validateSkill(skillName: string): ValidationResult {
  const skillDir = resolve(SKILLS_DIR, skillName);
  const mdFiles = findMarkdownFiles(skillDir);
  const issues: LinkIssue[] = [];

  // Validate all markdown files for link issues
  for (const mdFile of mdFiles) {
    issues.push(...validateFile(mdFile, skillDir));
  }

  // Track visited files for orphan detection
  // Using case-insensitive comparison for cross-platform compatibility (Windows)
  const visited = new Set<string>();
  const queue: string[] = [];

  // Start from SKILL.md if it exists
  const skillMd = resolve(skillDir, "SKILL.md");
  if (existsSync(skillMd)) {
    queue.push(skillMd);
    visited.add(normalize(skillMd).toLowerCase());
  }

  // BFS traversal to track all reachable files
  while (queue.length > 0) {
    const current = queue.shift()!;
    const links = extractLocalLinks(current, skillDir);

    for (const link of links) {
      const normalizedLink = normalize(link.absPath).toLowerCase();
      if (!visited.has(normalizedLink)) {
        visited.add(normalizedLink);
        // Only follow markdown links
        if (link.absPath.endsWith(".md")) {
          queue.push(link.absPath);
        }
      }
    }
  }

  // Find orphaned files in the references directory
  const orphanedFiles: OrphanedFile[] = [];
  const referenceFiles = findReferenceFiles(skillDir);

  for (const refFile of referenceFiles) {
    const normalizedRefFile = normalize(refFile).toLowerCase();
    if (!visited.has(normalizedRefFile)) {
      const relPath = relative(skillDir, refFile).replace(/\\/g, "/");
      orphanedFiles.push({
        file: refFile,
        reason: `File exists in references directory but is not linked from SKILL.md: ${relPath}`,
      });
    }
  }

  return { skill: skillName, issues, orphanedFiles };
}

// ── JSON output ──────────────────────────────────────────────────────────────

export interface ReferenceEntry {
  source: string;
  target: string;
  status: "valid" | "broken" | "warning";
  message?: string;
}

export interface ReferencesJsonResult {
  references: ReferenceEntry[];
  summary: {
    total: number;
    valid: number;
    broken: number;
    warnings: number;
  };
}

function buildReferencesJson(
  skills: string[],
  results: ValidationResult[],
): ReferencesJsonResult {
  const references: ReferenceEntry[] = [];
  let validCount = 0;
  let brokenCount = 0;
  let warningCount = 0;

  for (const result of results) {
    const hasIssues = result.issues.length > 0 || result.orphanedFiles.length > 0;

    if (!hasIssues) {
      validCount++;
      continue;
    }

    // Link issues → broken
    for (const issue of result.issues) {
      references.push({
        source: formatPath(issue.file),
        target: issue.link,
        status: "broken",
        message: issue.reason,
      });
      brokenCount++;
    }

    // Orphaned files → warning
    for (const orphan of result.orphanedFiles) {
      references.push({
        source: formatPath(orphan.file),
        target: result.skill + "/SKILL.md",
        status: "warning",
        message: orphan.reason,
      });
      warningCount++;
    }
  }

  return {
    references,
    summary: {
      total: skills.length,
      valid: validCount,
      broken: brokenCount,
      warnings: warningCount,
    },
  };
}

// ── CLI entry point ──────────────────────────────────────────────────────────

function listSkills(): string[] {
  return readdirSync(SKILLS_DIR)
    .filter((name) => {
      const full = resolve(SKILLS_DIR, name);
      return statSync(full).isDirectory();
    })
    .sort();
}

function formatPath(absPath: string): string {
  return relative(REPO_ROOT, absPath).replace(/\\/g, "/");
}

function main(): void {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      json: { type: "boolean", default: false },
      "skills-dir": { type: "string" },
    },
    strict: false,
    allowPositionals: true,
  });

  if (values["skills-dir"] && typeof values["skills-dir"] === "string") {
    const dir = resolve(values["skills-dir"]);
    if (!existsSync(dir) || !statSync(dir).isDirectory()) {
      console.error(`\n❌ Skills directory not found: ${dir}\n`);
      process.exit(1);
    }
    SKILLS_DIR = dir;
  }

  const jsonOutput = values.json ?? false;
  const requestedSkill = positionals[0];

  const skills = requestedSkill ? [requestedSkill] : listSkills();

  // Verify requested skill exists
  if (requestedSkill) {
    const skillDir = resolve(SKILLS_DIR, requestedSkill);
    if (!existsSync(skillDir) || !statSync(skillDir).isDirectory()) {
      console.error(`\n❌ Skill "${requestedSkill}" not found in ${formatPath(SKILLS_DIR)}\n`);
      console.error("Available skills:");
      for (const s of listSkills()) {
        console.error(`  - ${s}`);
      }
      process.exitCode = 1;
      return;
    }
  }

  // Validate all skills
  const results: ValidationResult[] = [];
  for (const skill of skills) {
    results.push(validateSkill(skill));
  }

  // ── JSON output mode ────────────────────────────────────────────────────
  if (jsonOutput) {
    const jsonResult = buildReferencesJson(skills, results);
    console.log(JSON.stringify(jsonResult, null, 2));
    const hasErrors = results.some(r => r.issues.length > 0);
    if (hasErrors) {
      process.exitCode = 1;
    }
    return;
  }

  // ── Console output mode (default) ───────────────────────────────────────
  console.log("\n🔗 Markdown Reference Validator\n");
  console.log("────────────────────────────────────────────────────────────");

  let totalIssues = 0;
  let totalOrphanedFiles = 0;
  let skillsWithIssues = 0;

  for (const result of results) {
    const hasLinkIssues = result.issues.length > 0;
    const hasOrphanedFiles = result.orphanedFiles.length > 0;

    if (!hasLinkIssues && !hasOrphanedFiles) {
      console.log(`  ✅ ${result.skill}`);
    } else {
      skillsWithIssues++;
      const issueCount = result.issues.length + result.orphanedFiles.length;
      totalIssues += result.issues.length;
      totalOrphanedFiles += result.orphanedFiles.length;

      console.log(`  ❌ ${result.skill} — ${issueCount} issue(s)`);

      // Report link issues
      for (const issue of result.issues) {
        const loc = `${formatPath(issue.file)}:${issue.line}`;
        console.log(`     ${loc}`);
        console.log(`       Link: ${issue.link}`);
        console.log(`       ${issue.reason}`);
      }

      // Report orphaned files
      for (const orphan of result.orphanedFiles) {
        console.log(`     ${formatPath(orphan.file)}`);
        console.log(`       ${orphan.reason}`);
      }
    }
  }

  console.log("\n────────────────────────────────────────────────────────────");

  const allIssuesCount = totalIssues + totalOrphanedFiles;
  if (allIssuesCount === 0) {
    console.log(`\n✅ All ${skills.length} skill(s) passed — no broken or escaped references, no orphaned files.\n`);
  } else {
    let message = `\n❌ ${allIssuesCount} issue(s) found in ${skillsWithIssues} skill(s)`;
    if (totalIssues > 0 && totalOrphanedFiles > 0) {
      message += ` (${totalIssues} link issue(s), ${totalOrphanedFiles} orphaned file(s))`;
    } else if (totalOrphanedFiles > 0) {
      message += ` (${totalOrphanedFiles} orphaned file(s))`;
    }
    message += ".\n";
    console.log(message);
    process.exitCode = 1;
  }
}

main();
