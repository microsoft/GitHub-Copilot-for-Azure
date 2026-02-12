/**
 * Skill Loader Utility
 * 
 * Loads and parses SKILL.md files from the plugin/skills directory.
 * Extracts frontmatter metadata and content.
 */

import * as fs from "fs";
import * as path from "path";
import matter from "gray-matter";

// Get the directory path from global jest setup or use current directory
const skillsDir = (global as any).TESTS_PATH || path.resolve(".");

export interface SkillMetadata {
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
    global.SKILLS_PATH || path.resolve(skillsDir, "../../plugin/skills"),
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
 * Load all skills from the skills directory
 */
export async function loadAllSkills(): Promise<LoadedSkill[]> {
  const skillsPath = global.SKILLS_PATH || path.resolve(skillsDir, "../../plugin/skills");
  const skillDirs = fs.readdirSync(skillsPath, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  const skills: LoadedSkill[] = [];
  for (const skillName of skillDirs) {
    try {
      const skill = await loadSkill(skillName);
      skills.push(skill);
    } catch (error) {
      // Skip skills without SKILL.md
      console.warn(`Skipping ${skillName}: ${(error as Error).message}`);
    }
  }

  return skills;
}

/**
 * Get list of all skill names
 */
export function getSkillNames(): string[] {
  const skillsPath = global.SKILLS_PATH || path.resolve(skillsDir, "../../plugin/skills");
  return fs.readdirSync(skillsPath, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
}

/**
 * Check if a skill has a SKILL.md file
 */
export function hasSkillDefinition(skillName: string): boolean {
  const skillsPath = global.SKILLS_PATH || path.resolve(skillsDir, "../../plugin/skills");
  const skillFile = path.join(skillsPath, skillName, "SKILL.md");
  return fs.existsSync(skillFile);
}
