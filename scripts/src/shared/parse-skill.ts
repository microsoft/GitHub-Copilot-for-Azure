/**
 * Shared SKILL.md parser
 *
 * Thin wrapper around `gray-matter` that normalises line endings and
 * provides a typed result.  Every script that reads frontmatter from
 * SKILL.md files should use this instead of hand-rolling its own parser.
 */

import matter from "gray-matter";

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
