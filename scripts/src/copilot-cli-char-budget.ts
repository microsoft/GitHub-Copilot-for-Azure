/**
 * Check if the formatted skill description of all the skills fit within Copilot CLI's default char budget.
 * See https://github.com/github/copilot-agent-runtime/blob/0e43d66f7570421ba4b27a36a86ea908de188e59/src/skills/skillToolDescription.ts#L30
 */

import { listSkills, loadSkill } from "./helpers/skill-helper.js";
import { escapeXml } from "./helpers/string-helpers.js";

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

/**
 * Formats all available skills for the tool description, with truncation.
 * Skills are added in priority order until the character budget is exceeded.
 * @param skills - Array of skills in priority order
 * @returns Formatted XML string with available skills
 */
function checkCopilotCliSkillsCharBudget(): {
    canFitInBudget: boolean,
    budget: number,
    actualCharCount: number
} {
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
        process.exit(1);
    } else {
        console.log(`Formatted skill description char count fits within the Copilot CLI skill char budget. budget: ${result.budget}, actualCharCount: ${result.actualCharCount}`);
    }
    return;
}

main();