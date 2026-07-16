// ── Types ────────────────────────────────────────────────────────────────────

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";
import { getRepoRoot, parseSkillContent } from "../shared/skill-helper.js";

export interface ValidationIssue {
  check: string;     // Check identifier (e.g., "name-format", "description-format")
  message: string;   // Human-readable explanation
  severity?: "error" | "warning";  // Defaults to "error" if omitted
}

export interface ValidationResult {
  skill: string;
  file: string;
  issues: ValidationIssue[];
  /** Raw description text, or null when missing/unparseable. */
  description?: string | null;
}

export interface SkillRoutingContext {
  name: string;
  file: string;
  description: string;
  triggerPhrases: string[];
  broad: boolean;
}

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
const TRIGGER_SECTION_STOP_HEADERS = ["DO NOT USE FOR", ...TRIGGER_SECTION_KEYWORDS] as const;

// Extracts only explicit trigger sections and stops before disambiguation/next trigger section.
// Section headers must include a trailing colon; `PREFER OVER` is handled separately
// because it may appear without one.
const TRIGGER_SECTION_RE = new RegExp(
  `\\b(?:${TRIGGER_SECTION_KEYWORDS.join("|")}):\\s*([^]*?)(?=(?:\\b(?:${TRIGGER_SECTION_STOP_HEADERS.join("|")}):|\\bPREFER OVER\\b|$))`,
  "gi",
);
const DO_NOT_USE_FOR_RE = /\bDO NOT USE FOR:/i;
const SANITIZED_DO_NOT_USE_FOR_MARKER = "DO_NOT_USE_FOR:";
const DISAMBIGUATION_CLAUSE_MARKER_RE = new RegExp(`(?:${SANITIZED_DO_NOT_USE_FOR_MARKER}|PREFER OVER\\b)`, "i");
export const BROAD_SKILL_NAMES = new Set(["azure-prepare", "azure-deploy"]);
const MIN_TRIGGER_PHRASE_LENGTH = 4;
export const OVERLAP_PREVIEW_LIMIT = 3;

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

  // Prevent `USE FOR:` inside `DO NOT USE FOR:` from being treated as a trigger section.
  const sanitizedDescription = description.replace(/\bDO NOT USE FOR:/gi, SANITIZED_DO_NOT_USE_FOR_MARKER);
  const phrases: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = TRIGGER_SECTION_RE.exec(sanitizedDescription)) !== null) {
    const section = match[1];
    const disambiguationStart = section.search(DISAMBIGUATION_CLAUSE_MARKER_RE);
    const triggerSection = disambiguationStart >= 0 ? section.slice(0, disambiguationStart) : section;
    for (const rawPhrase of triggerSection.split(/[;,]/)) {
      const normalized = normalizeTriggerPhrase(rawPhrase);
      if (normalized.length >= MIN_TRIGGER_PHRASE_LENGTH) {
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

export function validateSkillFile(filePath: string): ValidationResult {
  const parentDir = basename(dirname(filePath));
  const content = readFileSync(filePath, "utf-8");
  const parsed = parseSkillContent(content);
  const issues: ValidationIssue[] = [];

  if (parsed === null) {
    issues.push({ check: "frontmatter", message: "Missing YAML frontmatter (file must start with ---)" });
    return { skill: parentDir, file: filePath, issues, description: null };
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

  return { skill: parentDir, file: filePath, issues, description };
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
      (trigger) => skillTriggerSet.has(trigger),
    );
    if (overlaps.length === 0) continue;

    if (!hasAnyDisambiguationClause(skill.description, competitor.name)) {
      const overlapPreview = overlaps.slice(0, OVERLAP_PREVIEW_LIMIT).join(", ");
      const overlapSuffix = overlaps.length > OVERLAP_PREVIEW_LIMIT ? ", ..." : "";
      issues.push({
        check: "trigger-overlap-disambiguation",
        severity: "error",
        message: `Trigger overlap with broad skill "${competitor.name}" (${overlapPreview}${overlapSuffix}). Add DO NOT USE FOR: or PREFER OVER ${competitor.name}.`,
      });
    }
  }

  return issues;
}

const REPO_ROOT = getRepoRoot();

function hasAnyDisambiguationClause(description: string | null, competingSkillName: string): boolean {
  return hasDoNotUseForClause(description) || hasPreferOverClause(description, competingSkillName);
}

export function buildSkillRoutingContexts(skillFiles: string[]): SkillRoutingContext[] {
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
      broad: isBroadRoutingSkill(name),
    });
  }
  return contexts;
}

function isBroadRoutingSkill(name: string): boolean {
  // Restrict "broad" classification to an explicit allowlist to avoid
  // specialized skills being accidentally reclassified as broad.
  return BROAD_SKILL_NAMES.has(name);
}

/**
 * Resolve a CLI positional argument to one or more SKILL.md file paths.
 *
 * Three accepted forms:
 *   1. Path to a SKILL.md file directly → [that file]
 *   2. Path to a directory that has a skill nested within, but has no ancestor directory that is a skill directory.
 * 
 * If a directory contains a SKILL.md, it will be considered as a skill directory.
 * Nested SKILL.md files under skill directories won't be included in the result. 
 * 
 * For example, consider the following files.
 * - plugins/plugin-A/skills/skill-A/SKILL.md
 * - plugins/plugin-A/skills/skill-A/references/SKILL.md
 * 
 * The input path can be plugins/, plugins/plugin-A, plugins/plugin-A/skills, plugins/plugin-A/skills/skill-A
 * It cannot be plugins/plugin-A/skills/skill-A/references because plugins/plugin-A/skills/skill-A is a skill directory.
 * 
 * @returns Paths to discovered SKILL.md files.
 */
export function resolveSkillFiles(relativePath: string): {
  files: string[],
  errorMessage?: string
} {
  const resolved = resolve(relativePath);

  if (!existsSync(resolved)) {
    return {
      files: [],
      errorMessage: `Path not found: ${relativePath}`
    };
  }

  const st = statSync(resolved);

  if (st.isFile()) {
    if (basename(resolved) !== "SKILL.md") {
      return {
        files: [],
        errorMessage: `Expected a SKILL.md file but got: ${relativePath}`,
      };
    }
    return { files: [resolved] };
  }

  if (st.isDirectory()) {
    const files: string[] = [];
    const candidates: string[] = [resolved];

    while (candidates.length > 0) {
      const dir = candidates.pop()!;
      let entries: string[];
      try {
        entries = readdirSync(dir);
      } catch {
        continue;
      }

      const skillMd = resolve(dir, "SKILL.md");
      if (existsSync(skillMd)) {
        // This directory is a skill — record its SKILL.md and don't recurse into subdirs
        // Since we only check for nested directories, the directory to search must not be nested in a skill directory.
        files.push(skillMd);
      } else {
        // Not a skill directory — add subdirectories to the search queue
        for (const entry of entries) {
          const full = resolve(dir, entry);
          try {
            if (statSync(full).isDirectory()) {
              candidates.push(full);
            }
          } catch {
            // skip inaccessible entries
          }
        }
      }
    }

    files.sort();

    if (files.length === 0) {
      return { files: [], errorMessage: `No skills found in directory: ${relativePath}` };
    }
    return { files };
  }

  return {
    files: [],
    errorMessage: `Path is neither a file nor a directory: ${relativePath}`,
  }
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
  /** Raw description text ("" when missing). Length is derivable by consumers. */
  description: string;
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

export function buildJsonResult(results: ValidationResult[]): FrontmatterJsonResult {
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

    const description = result.description ?? "";
    skills.push({
      name: result.skill,
      path: relative(REPO_ROOT, result.file).replace(/\\/g, "/"),
      status,
      errors: errors.map(e => `[${e.check}] ${e.message}`),
      warnings: warnings.map(w => `[${w.check}] ${w.message}`),
      checks,
      description,
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