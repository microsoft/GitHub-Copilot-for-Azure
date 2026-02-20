/**
 * Unit Tests for preset (deploy-model-optimal-region)
 * 
 * Test isolated skill logic and validation rules.
 */

import { loadSkill, LoadedSkill } from "../../../../utils/skill-loader";

const SKILL_NAME = "microsoft-foundry/models/deploy-model/preset";

describe("preset (deploy-model-optimal-region) - Unit Tests", () => {
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
  });

  describe("Skill Metadata", () => {
    test("has valid SKILL.md with required fields", () => {
      expect(skill.metadata).toBeDefined();
      expect(skill.metadata.name).toBe("preset");
      expect(skill.metadata.description).toBeDefined();
      expect(skill.metadata.description.length).toBeGreaterThan(10);
    });

    test("description is appropriately sized", () => {
      expect(skill.metadata.description.length).toBeGreaterThan(150);
      expect(skill.metadata.description.length).toBeLessThan(1024);
    });

    test("description contains USE FOR triggers", () => {
      expect(skill.metadata.description).toMatch(/USE FOR:/i);
    });

    test("description contains DO NOT USE FOR anti-triggers", () => {
      expect(skill.metadata.description).toMatch(/DO NOT USE FOR:/i);
    });
  });

  describe("Skill Content", () => {
    test("has substantive content", () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(100);
    });

    test("contains expected sections", () => {
      expect(skill.content).toContain("## What This Skill Does");
      expect(skill.content).toContain("## Prerequisites");
      expect(skill.content).toContain("## Quick Workflow");
    });

    test("contains deployment phases", () => {
      expect(skill.content).toContain("## Deployment Phases");
      expect(skill.content).toContain("Verify Auth");
      expect(skill.content).toContain("Get Project");
    });

    test("contains Azure CLI commands", () => {
      expect(skill.content).toContain("az cognitiveservices");
    });

    test("documents GlobalStandard SKU usage", () => {
      expect(skill.content).toContain("GlobalStandard");
    });

    test("contains error handling section", () => {
      expect(skill.content).toContain("## Error Handling");
    });
  });
});
