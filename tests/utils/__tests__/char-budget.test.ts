/**
 * Tests for char-budget helpers used for enforcing required skills.
 */

import { jest } from "@jest/globals";
import { SkillRef } from "../skill-loader.ts";

type CharBudgetModule = typeof import("../char-budget.ts");

async function importCharBudgetWithMocks(
  skills: SkillRef[],
  descriptions: Record<string, string>
): Promise<CharBudgetModule> {
  jest.resetModules();

  jest.unstable_mockModule("../skill-loader.ts", () => ({
    listSkills: () => skills,
    loadSkill: async (skillRef: SkillRef) => {
      const description = descriptions[skillRef.name];
      if (description === undefined) {
        throw new Error(`Missing mocked description for skill: ${skillRef.name} in plugin ${skillRef.pluginDirname}`);
      }
      return {
        metadata: {
          name: skillRef.name,
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
      [
        { pluginDirname: "azure-skills", name: "azure-ai" },
        { pluginDirname: "azure-skills", name: "azure-storage" }
      ],
      {
        "azure-ai": "Azure AI skill",
        "azure-storage": "Azure Storage skill",
      }
    );

    await expect(truncateSkills(["azure-skills"], [{ pluginDirname: "azure-skills", name: "azure-ai" }, { pluginDirname: "azure-skills", name: "not-a-skill" }], 20000)).rejects.toThrow(
      "Invalid requiredSkills"
    );
  });

  test("throws when required skills alone exceed char budget", async () => {
    const { truncateSkills } = await importCharBudgetWithMocks(
      [{ pluginDirname: "azure-skills", name: "azure-ai" }],
      {
        "azure-ai": "x".repeat(200),
      }
    );

    await expect(truncateSkills(["azure-skills"], [{ pluginDirname: "azure-skills", name: "azure-ai" }], 20)).rejects.toThrow(
      "requiredSkills exceed SKILL_CHAR_BUDGET (20)"
    );
  });

  test("disables a non-required skill when total equals budget (>= cutoff)", async () => {
    const descriptions = {
      required: "required desc",
      edge: "edge desc",
    };
    const { truncateSkills, getFormattedSkillDescription } = await importCharBudgetWithMocks(
      [
        { pluginDirname: "plugin-dir", name: "required" },
        { pluginDirname: "plugin-dir", name: "edge" }
      ],
      descriptions
    );

    const requiredLen = (await getFormattedSkillDescription("required", descriptions.required)).length;
    const edgeLen = (await getFormattedSkillDescription("edge", descriptions.edge)).length;
    const equalBudget = requiredLen + 1 + edgeLen + 1;

    const disabled = await truncateSkills(["plugin-dir"], [{ pluginDirname: "plugin-dir", name: "required" }], equalBudget);

    expect(disabled).toEqual([{ pluginDirname: "plugin-dir", name: "edge" }]);
  });
});
