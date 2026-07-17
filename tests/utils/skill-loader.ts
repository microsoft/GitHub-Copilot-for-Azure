/**
 * Skill Loader Utility
 * 
 * Loads and parses SKILL.md files from the output/skills directory.
 * Extracts frontmatter metadata and content.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import matter from "gray-matter";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
   * For example, the directory name of "azure" plugin is "azure-skills". 
   * Some external marketplaces already depend on it.
   * For example, see https://github.com/github/awesome-copilot/blob/30472ecf0fe34cc561df958c08501ecc5ca80ea4/.github/plugin/marketplace.json#L142
   * Given a plugin's directory name, we can easily retrieve its plugin name by reading the plugin.json file.
   * Discover a plugin directory name from the plugin name is much harder.
   * Therefore we maintain references to plugins by their directory names.
   */
  dirname: string;
  skills: SkillRef[];
};

/**
 * Load a skill by name
 */
export async function loadSkill(skillRef: SkillRef): Promise<LoadedSkill> {
  let skillPath;
  if (global.OUTPUT_PATH) {
    // global.OUTPUT_PATH is only defined in JEST context
    skillPath = path.join(
      global.OUTPUT_PATH,
      skillRef.pluginDirname,
      "skills",
      skillRef.name
    );
  } else {
    skillPath = path.join(
      path.resolve(__dirname, `../../output/${skillRef.pluginDirname}/skills`),
      skillRef.name
    );
  }
  const skillFile = path.join(skillPath, "SKILL.md");

  if (!fs.existsSync(skillFile)) {
    throw new Error(`SKILL.md not found for skill: ${skillRef.name} at ${skillFile} in plugin ${skillRef.pluginDirname}`);
  }

  const fileContent = fs.readFileSync(skillFile, "utf-8");
  const { data: metadata, content } = matter(fileContent);

  return {
    metadata: {
      pluginDirname: skillRef.pluginDirname,
      name: (metadata.name as string) || skillRef.name,
      description: (metadata.description as string) || "",
      ...metadata
    },
    content: content.trim(),
    path: skillPath,
    filePath: skillFile
  };
}

/**
 * @returns SkillRef objects in a given plugin.
 */
export function listSkills(pluginDirname: string): SkillRef[] {
  let skillsDir;
  if (global.OUTPUT_PATH) {
    // global.OUTPUT_PATH is only defined in JEST context
    skillsDir = path.join(global.OUTPUT_PATH, pluginDirname, "skills")
  } else {
    skillsDir = path.resolve(__dirname, `../../output/${pluginDirname}/skills`);
  }
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
  let pluginsDir;
  if (global.OUTPUT_PATH) {
    // global.OUTPUT_PATH is only defined in JEST context
    pluginsDir = global.OUTPUT_PATH
  } else {
    pluginsDir = path.resolve(__dirname, "../../output/");
  }
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