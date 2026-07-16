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

export function getRepoRoot(): string {
  return path.resolve(__dirname, "../../..");
}

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

export type SkillMetadata = {
  /**
   * The directory name containing the plugin files in the shared plugins directory.
   */
  pluginDirname: string;
  name: string;
  description: string;
  [key: string]: unknown;
};

export type SkillRef = {
  /**
   * The directory name containing the plugin files in the shared plugins directory.
   */
  pluginDirname: string;
  name: string;
}

export type LoadedSkill = {
  metadata: SkillMetadata;
  content: string;

  /**
   * Absolute path to the skill's directory.
   */
  path: string;

  /**
   * Absolute path to the skill's SKILL.md file.
   */
  filePath: string;
};

export type Plugin = {
  /**
   * The directory name containing the plugin files in the shared plugins directory.
   * 
   * Plugin directory name can be different from from the plugin's name.
   * For example, the directory name of "azure" plugin has been "azure-skills". 
   * Some external marketplaces already depend on it.
   * For example, see https://github.com/github/awesome-copilot/blob/30472ecf0fe34cc561df958c08501ecc5ca80ea4/.github/plugin/marketplace.json#L142
   * Given a plugin's directory name, we can easily retrieve its plugin name by reading the plugin.json file.
   * Discover a plugin directory name from the plugin name is much harder.
   * Therefore we maintain references to plugins by their directory names.
   */
  dirname: string;
  skills: SkillRef[];
};

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
 * By default the directory of the plugin in the build output should be the exact name of the plugin.
 * However, "azure" plugin has been published with "azure-skills" and external marketplaces that references our plugin already depend on it.
 * For example, https://github.com/github/awesome-copilot/blob/30472ecf0fe34cc561df958c08501ecc5ca80ea4/.github/plugin/marketplace.json#L142
 * If a plugin has a mapped directory name here, its build output will be written under the mapped directory name.
 */
const pluginDirnameMap = new Map<string, string>([
  ["azure", "azure-skills"]
]);

/**
 * Load a skill by name.
 *
 * Reads the SKILL.md file from `plugin/skills/<skillName>` and parses it
 * via `parseSkillContent`.  Throws when the file is missing or contains
 * no valid frontmatter.
 */
export function loadSkill(skillRef: SkillRef): LoadedSkill {
  const pluginDirname = pluginDirnameMap.get(skillRef.pluginDirname) ?? skillRef.pluginDirname;
  const skillPath = path.join(
    getRepoRoot(),
    `plugins/${pluginDirname}/skills/${skillRef.name}`
  );
  const skillFile = path.join(skillPath, "SKILL.md");

  if (!fs.existsSync(skillFile)) {
    throw new Error(`SKILL.md not found for skill: ${skillRef} at ${skillFile} in plugin ${skillRef.pluginDirname}`);
  }

  const fileContent = fs.readFileSync(skillFile, "utf-8");
  const parsed = parseSkillContent(fileContent);

  if (!parsed) {
    throw new Error(`Invalid or missing frontmatter in SKILL.md for skill: ${skillRef}`);
  }

  return {
    metadata: {
      pluginDirname: skillRef.pluginDirname,
      name: (parsed.data.name as string) || skillRef.name,
      description: (parsed.data.description as string) || "",
      ...parsed.data
    },
    content: parsed.content.trim(),
    path: skillPath,
    filePath: skillFile
  };
}

/**
 * @returns SkillRef objects in a given plugin.
 */
export function listSkills(pluginDirname: string): SkillRef[] {
  const skillsDir = path.resolve(
    getRepoRoot(),
    `output/${pluginDirname}/skills`
  );

  const items = fs.readdirSync(skillsDir, { withFileTypes: true });
  return items
    .filter((item) => item.isDirectory())
    .filter((item) => {
      const skillMdPath = path.join(skillsDir, item.name, "SKILL.md");
      return fs.existsSync(skillMdPath);
    })
    .map((item) => {
      return {
        pluginDirname: pluginDirname,
        name: item.name
      }
    });
}

export function listPlugins(): Plugin[] {
  const pluginsDir = path.resolve(
    __dirname,
    getRepoRoot(),
    "output"
  );
  const items = fs.readdirSync(pluginsDir, { withFileTypes: true });
  return items
    .filter((item) => item.isDirectory())
    .map((item) => {
      return {
        dirname: item.name,
        skills: listSkills(item.name)
      }
    });
}