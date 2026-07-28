/**
 * Check if the formatted skill description of all the skills fit within Copilot CLI's default char budget.
 * See https://github.com/github/copilot-agent-runtime/blob/0e43d66f7570421ba4b27a36a86ea908de188e59/src/skills/skillToolDescription.ts#L30
 */

import { listPlugins, listSkills, loadSkill, SkillRef } from "./shared/skill-helper.js";
import { escapeXml } from "./shared/string-helpers.js";

const SKILL_CHAR_BUDGET_ENV = "SKILL_CHAR_BUDGET";
// Note: Copilot CLI's default skill char budget is 15000,
// we set our budget to 20000 as a soft cap to not block skill contributions
// and remind us when the consumption grows too fast.
const DEFAULT_SKILL_CHAR_BUDGET = 20000;

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

function formatSkillForToolDescription(skillRef: SkillRef): string {
  const skill = loadSkill(skillRef);

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

type PluginCheckResult = CheckSkillCharBudgetResult & {
  plugin: string;
};

/**
 * Checks the char budget for a single plugin's skills.
 */
function checkPluginCharBudget(pluginName: string, budget: number): PluginCheckResult {
  const skills = listSkills(pluginName);

  let charCount = 0;
  for (const skill of skills) {
    const skillXml = formatSkillForToolDescription(skill);
    // +1 for newline between skills
    charCount += skillXml.length + 1;
  }

  return {
    plugin: pluginName,
    canFitInBudget: charCount <= budget,
    budget,
    actualCharCount: charCount,
  };
}

/**
 * Checks if the formatted skill description of all plugins' skills can fit in Copilot CLI's skill char budget.
 * Iterates over every directory in plugins/ and checks each one independently.
 */
function checkCopilotCliSkillsCharBudget(): Record<string, PluginCheckResult> {
  const pluginNames = listPlugins().map((p) => p.dirname);
  const budget = getSkillCharBudget();

  const result: Record<string, PluginCheckResult> = {};
  if (pluginNames.length === 0) {
    return result;
  }

  for (const pluginName of pluginNames) {
    const pluginResult = checkPluginCharBudget(pluginName, budget);
    result[pluginName] = pluginResult;
  }

  return result;
}

function main() {
  const result = checkCopilotCliSkillsCharBudget();
  for (const pluginName in result) {
    const pluginResult = result[pluginName];
    if (!pluginResult.canFitInBudget) {
      console.error(`plugin ${pluginName}: formatted skill description char count exceeds the Copilot CLI skill char budget. budget: ${pluginResult.budget}, actualCharCount: ${pluginResult.actualCharCount}`);
      process.exitCode = 1;
      return;
    } else {
      console.log(`plugin ${pluginName}: formatted skill description char count fits within the Copilot CLI skill char budget. budget: ${pluginResult.budget}, actualCharCount: ${pluginResult.actualCharCount}`);
    }
  }
}

main();