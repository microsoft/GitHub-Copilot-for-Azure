#!/usr/bin/env node
/**
 * Markdown Reference Validator
 *
 * Checks every skill's markdown files to ensure:
 *   1. Every local markdown link points to an actual file or directory.
 *   2. Every local markdown link resolves to a path inside the skill's
 *      own directory (or the shared `_shared` directory).
 *
 * Usage:
 *   npm run references              # Validate all skills
 *   npm run references <skill>      # Validate a single skill
 */

import { dirname, resolve, relative, normalize, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';

// ── Paths ────────────────────────────────────────────────────────────────────

function getRepoRoot(): string {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  return resolve(scriptDir, '../../..');
}

const REPO_ROOT = getRepoRoot();
const SKILLS_DIR = resolve(REPO_ROOT, 'plugin', 'skills');

// ── Types ────────────────────────────────────────────────────────────────────

interface LinkIssue {
  file: string;       // Markdown file that contains the link
  line: number;       // 1-based line number
  link: string;       // Raw link target from the markdown
  reason: string;     // Human-readable explanation
}

interface ValidationResult {
  skill: string;
  issues: LinkIssue[];
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
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return true;
  if (trimmed.startsWith('mailto:')) return true;
  if (trimmed.startsWith('mdc:')) return true;
  if (trimmed.startsWith('#')) return true; // pure fragment
  return false;
}

/**
 * Strip fragment identifiers (`#…`) and optional titles (`"…"`) from a link
 * target so we are left with just the file/dir path.
 */
function cleanTarget(rawTarget: string): string {
  let target = rawTarget.trim();
  // Remove optional title ("title" or 'title') at the end
  target = target.replace(/\s+["'][^"']*["']\s*$/, '');
  // Remove fragment
  target = target.replace(/#.*$/, '');
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
        } else if (entry.endsWith('.md')) {
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

// ── Validation logic ─────────────────────────────────────────────────────────

function validateFile(mdFile: string, skillDir: string): LinkIssue[] {
  const issues: LinkIssue[] = [];
  const content = readFileSync(mdFile, 'utf-8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match: RegExpExecArray | null;
    LINK_RE.lastIndex = 0;

    while ((match = LINK_RE.exec(line)) !== null) {
      const rawTarget = match[1];
      if (isIgnoredLink(rawTarget)) continue;

      const target = cleanTarget(rawTarget);
      if (target === '') continue; // pure fragment after cleaning

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

      // ── Check 2: Is the target inside the skill's directory? ────────────
      const normalizedResolved = normalize(resolved).toLowerCase();
      const normalizedSkillDir = normalize(skillDir).toLowerCase();

      const insideSkill = normalizedResolved.startsWith(normalizedSkillDir + '\\')
        || normalizedResolved.startsWith(normalizedSkillDir + '/')
        || normalizedResolved === normalizedSkillDir;

      if (!insideSkill) {
        const rel = relative(SKILLS_DIR, resolved).replace(/\\/g, '/');
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

  for (const mdFile of mdFiles) {
    issues.push(...validateFile(mdFile, skillDir));
  }

  return { skill: skillName, issues };
}

// ── CLI entry point ──────────────────────────────────────────────────────────

function listSkills(): string[] {
  return readdirSync(SKILLS_DIR)
    .filter((name) => {
      if (name.startsWith('_')) return false; // skip _shared etc.
      const full = resolve(SKILLS_DIR, name);
      return statSync(full).isDirectory();
    })
    .sort();
}

function formatPath(absPath: string): string {
  return relative(REPO_ROOT, absPath).replace(/\\/g, '/');
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
      console.error('Available skills:');
      for (const s of listSkills()) {
        console.error(`  - ${s}`);
      }
      process.exitCode = 1;
      return;
    }
  }

  console.log('\n🔗 Markdown Reference Validator\n');
  console.log('────────────────────────────────────────────────────────────');

  let totalIssues = 0;
  let skillsWithIssues = 0;

  for (const skill of skills) {
    const result = validateSkill(skill);

    if (result.issues.length === 0) {
      console.log(`  ✅ ${skill}`);
    } else {
      skillsWithIssues++;
      totalIssues += result.issues.length;
      console.log(`  ❌ ${skill} — ${result.issues.length} issue(s)`);
      for (const issue of result.issues) {
        const loc = `${formatPath(issue.file)}:${issue.line}`;
        console.log(`     ${loc}`);
        console.log(`       Link: ${issue.link}`);
        console.log(`       ${issue.reason}`);
      }
    }
  }

  console.log('\n────────────────────────────────────────────────────────────');

  if (totalIssues === 0) {
    console.log(`\n✅ All ${skills.length} skill(s) passed — no broken or escaped references.\n`);
  } else {
    console.log(`\n❌ ${totalIssues} issue(s) found in ${skillsWithIssues} skill(s).\n`);
    process.exitCode = 1;
  }
}

main();
