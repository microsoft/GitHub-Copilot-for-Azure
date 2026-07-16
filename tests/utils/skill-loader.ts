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
  plugin: string;
  name: string;
  description: string;
  [key: string]: unknown;
};

export type SkillRef = {
  plugin: string;
  name: string;
}

export type LoadedSkill = {
  metadata: SkillMetadata;
  content: string;
  path: string;
  filePath: string;
};

export type Plugin = {
  name: string;
  skills: SkillRef[];
};

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
 * Load a skill by name
 */
export async function loadSkill(skillRef: SkillRef): Promise<LoadedSkill> {
  let skillPath;
  if (global.OUTPUT_PATH) {
    // global.OUTPUT_PATH is only defined in JEST context
    skillPath = path.join(
      path.join(global.OUTPUT_PATH, skillRef.plugin),
      skillRef.name
    );
  } else {
    const pluginDirname = pluginDirnameMap.get(skillRef.plugin) ?? skillRef.plugin;
    skillPath = path.join(
      path.resolve(__dirname, `../../output/${pluginDirname}/skills`),
      skillRef.name
    );
  }
  const skillFile = path.join(skillPath, "SKILL.md");

  if (!fs.existsSync(skillFile)) {
    throw new Error(`SKILL.md not found for skill: ${skillRef.name} at ${skillFile} in plugin ${skillRef.plugin}`);
  }

  const fileContent = fs.readFileSync(skillFile, "utf-8");
  const { data: metadata, content } = matter(fileContent);

  return {
    metadata: {
      plugin: skillRef.plugin,
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
export function listSkills(plugin: string): SkillRef[] {
  let skillsDir;
  if (global.OUTPUT_PATH) {
    // global.OUTPUT_PATH is only defined in JEST context
    skillsDir = path.join(global.OUTPUT_PATH, plugin, "skills")
  } else {
    const pluginDirname = pluginDirnameMap.get(plugin) ?? plugin;
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
        plugin: plugin,
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
        name: item.name,
        skills: listSkills(item.name)
      }
    });
}