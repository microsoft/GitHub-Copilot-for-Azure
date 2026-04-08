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

import { dirname, resolve, basename, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";
import { parseSkillContent } from "../shared/skill-helper.js";

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
  severity?: "error" | "warning";  // Defaults to "error" if omitted
}

export interface ValidationResult {
  skill: string;
  file: string;
  issues: ValidationIssue[];
}

export interface SkillRoutingContext {
  name: string;
  file: string;
  description: string;
  triggerPhrases: string[];
  broad: boolean;
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

/**
 * Check 5: Validate description length (max 1024 chars per agentskills.io spec).
 */
export function validateDescriptionLength(description: string | null): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (description === null || description === "") {
    return issues; // Missing description is caught by missing-field check
  }

  if (description.length > 1024) {
    issues.push({
      check: "description-length",
      message: `Description is ${description.length} chars (max 1024)`,
    });
  }

  return issues;
}

const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/**
 * Check 6: Validate that `license` field is present and is a string.
 */
export function validateLicense(license: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (license === undefined || license === null || license === "") {
    issues.push({
      check: "license",
      message: "Missing 'license' field in frontmatter",
      severity: "warning",
    });
  } else if (typeof license !== "string") {
    issues.push({
      check: "license",
      message: `'license' field must be a string, got ${typeof license}`,
    });
  }

  return issues;
}

/**
 * Check 7: Validate `metadata` field structure (optional, map of string keys to string values per spec).
 */
export function validateMetadata(metadata: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (metadata === undefined || metadata === null) {
    issues.push({
      check: "metadata",
      message: "Missing 'metadata' block in frontmatter",
      severity: "warning",
    });
    return issues;
  }

  if (typeof metadata !== "object" || Array.isArray(metadata)) {
    issues.push({
      check: "metadata",
      message: `'metadata' field must be a key-value mapping, got ${Array.isArray(metadata) ? "array" : typeof metadata}`,
    });
    return issues;
  }

  const meta = metadata as Record<string, unknown>;
  for (const [key, value] of Object.entries(meta)) {
    if (typeof value !== "string") {
      issues.push({
        check: "metadata",
        message: `metadata.${key} must be a string, got ${typeof value}`,
        severity: "warning",
      });
    }
  }

  return issues;
}

/**
 * Check 8: Validate `metadata.version` is present and follows semver (X.Y.Z).
 */
export function validateMetadataVersion(metadata: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (metadata === undefined || metadata === null || typeof metadata !== "object") {
    issues.push({
      check: "metadata-version",
      message: "Missing 'metadata' block with 'version' field in frontmatter",
      severity: "warning",
    });
    return issues;
  }

  const meta = metadata as Record<string, unknown>;
  const version = meta.version;

  if (version === undefined || version === null || version === "") {
    issues.push({
      check: "metadata-version",
      message: "Missing 'version' in metadata block",
      severity: "warning",
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

/**
 * Check 8: Validate `compatibility` field (optional, max 500 chars per spec).
 */
export function validateCompatibility(compatibility: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (compatibility === undefined || compatibility === null) {
    return issues; // Optional field
  }

  if (typeof compatibility !== "string") {
    issues.push({
      check: "compatibility",
      message: `'compatibility' field must be a string, got ${typeof compatibility}`,
    });
    return issues;
  }

  if (compatibility === "") {
    issues.push({
      check: "compatibility",
      message: "'compatibility' field must not be empty if provided",
    });
    return issues;
  }

  if (compatibility.length > 500) {
    issues.push({
      check: "compatibility",
      message: `Compatibility is ${compatibility.length} chars (max 500)`,
    });
  }

  return issues;
}

/**
 * Check 9: Validate `allowed-tools` field (optional, space-delimited string per spec).
 */
export function validateAllowedTools(allowedTools: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (allowedTools === undefined || allowedTools === null) {
    return issues; // Optional field
  }

  if (typeof allowedTools !== "string") {
    issues.push({
      check: "allowed-tools",
      message: `'allowed-tools' field must be a string, got ${typeof allowedTools}`,
    });
    return issues;
  }

  if (allowedTools === "") {
    issues.push({
      check: "allowed-tools",
      message: "'allowed-tools' field must not be empty if provided",
    });
  }

  return issues;
}

const TRIGGER_SECTION_KEYWORDS = ["WHEN", "USE FOR", "TRIGGERS"] as const;
const TRIGGER_SECTION_STOP_KEYWORDS = ["DO NOT USE FOR", "PREFER OVER", ...TRIGGER_SECTION_KEYWORDS] as const;
const TRIGGER_SECTION_RE = new RegExp(
  `\\b(?:${TRIGGER_SECTION_KEYWORDS.join("|")}):\\s*([^]*?)(?=(?:\\b(?:${TRIGGER_SECTION_STOP_KEYWORDS.join("|")})(?::|\\b)|$))`,
  "gi",
);
const DO_NOT_USE_FOR_RE = /\bDO NOT USE FOR:/i;
const BROAD_SKILL_NAMES = new Set(["azure-prepare", "azure-deploy"]);
// Skills that match at least two broad routing triggers are considered "broad"
// so overlap checks can require explicit disambiguation for specialized skills.
const BROAD_TRIGGER_MATCH_THRESHOLD = 2;
const BROAD_TRIGGER_PHRASES = new Set([
  "deploy to azure",
  "host on azure",
  "create and deploy",
  "create app",
  "build web app",
  "create api",
  "create frontend",
  "create back end",
  "modernize application",
  "update application",
]);

function normalizeTriggerPhrase(phrase: string): string {
  return phrase
    .toLowerCase()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function extractTriggerPhrases(description: string | null): string[] {
  if (!description) return [];

  const phrases: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = TRIGGER_SECTION_RE.exec(description)) !== null) {
    const section = match[1];
    for (const rawPhrase of section.split(/[;,]/)) {
      const normalized = normalizeTriggerPhrase(rawPhrase);
      if (normalized.length >= 4) {
        phrases.push(normalized);
      }
    }
  }

  return [...new Set(phrases)];
}

export function hasDoNotUseForClause(description: string | null): boolean {
  if (!description) return false;
  return DO_NOT_USE_FOR_RE.test(description);
}

export function hasPreferOverClause(description: string | null, competingSkillName: string): boolean {
  if (!description) return false;
  const escapedName = competingSkillName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\bPREFER OVER\\s+${escapedName}\\b`, "i").test(description);
}

function hasAnyDisambiguationClause(description: string | null, competingSkillName: string): boolean {
  return hasDoNotUseForClause(description) || hasPreferOverClause(description, competingSkillName);
}

function buildSkillRoutingContexts(skillFiles: string[]): SkillRoutingContext[] {
  const contexts: SkillRoutingContext[] = [];
  for (const file of skillFiles) {
    const content = readFileSync(file, "utf-8");
    const parsed = parseSkillContent(content);
    if (parsed === null) continue;
    const name = typeof parsed.data.name === "string" ? parsed.data.name : basename(dirname(file));
    const description = typeof parsed.data.description === "string" ? parsed.data.description : "";
    const triggerPhrases = extractTriggerPhrases(description);
    contexts.push({
      name,
      file,
      description,
      triggerPhrases,
      broad: BROAD_SKILL_NAMES.has(name)
        || triggerPhrases.filter((trigger) => BROAD_TRIGGER_PHRASES.has(trigger)).length >= BROAD_TRIGGER_MATCH_THRESHOLD,
    });
  }
  return contexts;
}

function getMergeBaseRef(): string | null {
  try {
    return execFileSync("git", ["merge-base", "HEAD", "origin/main"], {
      cwd: REPO_ROOT,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    try {
      return execFileSync("git", ["rev-parse", "HEAD~1"], {
        cwd: REPO_ROOT,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch {
      return null;
    }
  }
}

function getDescriptionFromGitRef(filePath: string, ref: string): string | null {
  const relativeFilePath = relative(REPO_ROOT, filePath).replace(/\\/g, "/");
  try {
    const previousContent = execFileSync("git", ["show", `${ref}:${relativeFilePath}`], {
      cwd: REPO_ROOT,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const parsed = parseSkillContent(previousContent);
    if (parsed === null || typeof parsed.data.description !== "string") {
      return null;
    }
    return parsed.data.description;
  } catch {
    return null;
  }
}

export function validateTriggerOverlapDisambiguation(
  skill: SkillRoutingContext,
  allSkills: SkillRoutingContext[],
): ValidationIssue[] {
  if (skill.broad || skill.triggerPhrases.length === 0) return [];

  const issues: ValidationIssue[] = [];
  const skillTriggerSet = new Set(skill.triggerPhrases);

  for (const competitor of allSkills) {
    if (competitor.name === skill.name || !competitor.broad) continue;
    if (competitor.triggerPhrases.length === 0) continue;

    const overlaps = competitor.triggerPhrases.filter(
      (trigger) => skillTriggerSet.has(trigger) && BROAD_TRIGGER_PHRASES.has(trigger),
    );
    if (overlaps.length === 0) continue;

    if (!hasAnyDisambiguationClause(skill.description, competitor.name)) {
      const overlapPreview = overlaps.slice(0, 3).join(", ");
      const overlapSuffix = overlaps.length > 3 ? ", ..." : "";
      issues.push({
        check: "trigger-overlap-disambiguation",
        severity: "warning",
        message: `Trigger overlap with broad skill "${competitor.name}" (${overlapPreview}${overlapSuffix}). Add DO NOT USE FOR: or PREFER OVER ${competitor.name}.`,
      });
    }
  }

  return issues;
}

function validateDisambiguationRemoval(skill: SkillRoutingContext, mergeBaseRef: string | null): ValidationIssue[] {
  if (mergeBaseRef === null) return [];

  const previousDescription = getDescriptionFromGitRef(skill.file, mergeBaseRef);
  if (previousDescription === null) return [];

  if (isDisambiguationClauseRemoved(previousDescription, skill.description)) {
    return [{
      check: "disambiguation-removal",
      severity: "warning",
      message: "Removed DO NOT USE FOR/PREFER OVER clause compared to base ref. Potential routing regression.",
    }];
  }

  return [];
}

export function isDisambiguationClauseRemoved(previousDescription: string | null, currentDescription: string | null): boolean {
  const previousHasDisambiguation = hasDoNotUseForClause(previousDescription) || /\bPREFER OVER\b/i.test(previousDescription ?? "");
  const currentHasDisambiguation = hasDoNotUseForClause(currentDescription) || /\bPREFER OVER\b/i.test(currentDescription ?? "");
  return previousHasDisambiguation && !currentHasDisambiguation;
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

  // Check 5: Description length
  issues.push(...validateDescriptionLength(description));

  // Check 6: License field
  issues.push(...validateLicense(parsed.data.license));

  // Check 7: Metadata structure
  issues.push(...validateMetadata(parsed.data.metadata));

  // Check 8: metadata.version (semver)
  issues.push(...validateMetadataVersion(parsed.data.metadata));

  // Check 9: Compatibility field
  issues.push(...validateCompatibility(parsed.data.compatibility));

  // Check 10: Allowed tools field
  issues.push(...validateAllowedTools(parsed.data["allowed-tools"]));

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

// ── JSON output ──────────────────────────────────────────────────────────────

/** All check identifiers produced by the validator */
const ALL_CHECKS = [
  "frontmatter",
  "name-format",
  "missing-field",
  "description-format",
  "no-xml-tags",
  "reserved-prefix",
  "description-length",
  "license",
  "metadata",
  "metadata-version",
  "compatibility",
  "allowed-tools",
  "trigger-overlap-disambiguation",
  "disambiguation-removal",
] as const;

export interface FrontmatterSkillResult {
  name: string;
  path: string;
  status: "pass" | "fail" | "warn";
  errors: string[];
  warnings: string[];
  checks: Record<string, boolean>;
}

export interface FrontmatterJsonResult {
  skills: FrontmatterSkillResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
}

function buildJsonResult(results: ValidationResult[]): FrontmatterJsonResult {
  const skills: FrontmatterSkillResult[] = [];
  let passed = 0;
  let failed = 0;
  let warningCount = 0;

  for (const result of results) {
    const errors = result.issues.filter(i => i.severity !== "warning");
    const warnings = result.issues.filter(i => i.severity === "warning");

    // Build checks map: true = passed, false = has issue for that check
    const failedChecks = new Set(result.issues.map(i => i.check));
    const checks: Record<string, boolean> = {};
    for (const check of ALL_CHECKS) {
      checks[check] = !failedChecks.has(check);
    }

    let status: "pass" | "fail" | "warn";
    if (errors.length > 0) {
      status = "fail";
      failed++;
    } else if (warnings.length > 0) {
      status = "warn";
      warningCount++;
    } else {
      status = "pass";
      passed++;
    }

    skills.push({
      name: result.skill,
      path: relative(REPO_ROOT, result.file).replace(/\\/g, "/"),
      status,
      errors: errors.map(e => `[${e.check}] ${e.message}`),
      warnings: warnings.map(w => `[${w.check}] ${w.message}`),
      checks,
    });
  }

  return {
    skills,
    summary: {
      total: results.length,
      passed,
      failed,
      warnings: warningCount,
    },
  };
}

// ── CLI entry point ──────────────────────────────────────────────────────────

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

  let skillFiles: string[];

  if (positionals.length > 0) {
    skillFiles = [];
    for (const arg of positionals) {
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

  // Validate all skill files
  const results: ValidationResult[] = [];
  const routingContexts = buildSkillRoutingContexts(getAllSkillFiles());
  const routingContextByName = new Map(routingContexts.map((context) => [context.name, context]));
  const mergeBaseRef = getMergeBaseRef();

  for (const file of skillFiles) {
    const result = validateSkillFile(file);
    const routingContext = routingContextByName.get(result.skill);
    if (routingContext) {
      result.issues.push(...validateTriggerOverlapDisambiguation(routingContext, routingContexts));
      result.issues.push(...validateDisambiguationRemoval(routingContext, mergeBaseRef));
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
