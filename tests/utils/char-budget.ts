import { listSkills, loadSkill } from "./skill-loader.ts";

export const DEFAULT_SKILL_CHAR_BUDGET = 20000;

/**
 * Load all skills from azure-skills plugin, preserve the required ones and randomly drop the rest of the skills until the estimated char usage falls below the budget.
 * @param requiredSkills skills that cannot be truncated.
 * @returns the skills to disable to emulate truncation.
 */
export async function truncateSkills(requiredSkills: string[], charBudget: number): Promise<string[] | undefined> {
  const skills = listSkills();
  const invalidSkills = requiredSkills.filter((s) => !skills.includes(s));
  if (invalidSkills.length > 0) {
    throw new Error(`Invalid requiredSkills. ${invalidSkills} do not exist in azure-skills plugin.`);
  }
  const nonRequiredSkills = skills.filter((s) => !requiredSkills.includes(s));
  let charCount = 0;

  for (const skill of requiredSkills) {
    const skillObject = await loadSkill(skill);
    const skillXml = await getFormattedSkillDescription(skillObject.metadata.name, skillObject.metadata.description);
    // +1 for newline between skills
    charCount += skillXml.length + 1;
  }

  if (charCount > charBudget) {
    throw new Error(
      `requiredSkills exceed SKILL_CHAR_BUDGET (${charBudget}). Required skills consume ${charCount} chars; cannot guarantee required skill descriptions will be preserved.`,
    );
  }

  // Fisher-Yates shuffle
  for (let i = nonRequiredSkills.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [nonRequiredSkills[i], nonRequiredSkills[j]] = [nonRequiredSkills[j], nonRequiredSkills[i]];
  }

  for (let i = 0; i < nonRequiredSkills.length; i++) {
    const skill = nonRequiredSkills[i];
    const skillObject = await loadSkill(skill);
    const skillXml = await getFormattedSkillDescription(skillObject.metadata.name, skillObject.metadata.description);
    if (charCount + skillXml.length + 1 >= charBudget) {
      // Return a list of skills including and after the current one
      return nonRequiredSkills.slice(i);
    } else {
      charCount += skillXml.length + 1;
    }
  }

  return [];
}

export async function getFormattedSkillDescription(skillName: string, description: string): Promise<string> {
  // azure plugin skills are loaded from "Custom" locations when they are installed via marketplace.
  // The formatted text may be different but the char count would be similar.
  return `<skill>
  <name>${escapeXml(skillName)}</name>
  <description>${escapeXml(description)}</description>
  <location>Custom</location>
</skill>`;
}

/**
 * Escapes special XML characters in a string.
 * @param str - The string to escape
 * @returns The escaped string
 */
export function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}