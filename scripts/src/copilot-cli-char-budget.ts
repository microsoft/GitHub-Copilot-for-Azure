/**
 * Check if the formatted skill description of all the skills fit within Copilot CLI's default char budget.
 * See https://github.com/github/copilot-agent-runtime/blob/0e43d66f7570421ba4b27a36a86ea908de188e59/src/skills/skillToolDescription.ts#L30
 */

import { listSkills, loadSkill } from "./shared/skill-helper.js";
import { escapeXml } from "./shared/string-helpers.js";

const SKILL_CHAR_BUDGET_ENV = "SKILL_CHAR_BUDGET";
const DEFAULT_SKILL_CHAR_BUDGET = 15000;

function getSkillCharBudget() {
  const envBudget = process.env[SKILL_CHAR_BUDGET_ENV];
  if (envBudget) {
    const parsed = parseInt(envBudget, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_SKILL_CHAR_BUDGET;
}

function formatSkillForToolDescription(skillName: string): string {
  const skill = loadSkill(skillName);

  // azure plugin skills are loaded from "Custom" locations when they are installed via marketplace.
  // The formatted text may be different but the char count would be similar.
  return `<skill>
  <name>${escapeXml(skill.metadata.name)}</name>
  <description>${escapeXml(skill.metadata.description)}</description>
  <location>Custom</location>
</skill>`;
}

type CheckSkillCharBudgetResult = {
  canFitInBudget: boolean;
  budget: number;
  actualCharCount: number;
};

/**
 * Checks if the formatted skill description of azure plugin skills can fit in Copilot CLI's skill char budget.
 */
function checkCopilotCliSkillsCharBudget(): CheckSkillCharBudgetResult {
  const skills = listSkills();
  const budget = getSkillCharBudget();
  if (skills.length === 0) {
    return {
      canFitInBudget: true,
      budget: budget,
      actualCharCount: 0
    }
  }

  let charCount = 0;

  for (const skill of skills) {
    const skillXml = formatSkillForToolDescription(skill);
    // +1 for newline between skills
    charCount += skillXml.length + 1;
  }

  return {
    canFitInBudget: charCount <= budget,
    budget: budget,
    actualCharCount: charCount
  }
}

function main() {
  const result = checkCopilotCliSkillsCharBudget();
  if (!result.canFitInBudget) {
    console.error(`Formatted skill description char count exceeds the Copilot CLI skill char budget. budget: ${result.budget}, actualCharCount: ${result.actualCharCount}`);
    process.exitCode = 1;
    return;
  } else {
    console.log(`Formatted skill description char count fits within the Copilot CLI skill char budget. budget: ${result.budget}, actualCharCount: ${result.actualCharCount}`);
  }
}

main();