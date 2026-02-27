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
 *   npm run frontmatter                 # Validate all skills
 *   npm run frontmatter <skill>         # Validate a single skill
 *   npm run frontmatter <path/SKILL.md> # Validate a specific file
 */

import { dirname, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { parseSkillContent } from "../shared/parse-skill.js";

// ── Paths ────────────────────────────────────────────────────────────────────

function getRepoRoot(): string {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  return resolve(scriptDir, "../../..");
}

const REPO_ROOT = getRepoRoot();
const PLUGIN_SKILLS_DIR = resolve(REPO_ROOT, "plugin", "skills");
const META_SKILLS_DIR = resolve(REPO_ROOT, ".github", "skills");

// ── Types ────────────────────────────────────────────────────────────────────

export interface ValidationIssue {
  check: string;     // Check identifier (e.g., "name-format", "description-format")
  message: string;   // Human-readable explanation
}

export interface ValidationResult {
  skill: string;
  file: string;
  issues: ValidationIssue[];
}

// ── Validation checks ────────────────────────────────────────────────────────

const NAME_RE = /^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$/;
const RESERVED_PREFIXES = ["claude-", "anthropic-"];

/**
 * Check 1: Validate the `name` field per the agentskills.io spec.
 *
 * Rules:
 * - Lowercase alphanumeric + hyphens only
 * - No consecutive hyphens (--)
 * - Must not start or end with a hyphen
 * - Length 1–64
 * - Must match the parent directory name
 */
export function validateName(name: string | null, parentDirName: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (name === null || name === "") {
    issues.push({ check: "name-format", message: "Missing required 'name' field" });
    return issues;
  }

  if (name.length > 64) {
    issues.push({ check: "name-format", message: `Name is ${name.length} chars (max 64)` });
  }

  if (!NAME_RE.test(name)) {
    if (/[A-Z]/.test(name)) {
      issues.push({ check: "name-format", message: `Name contains uppercase characters: ${name}` });
    } else if (/[^a-z0-9-]/.test(name)) {
      issues.push({ check: "name-format", message: `Name contains invalid characters (only a-z, 0-9, - allowed): ${name}` });
    } else if (name.startsWith("-") || name.endsWith("-")) {
      issues.push({ check: "name-format", message: `Name must not start or end with a hyphen: ${name}` });
    } else {
      issues.push({ check: "name-format", message: `Name does not match spec pattern: ${name}` });
    }
  }

  if (name.includes("--")) {
    issues.push({ check: "name-format", message: `Name contains consecutive hyphens (--): ${name}` });
  }

  if (name !== parentDirName) {
    issues.push({ check: "name-format", message: `Name "${name}" does not match parent directory "${parentDirName}"` });
  }

  return issues;
}

/**
 * Check 2: Validate the description uses inline double-quoted format.
 *
 * Rejects >- folded scalars and | literal blocks which are incompatible
 * with skills.sh.
 */
export function validateDescriptionFormat(rawFrontmatter: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Match description field followed by a block scalar indicator
  if (/^description:\s*>-?\s*$/m.test(rawFrontmatter)) {
    issues.push({
      check: "description-format",
      message: "Description uses >- folded scalar (incompatible with skills.sh) — use inline double-quoted string instead",
    });
  }

  if (/^description:\s*\|\s*$/m.test(rawFrontmatter)) {
    issues.push({
      check: "description-format",
      message: "Description uses | literal block (preserves newlines) — use inline double-quoted string instead",
    });
  }

  if (/^description:\s*\|-\s*$/m.test(rawFrontmatter)) {
    issues.push({
      check: "description-format",
      message: "Description uses |- literal block (strip) — use inline double-quoted string instead",
    });
  }

  return issues;
}

/**
 * Check 3: Validate no XML tags (< or >) in frontmatter.
 *
 * Frontmatter appears in the system prompt — XML tags are a security risk
 * (injection vector).
 */
export function validateNoXmlTags(rawFrontmatter: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const lines = rawFrontmatter.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Look for < or > that appear to be tags (not comparison operators or arrows)
    if (/<[a-zA-Z/!]/.test(line) || />[^-]/.test(line) && /</.test(line)) {
      issues.push({
        check: "no-xml-tags",
        message: `Frontmatter contains XML-like tags on line ${i + 1}: ${line.trim().substring(0, 80)}`,
      });
    }
  }

  return issues;
}

/**
 * Check 4: Validate the name does not start with reserved prefixes.
 *
 * Anthropic reserves claude- and anthropic- prefixes.
 */
export function validateNoReservedPrefix(name: string | null): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (name === null) return issues;

  for (const prefix of RESERVED_PREFIXES) {
    if (name.startsWith(prefix)) {
      issues.push({
        check: "reserved-prefix",
        message: `Name starts with reserved prefix "${prefix}": ${name}`,
      });
    }
  }

  return issues;
}

const SEMVER_RE = /^\d+\.\d+\.\d+$/;

/**
 * Check 5: Validate that `license` field is present.
 */
export function validateLicense(license: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (license === undefined || license === null || license === "") {
    issues.push({
      check: "license",
      message: "Missing 'license' field in frontmatter",
    });
  }

  return issues;
}

/**
 * Check 6: Validate `metadata.version` is present and follows semver (X.Y.Z).
 */
export function validateMetadataVersion(metadata: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (metadata === undefined || metadata === null || typeof metadata !== "object") {
    issues.push({
      check: "metadata-version",
      message: "Missing 'metadata' block with 'version' field in frontmatter",
    });
    return issues;
  }

  const meta = metadata as Record<string, unknown>;
  const version = meta.version;

  if (version === undefined || version === null || version === "") {
    issues.push({
      check: "metadata-version",
      message: "Missing 'version' in metadata block",
    });
    return issues;
  }

  const versionStr = String(version);
  if (!SEMVER_RE.test(versionStr)) {
    issues.push({
      check: "metadata-version",
      message: `metadata.version "${versionStr}" is not valid semver (expected X.Y.Z)`,
    });
  }

  return issues;
}

// ── Validate a single SKILL.md ──────────────────────────────────────────────

export function validateSkillFile(filePath: string): ValidationResult {
  const parentDir = basename(dirname(filePath));
  const content = readFileSync(filePath, "utf-8");
  const parsed = parseSkillContent(content);
  const issues: ValidationIssue[] = [];

  if (parsed === null) {
    issues.push({ check: "frontmatter", message: "Missing YAML frontmatter (file must start with ---)" });
    return { skill: parentDir, file: filePath, issues };
  }

  const name = typeof parsed.data.name === "string" ? parsed.data.name : null;
  const description = typeof parsed.data.description === "string" ? parsed.data.description : null;

  // Check required fields
  if (description === null) {
    issues.push({ check: "missing-field", message: "Missing required 'description' field" });
  }

  // Check 1: Name validation
  issues.push(...validateName(name, parentDir));

  // Check 2: Description format (needs raw YAML source)
  issues.push(...validateDescriptionFormat(parsed.raw));

  // Check 3: No XML tags (needs raw YAML source)
  issues.push(...validateNoXmlTags(parsed.raw));

  // Check 4: No reserved prefixes
  issues.push(...validateNoReservedPrefix(name));

  // Check 5: License field
  issues.push(...validateLicense(parsed.data.license));

  // Check 6: metadata.version (semver)
  issues.push(...validateMetadataVersion(parsed.data.metadata));

  return { skill: parentDir, file: filePath, issues };
}

// ── Skill discovery ──────────────────────────────────────────────────────────

function findSkillFiles(skillsDir: string): string[] {
  if (!existsSync(skillsDir)) return [];

  return readdirSync(skillsDir)
    .filter((name) => {
      const full = resolve(skillsDir, name);
      if (!statSync(full).isDirectory()) return false;
      return existsSync(resolve(full, "SKILL.md"));
    })
    .sort()
    .map((name) => resolve(skillsDir, name, "SKILL.md"));
}

function getAllSkillFiles(): string[] {
  return [...findSkillFiles(PLUGIN_SKILLS_DIR), ...findSkillFiles(META_SKILLS_DIR)];
}

// ── CLI entry point ──────────────────────────────────────────────────────────

function main(): void {
  const args = process.argv.slice(2);

  let skillFiles: string[];

  if (args.length > 0) {
    skillFiles = [];
    for (const arg of args) {
      // Accept either a skill name or a direct path to SKILL.md
      if (arg.endsWith("SKILL.md") && existsSync(arg)) {
        skillFiles.push(resolve(arg));
      } else {
        // Try as skill name in both directories
        const pluginPath = resolve(PLUGIN_SKILLS_DIR, arg, "SKILL.md");
        const metaPath = resolve(META_SKILLS_DIR, arg, "SKILL.md");

        if (existsSync(pluginPath)) {
          skillFiles.push(pluginPath);
        } else if (existsSync(metaPath)) {
          skillFiles.push(metaPath);
        } else {
          console.error(`\n❌ Skill "${arg}" not found in plugin/skills/ or .github/skills/\n`);
          process.exitCode = 1;
          return;
        }
      }
    }
  } else {
    skillFiles = getAllSkillFiles();
  }

  console.log("\n📋 Frontmatter Spec Validator\n");
  console.log("────────────────────────────────────────────────────────────");

  let totalIssues = 0;
  let skillsWithIssues = 0;

  for (const file of skillFiles) {
    const result = validateSkillFile(file);

    if (result.issues.length === 0) {
      console.log(`  ✅ ${result.skill}`);
    } else {
      skillsWithIssues++;
      totalIssues += result.issues.length;

      console.log(`  ❌ ${result.skill} — ${result.issues.length} issue(s)`);
      for (const issue of result.issues) {
        console.log(`     [${issue.check}] ${issue.message}`);
      }
    }
  }

  console.log("\n────────────────────────────────────────────────────────────");

  if (totalIssues === 0) {
    console.log(`\n✅ All ${skillFiles.length} skill(s) passed frontmatter validation.\n`);
  } else {
    console.log(`\n❌ ${totalIssues} issue(s) found in ${skillsWithIssues} skill(s).\n`);
    process.exitCode = 1;
  }
}

main();
