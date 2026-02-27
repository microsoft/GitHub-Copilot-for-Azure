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
import { fileURLToPath } from "node:url";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";

// ── Paths ────────────────────────────────────────────────────────────────────

function getRepoRoot(): string {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  return resolve(scriptDir, "../../..");
}

const REPO_ROOT = getRepoRoot();
const SKILLS_DIR = resolve(REPO_ROOT, "plugin", "skills");

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

// ── Link extraction ──────────────────────────────────────────────────────────

/**
 * Regex that captures local markdown link targets.
 *
 * Matches:
 *   [text](target)             – inline links
 *   [text](target#anchor)      – inline links with fragment
 *   [text](target "title")     – inline links with title
 *
 * Skips:
 *   https:// and http:// URLs
 *   mailto: links
 *   mdc: protocol links (Nuxt Content / internal protocol)
 *   Pure fragment links (#anchor-only)
 */
const LINK_RE = /\[(?:[^\]]*)\]\(([^)]+)\)/g;

function isIgnoredLink(rawTarget: string): boolean {
  const trimmed = rawTarget.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return true;
  if (trimmed.startsWith("mailto:")) return true;
  if (trimmed.startsWith("mdc:")) return true;
  if (trimmed.startsWith("#")) return true; // pure fragment
  return false;
}

/**
 * Strip fragment identifiers (`#…`) and optional titles (`"…"`) from a link
 * target so we are left with just the file/dir path.
 */
function cleanTarget(rawTarget: string): string {
  let target = rawTarget.trim();
  // Remove optional title ("title" or 'title') at the end
  target = target.replace(/\s+["'][^"']*["']\s*$/, "");
  // Remove fragment
  target = target.replace(/#.*$/, "");
  return target.trim();
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

/**
 * Extract all local markdown links from a file that need to be followed for
 * orphan detection. Returns resolved absolute paths.
 */
function extractLocalLinks(mdFile: string, _skillDir: string): string[] {
  const links: string[] = [];
  const content = readFileSync(mdFile, "utf-8");
  const lines = content.split("\n");

  for (const line of lines) {
    let match: RegExpExecArray | null;
    LINK_RE.lastIndex = 0;

    while ((match = LINK_RE.exec(line)) !== null) {
      const rawTarget = match[1];
      if (isIgnoredLink(rawTarget)) continue;

      const target = cleanTarget(rawTarget);
      if (target === "") continue;

      const fileDir = dirname(mdFile);
      const resolved = resolve(fileDir, target);

      // Only include links that exist and are files (not directories)
      if (existsSync(resolved)) {
        try {
          if (!statSync(resolved).isDirectory()) {
            links.push(resolved);
          }
        } catch {
          // skip if stat fails
        }
      }
    }
  }

  return links;
}

function validateFile(mdFile: string, skillDir: string): LinkIssue[] {
  const issues: LinkIssue[] = [];
  const content = readFileSync(mdFile, "utf-8");
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match: RegExpExecArray | null;
    LINK_RE.lastIndex = 0;

    while ((match = LINK_RE.exec(line)) !== null) {
      const rawTarget = match[1];
      if (isIgnoredLink(rawTarget)) continue;

      const target = cleanTarget(rawTarget);
      if (target === "") continue; // pure fragment after cleaning

      const fileDir = dirname(mdFile);
      const resolved = resolve(fileDir, target);

      // ── Check 1: Does the target exist? ──────────────────────────────────
      if (!existsSync(resolved)) {
        issues.push({
          file: mdFile,
          line: i + 1,
          link: rawTarget,
          reason: `Target does not exist: ${target}`,
        });
        continue; // no point checking containment if it doesn't exist
      }

      // ── Check 2: Is the target a directory? ────────────────────────────
      try {
        if (statSync(resolved).isDirectory()) {
          issues.push({
            file: mdFile,
            line: i + 1,
            link: rawTarget,
            reason: `Reference points to a directory, not a file: ${target}`,
          });
          continue;
        }
      } catch {
        // skip if stat fails
      }

      // ── Check 3: Is the target inside the skill's directory? ────────────
      const normalizedResolved = normalize(resolved).toLowerCase();
      const normalizedSkillDir = normalize(skillDir).toLowerCase();

      const insideSkill = normalizedResolved.startsWith(normalizedSkillDir + "\\")
        || normalizedResolved.startsWith(normalizedSkillDir + "/")
        || normalizedResolved === normalizedSkillDir;

      if (!insideSkill) {
        const rel = relative(SKILLS_DIR, resolved).replace(/\\/g, "/");
        issues.push({
          file: mdFile,
          line: i + 1,
          link: rawTarget,
          reason: `Reference escapes skill directory → resolves to: ${rel}`,
        });
      }
    }
  }

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
      const normalizedLink = normalize(link).toLowerCase();
      if (!visited.has(normalizedLink)) {
        visited.add(normalizedLink);
        // Only follow markdown links
        if (link.endsWith(".md")) {
          queue.push(link);
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
  const args = process.argv.slice(2);
  const requestedSkill = args[0];

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

  console.log("\n🔗 Markdown Reference Validator\n");
  console.log("────────────────────────────────────────────────────────────");

  let totalIssues = 0;
  let totalOrphanedFiles = 0;
  let skillsWithIssues = 0;

  for (const skill of skills) {
    const result = validateSkill(skill);
    const hasLinkIssues = result.issues.length > 0;
    const hasOrphanedFiles = result.orphanedFiles.length > 0;

    if (!hasLinkIssues && !hasOrphanedFiles) {
      console.log(`  ✅ ${skill}`);
    } else {
      skillsWithIssues++;
      const issueCount = result.issues.length + result.orphanedFiles.length;
      totalIssues += result.issues.length;
      totalOrphanedFiles += result.orphanedFiles.length;

      console.log(`  ❌ ${skill} — ${issueCount} issue(s)`);

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
