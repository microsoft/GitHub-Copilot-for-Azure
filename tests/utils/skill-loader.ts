/**
 * Skill Loader Utility
 * 
 * Loads and parses SKILL.md files from the output/{plugin}/skills directory.
 * Extracts frontmatter metadata and content.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import matter from "gray-matter";
import { DEFAULT_SKILL_CHAR_BUDGET, truncateSkills } from "./char-budget";

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

/**
 * Get the skills to load for a test run.
 * @param requiredSkills Optional. Skills that must be loaded into the context.
 * @param includeSkills Optional. An exact list of skills to load into the context.
 */
export async function getSkillsForTest(
  requiredSkills?: SkillRef[],
  includeSkills?: SkillRef[],
): Promise<{
  skillsLoaded: SkillRef[],
  skillDirectories: string[],
  disabledSkills?: SkillRef[]
}> {
  // By default, we infer the plugins to include from the requiredSkills.
  // A plugin is included if and only if there is at least one required skill from it.
  // We load all the skills of an included plugin into the context.
  const pluginDirnames = new Set<string>();
  requiredSkills?.forEach(skillRef => {
    pluginDirnames.add(skillRef.pluginDirname);
  });
  const pluginDirnamesList = [...pluginDirnames.values()];
  const skillDirectories = pluginDirnamesList.map(pluginDir => {
    return path.resolve(__dirname, `../../output/${pluginDir}/skills`)
  });

  // When includeSkills is defined, we load the exact skills present in the list from plugins inferred from required skills.
  // This is achieved by disabling skills that aren't in the list because skillDirectories don't give us this granular control.
  let disabledSkills: SkillRef[] | undefined;
  const skillRefs = pluginDirnamesList.map(plugin => listSkills(plugin)).flat();
  if (includeSkills) {
    if (includeSkills.some((includeSkillRef) => !skillRefs.some(ref => ref.name === includeSkillRef.name))) {
      // At least one skill to explicitly include doesn't exist within the inferred plugins.
      const invalidSkills = includeSkills.filter((includeSkillRef) => !skillRefs.some(ref => ref.name === includeSkillRef.name));
      throw new Error(`Invalid includeSkills. ${invalidSkills} are not valid skills.`);
    }
    disabledSkills = skillRefs.filter((ref) => !includeSkills
      ?.some(includeSkillRef => ref.name === includeSkillRef.name));
  } else {
    // Keep all the required skills, then randomly drop the remaining skills until the estimated char count falls below the budget.
    // Copilot CLI effectively randomly truncates skills after exceeding the char count budget.
    // We emulate Copilot CLI's behavior by preserving the required skills and randomly disable the rest of the skills.
    if (requiredSkills) {
      disabledSkills = (await truncateSkills(pluginDirnamesList, requiredSkills, DEFAULT_SKILL_CHAR_BUDGET));
    }
  }
  const noSkills = process.env.NO_SKILLS === "true";
  let skillsLoaded: SkillRef[] = [];
  if (!noSkills) {
    skillsLoaded = skillRefs.filter(s => !disabledSkills?.some(disableSkillRef => disableSkillRef.name === s.name));
  }

  return {
    skillsLoaded,
    skillDirectories,
    disabledSkills
  }
}