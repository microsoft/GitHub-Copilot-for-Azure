/**
 * Unit Tests for azure-deploy
 * 
 * Test isolated skill logic and validation rules.
 */

import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-deploy";

describe(`${SKILL_NAME} - Unit Tests`, () => {
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
  });

  describe("Skill Metadata", () => {
    test("has valid SKILL.md with required fields", () => {
      expect(skill.metadata).toBeDefined();
      expect(skill.metadata.name).toBe(SKILL_NAME);
      expect(skill.metadata.description).toBeDefined();
      expect(skill.metadata.description.length).toBeGreaterThan(10);
    });

    test("description meets Medium-High compliance length", () => {
      // Descriptions should be 150-1024 chars for Medium-High compliance
      expect(skill.metadata.description.length).toBeGreaterThan(150);
      expect(skill.metadata.description.length).toBeLessThanOrEqual(1024);
    });

    test("description contains WHEN trigger phrases", () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).toContain("when:");
    });
  });

  describe("Skill Content", () => {
    test("has substantive content", () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(100);
    });

    test("contains expected sections", () => {
      expect(skill.content).toContain("## Triggers");
      expect(skill.content).toContain("## Rules");
      expect(skill.content).toContain("## Steps");
      expect(skill.content).toContain("## MCP Tools");
    });

    test("requires azure-validate prerequisite", () => {
      expect(skill.content).toContain("azure-validate");
      expect(skill.content.toLowerCase()).toContain("prerequisite");
    });
  });

  describe("Deployment Workflow", () => {
    test("mentions plan file requirement", () => {
      expect(skill.content).toContain(".azure/plan.md");
    });

    test("references deployment recipes", () => {
      expect(skill.content).toContain("recipes/README.md");
    });

    test("includes verification step", () => {
      expect(skill.content.toLowerCase()).toContain("verify");
    });
  });
});
