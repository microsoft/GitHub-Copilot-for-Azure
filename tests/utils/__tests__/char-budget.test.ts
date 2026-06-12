/**
 * Tests for char-budget helpers used for enforcing required skills.
 */

import { jest } from "@jest/globals";

type CharBudgetModule = typeof import("../char-budget.ts");

async function importCharBudgetWithMocks(
  skills: string[],
  descriptions: Record<string, string>
): Promise<CharBudgetModule> {
  jest.resetModules();

  jest.unstable_mockModule("../skill-loader.ts", () => ({
    listSkills: () => skills,
    loadSkill: async (skillName: string) => {
      const description = descriptions[skillName];
      if (description === undefined) {
        throw new Error(`Missing mocked description for skill: ${skillName}`);
      }
      return {
        metadata: {
          name: skillName,
          description,
        },
      };
    },
  }));

  return import("../char-budget.ts");
}

describe("truncateSkills", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
  });

  test("throws when requiredSkills contains an invalid skill", async () => {
    const { truncateSkills } = await importCharBudgetWithMocks(
      ["azure-ai", "azure-storage"],
      {
        "azure-ai": "Azure AI skill",
        "azure-storage": "Azure Storage skill",
      }
    );

    await expect(truncateSkills(["azure-ai", "not-a-skill"], 20000)).rejects.toThrow(
      "Invalid requiredSkills"
    );
  });

  test("throws when required skills alone exceed char budget", async () => {
    const { truncateSkills } = await importCharBudgetWithMocks(
      ["azure-ai"],
      {
        "azure-ai": "x".repeat(200),
      }
    );

    await expect(truncateSkills(["azure-ai"], 20)).rejects.toThrow(
      "requiredSkills exceed SKILL_CHAR_BUDGET (20)"
    );
  });

  test("disables a non-required skill when total equals budget (>= cutoff)", async () => {
    const descriptions = {
      required: "required desc",
      edge: "edge desc",
    };
    const { truncateSkills, getFormattedSkillDescription } = await importCharBudgetWithMocks(
      ["required", "edge"],
      descriptions
    );

    const requiredLen = (await getFormattedSkillDescription("required", descriptions.required)).length;
    const edgeLen = (await getFormattedSkillDescription("edge", descriptions.edge)).length;
    const equalBudget = requiredLen + 1 + edgeLen + 1;

    const disabled = await truncateSkills(["required"], equalBudget);

    expect(disabled).toEqual(["edge"]);
  });
});
