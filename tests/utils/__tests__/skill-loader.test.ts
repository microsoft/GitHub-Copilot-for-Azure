/**
 * Tests for char-budget helpers used for enforcing required skills.
 */

import { jest } from "@jest/globals";
import { truncateSkills, loadSkill, getFormattedSkillDescription, getSkillsForTest, SkillRef } from "../skill-loader.js";

describe("truncateSkills", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
  });

  test("throws when requiredSkills contains an invalid skill", async () => {
    await expect(truncateSkills(["azure-skills"], [{ pluginDirname: "azure-skills", name: "azure-ai" }, { pluginDirname: "azure-skills", name: "not-a-skill" }], 20000)).rejects.toThrow(
      "Invalid requiredSkills"
    );
  });

  test("throws when required skills alone exceed char budget", async () => {
    await expect(truncateSkills(["azure-skills"], [{ pluginDirname: "azure-skills", name: "azure-ai" }], 20)).rejects.toThrow(
      "requiredSkills exceed SKILL_CHAR_BUDGET (20)"
    );
  });

  test("disables a non-required skill when total equals budget (>= cutoff)", async () => {
    const requiredSkill = await loadSkill({ pluginDirname: "azure-skills", name: "azure-ai" });
    const requiredLen = (await getFormattedSkillDescription("azure-ai", requiredSkill.metadata.description)).length;
    const disabled = await truncateSkills(["azure-skills"], [{ pluginDirname: "azure-skills", name: "azure-ai" }], requiredLen + 1);
    expect(disabled?.some(ref => ref.name === "azure-prepare" && ref.pluginDirname === "azure-skills")).toBe(true);
  });
});

describe("getSkillsForTest", () => {
  test("gets skills from the required plugin", async () => {
    const requiredSkills: SkillRef[] = [{ pluginDirname: "azure-skills", name: "azure-ai" }];
    const result = await getSkillsForTest(requiredSkills);
    expect(result.skillsLoaded.some(ref => ref.name === "azure-ai" && ref.pluginDirname === "azure-skills")).toBe(true);
    expect(result.skillsLoaded.some(ref => ref.name === "azure-prepare" && ref.pluginDirname === "azure-skills")).toBe(true);
  });

  test("respects includeSkills option", async () => {
    const requiredSkills: SkillRef[] = [{ pluginDirname: "azure-skills", name: "azure-ai" }];
    const includeSkills: SkillRef[] = [{ pluginDirname: "azure-skills", name: "azure-ai" }];
    const result = await getSkillsForTest(requiredSkills, includeSkills);
    expect(result.skillsLoaded.some(ref => ref.name === "azure-ai" && ref.pluginDirname === "azure-skills")).toBe(true);
    expect(result.skillsLoaded.some(ref => ref.name === "azure-prepare" && ref.pluginDirname === "azure-skills")).toBe(false);
  });
});