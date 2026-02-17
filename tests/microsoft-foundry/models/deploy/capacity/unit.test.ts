/**
 * Unit Tests for capacity discovery
 * 
 * Test isolated skill logic and validation rules.
 */

import { loadSkill, LoadedSkill } from "../../../../utils/skill-loader";

const SKILL_NAME = "microsoft-foundry/models/deploy-model/capacity";

describe("capacity - Unit Tests", () => {
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
  });

  describe("Skill Metadata", () => {
    test("has valid SKILL.md with required fields", () => {
      expect(skill.metadata).toBeDefined();
      expect(skill.metadata.name).toBe("capacity");
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

    test("documents discovery scripts", () => {
      expect(skill.content).toContain("discover_and_rank");
      expect(skill.content).toContain("query_capacity");
    });

    test("contains error handling section", () => {
      expect(skill.content).toContain("## Error Handling");
    });

    test("references hand-off to preset and customize", () => {
      expect(skill.content).toContain("preset");
      expect(skill.content).toContain("customize");
    });

    test("is read-only — does not deploy", () => {
      expect(skill.content).toContain("does NOT deploy");
    });
  });
});
