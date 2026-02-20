/**
 * Unit Tests for agent-framework
 * 
 * Test isolated skill logic and validation rules.
 */

import { loadSkill, LoadedSkill } from "../../../utils/skill-loader";

const SKILL_NAME = "microsoft-foundry/foundry-agent/create";

describe("create - Unit Tests", () => {
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
  });

  describe("Skill Metadata", () => {
    test("has valid SKILL.md with required fields", () => {
      expect(skill.metadata).toBeDefined();
      expect(skill.metadata.name).toBe("create");
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
      expect(skill.content).toContain("## Quick Reference");
      expect(skill.content).toContain("## When to Use This Skill");
      expect(skill.content).toContain("## Workflow");
    });

    test("documents sample download workflow", () => {
      expect(skill.content).toContain("microsoft-foundry/foundry-samples");
      expect(skill.content).toContain("Step 4: Download Sample Files");
    });

    test("supports multiple frameworks", () => {
      expect(skill.content).toContain("Agent Framework");
      expect(skill.content).toContain("LangGraph");
      expect(skill.content).toContain("Custom");
    });

    test("supports multiple languages", () => {
      expect(skill.content).toContain("Python");
      expect(skill.content).toContain("C#");
    });

    test("contains error handling section", () => {
      expect(skill.content).toContain("## Error Handling");
    });

    test("documents greenfield vs brownfield", () => {
      expect(skill.content).toContain("Greenfield");
      expect(skill.content).toContain("Brownfield");
    });
  });
});
