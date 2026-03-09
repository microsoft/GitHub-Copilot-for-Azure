/**
 * Skill Utility
 *
 * Shared helpers for loading, listing, and parsing SKILL.md files from the
 * plugin/skills directory.  All frontmatter parsing goes through
 * `parseSkillContent` which normalises line endings, validates `---`
 * delimiters, and exposes the raw YAML source.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Types ────────────────────────────────────────────────────────────────────

/** Parsed frontmatter result from a SKILL.md file. */
export interface ParsedSkill {
  /** Parsed key-value pairs (name, description, …). */
  data: Record<string, unknown>;
  /** Markdown body after the closing `---`. */
  content: string;
  /**
   * Raw frontmatter text between the `---` delimiters (not including the
   * delimiters themselves).  Useful for checks that need the original YAML
   * source — e.g. detecting block scalars (`>-`, `|`) or XML-like tags.
   */
  raw: string;
}

interface SkillMetadata {
  name: string;
  description: string;
  [key: string]: unknown;
}

export interface LoadedSkill {
  metadata: SkillMetadata;
  content: string;
  path: string;
  filePath: string;
}

// ── Parser ───────────────────────────────────────────────────────────────────

/**
 * Parse SKILL.md file content and extract frontmatter.
 *
 * - Normalises `\r\n` → `\n` before parsing.
 * - Returns `null` when the file does not contain valid `---` delimited
 *   frontmatter (instead of throwing).
 */
export function parseSkillContent(fileContent: string): ParsedSkill | null {
  // Normalise Windows line-endings
  const normalised = fileContent.replace(/\r\n/g, "\n");

  // Quick guard: gray-matter is lenient — we require the file to start
  // with `---` (the agentskills.io spec mandates it).
  if (!normalised.startsWith("---")) return null;

  // Also require a closing `---` delimiter.  gray-matter treats
  // EOF as an implicit close, but the spec requires explicit delimiters.
  const closingIndex = normalised.indexOf("\n---", 3);
  if (closingIndex === -1) return null;

  try {
    const result = matter(normalised);

    // gray-matter sets `data` to `{}` when there is no frontmatter or
    // when the delimiters are malformed.  Treat that as "no frontmatter".
    if (Object.keys(result.data).length === 0) return null;

    // Extract the raw YAML block.  gray-matter exposes `result.matter` in
    // recent versions but its behaviour across versions is inconsistent,
    // so we derive it ourselves from the normalised input.
    const raw = normalised.substring(4, closingIndex);

    return {
      data: result.data as Record<string, unknown>,
      content: result.content,
      raw,
    };
  } catch {
    // YAML parse error → treat as "no valid frontmatter"
    return null;
  }
}

// ── Loaders ──────────────────────────────────────────────────────────────────

/**
 * Load a skill by name.
 *
 * Reads the SKILL.md file from `plugin/skills/<skillName>` and parses it
 * via `parseSkillContent`.  Throws when the file is missing or contains
 * no valid frontmatter.
 */
export function loadSkill(skillName: string): LoadedSkill {
  const skillPath = path.join(
    path.resolve(__dirname, "../../../plugin/skills"),
    skillName
  );
  const skillFile = path.join(skillPath, "SKILL.md");

  if (!fs.existsSync(skillFile)) {
    throw new Error(`SKILL.md not found for skill: ${skillName} at ${skillFile}`);
  }

  const fileContent = fs.readFileSync(skillFile, "utf-8");
  const parsed = parseSkillContent(fileContent);

  if (!parsed) {
    throw new Error(`Invalid or missing frontmatter in SKILL.md for skill: ${skillName}`);
  }

  return {
    metadata: {
      name: (parsed.data.name as string) || skillName,
      description: (parsed.data.description as string) || "",
      ...parsed.data
    },
    content: parsed.content.trim(),
    path: skillPath,
    filePath: skillFile
  };
}

/**
 * @returns Names of skills in azure plugin.
 */
export function listSkills(): string[] {
  const skillsDir = path.resolve(__dirname, "../../../plugin/skills");
  const items = fs.readdirSync(skillsDir, { withFileTypes: true });
  return items
    .filter((item) => item.isDirectory())
    .filter((item) => {
      const skillMdPath = path.join(skillsDir, item.name, "SKILL.md");
      return fs.existsSync(skillMdPath);
    })
    .map((item) => item.name);
}