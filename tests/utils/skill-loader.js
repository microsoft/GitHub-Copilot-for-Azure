/**
 * Skill Loader Utility
 * 
 * Loads and parses SKILL.md files from the plugin/skills directory.
 * Extracts frontmatter metadata and content.
 */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

/**
 * Load a skill by name
 * @param {string} skillName - Name of the skill folder
 * @returns {Promise<{metadata: object, content: string, path: string}>}
 */
async function loadSkill(skillName) {
  const skillPath = path.join(global.SKILLS_PATH || path.resolve(__dirname, '../../plugin/skills'), skillName);
  const skillFile = path.join(skillPath, 'SKILL.md');

  if (!fs.existsSync(skillFile)) {
    throw new Error(`SKILL.md not found for skill: ${skillName} at ${skillFile}`);
  }

  const fileContent = fs.readFileSync(skillFile, 'utf-8');
  const { data: metadata, content } = matter(fileContent);

  return {
    metadata: {
      name: metadata.name || skillName,
      description: metadata.description || '',
      ...metadata
    },
    content: content.trim(),
    path: skillPath,
    filePath: skillFile
  };
}

/**
 * Load all skills from the skills directory
 * @returns {Promise<Array<{metadata: object, content: string, path: string}>>}
 */
async function loadAllSkills() {
  const skillsPath = global.SKILLS_PATH || path.resolve(__dirname, '../../plugin/skills');
  const skillDirs = fs.readdirSync(skillsPath, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  const skills = [];
  for (const skillName of skillDirs) {
    try {
      const skill = await loadSkill(skillName);
      skills.push(skill);
    } catch (error) {
      // Skip skills without SKILL.md
      console.warn(`Skipping ${skillName}: ${error.message}`);
    }
  }

  return skills;
}

/**
 * Get list of all skill names
 * @returns {string[]}
 */
function getSkillNames() {
  const skillsPath = global.SKILLS_PATH || path.resolve(__dirname, '../../plugin/skills');
  return fs.readdirSync(skillsPath, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
}

/**
 * Check if a skill has a SKILL.md file
 * @param {string} skillName 
 * @returns {boolean}
 */
function hasSkillDefinition(skillName) {
  const skillsPath = global.SKILLS_PATH || path.resolve(__dirname, '../../plugin/skills');
  const skillFile = path.join(skillsPath, skillName, 'SKILL.md');
  return fs.existsSync(skillFile);
}

module.exports = {
  loadSkill,
  loadAllSkills,
  getSkillNames,
  hasSkillDefinition
};
