/**
 * Unit Tests for azure-prepare
 * 
 * Test isolated skill logic and validation rules.
 */

import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-prepare";

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

    test("description contains USE FOR trigger phrases", () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).toContain("use for:");
    });

    test("description contains DO NOT USE FOR anti-triggers", () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).toContain("do not use for:");
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
      expect(skill.content).toContain("## Phase 1: Planning");
      expect(skill.content).toContain("## Phase 2: Execution");
      expect(skill.content).toContain("## Recipes");
      expect(skill.content).toContain("## Outputs");
    });

    test("references azure-validate for next steps", () => {
      expect(skill.content).toContain("azure-validate");
    });
  });

  describe("Plan-First Workflow", () => {
    test("mentions plan file requirement", () => {
      expect(skill.content).toContain(".azure/plan.md");
    });

    test("requires user confirmation for subscription and location", () => {
      expect(skill.content.toLowerCase()).toContain("subscription");
      expect(skill.content.toLowerCase()).toContain("location");
    });

    test("has blocking plan requirement", () => {
      expect(skill.content).toContain("PLAN-FIRST");
      expect(skill.content).toContain("BLOCKING");
    });
  });
});
