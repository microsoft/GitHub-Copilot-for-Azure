/**
 * Tests for char-budget helpers used for enforcing required skills.
 */

import { jest } from "@jest/globals";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
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
  afterEach(() => {
    delete process.env.VALLY_PLUGIN_OUTPUT_ROOT;
  });

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

  test("loads skills from an overridden plugin output root", async () => {
    const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), "skill-output-"));
    const skillDirectory = path.join(outputRoot, "example-plugin", "skills", "example-skill");
    fs.mkdirSync(skillDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(skillDirectory, "SKILL.md"),
      "---\nname: example-skill\ndescription: Example\n---\n\nCandidate content.\n",
      "utf8"
    );
    process.env.VALLY_PLUGIN_OUTPUT_ROOT = outputRoot;

    const skill = await loadSkill({
      pluginDirname: "example-plugin",
      name: "example-skill",
    });

    expect(skill.content).toBe("Candidate content.");
    expect(skill.path).toBe(skillDirectory);
  });
});