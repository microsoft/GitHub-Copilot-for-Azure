/**
 * Unit Tests for foundry-agent-package
 *
 * Test isolated skill logic and validation rules.
 */

import { loadSkill, LoadedSkill } from "../../../utils/skill-loader";

const SKILL_NAME = "microsoft-foundry/foundry-agent/foundry-agent-package";

describe("package - Unit Tests", () => {
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
  });

  describe("Skill Metadata", () => {
    test("has valid SKILL.md with required fields", () => {
      expect(skill.metadata).toBeDefined();
      expect(skill.metadata.name).toBe("foundry-agent-package");
      expect(skill.metadata.description).toBeDefined();
      expect(skill.metadata.description.length).toBeGreaterThan(10);
    });

    test("description is appropriately sized", () => {
      expect(skill.metadata.description.length).toBeGreaterThan(150);
      expect(skill.metadata.description.length).toBeLessThan(1024);
    });

    test("description contains USE FOR triggers", () => {
      const description = skill.metadata.description;
      expect(description).toMatch(/USE FOR:/i);
    });

    test("description contains DO NOT USE FOR anti-triggers", () => {
      const description = skill.metadata.description;
      expect(description).toMatch(/DO NOT USE FOR:/i);
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
      expect(skill.content).toContain("## Supported Project Types");
      expect(skill.content).toContain("## Error Handling");
    });

    test("references containerization concepts", () => {
      expect(skill.content).toContain("Dockerfile");
      expect(skill.content).toContain("ACR");
      expect(skill.content).toContain("docker");
    });

    test("references Foundry Samples for examples", () => {
      expect(skill.content).toContain("azure-ai-foundry/foundry-samples");
    });
  });
});
