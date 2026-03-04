/**
 * Skill Loader Utility
 * 
 * Loads and parses SKILL.md files from the plugin/skills directory.
 * Extracts frontmatter metadata and content.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import matter from "gray-matter";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

/**
 * Load a skill by name
 */
export async function loadSkill(skillName: string): Promise<LoadedSkill> {
  const skillPath = path.join(
    global.SKILLS_PATH || path.resolve(__dirname, "../../plugin/skills"),
    skillName
  );
  const skillFile = path.join(skillPath, "SKILL.md");

  if (!fs.existsSync(skillFile)) {
    throw new Error(`SKILL.md not found for skill: ${skillName} at ${skillFile}`);
  }

  const fileContent = fs.readFileSync(skillFile, "utf-8");
  const { data: metadata, content } = matter(fileContent);

  return {
    metadata: {
      name: (metadata.name as string) || skillName,
      description: (metadata.description as string) || "",
      ...metadata
    },
    content: content.trim(),
    path: skillPath,
    filePath: skillFile
  };
}

/**
 * @returns Names of skills in azure plugin.
 */
export function listSkills(): string[] {
  const skillsDir = global.SKILLS_PATH || path.resolve(__dirname, "../../plugin/skills");
  const items = fs.readdirSync(skillsDir, { withFileTypes: true });
  return items
    .filter((item) => item.isDirectory())
    .filter((item) => {
      const skillMdPath = path.join(item.parentPath, item.name, "SKILL.md");
      return fs.existsSync(skillMdPath);
    })
    .map((item) => item.name);
}