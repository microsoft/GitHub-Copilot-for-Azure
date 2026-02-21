/**
 * Unit Tests for agent-framework
 * 
 * Test isolated skill logic and validation rules.
 */

import { loadSkill, LoadedSkill } from "../../../../utils/skill-loader";

const SKILL_NAME = "microsoft-foundry/foundry-agent/create/agent-framework";

describe("agent-framework - Unit Tests", () => {
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
  });

  describe("Skill Metadata", () => {
    test("has valid SKILL.md with required fields", () => {
      expect(skill.metadata).toBeDefined();
      expect(skill.metadata.name).toBe("agent-framework");
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
      expect(skill.content).toContain("## Creation Workflow");
    });

    test("documents reference files", () => {
      expect(skill.content).toContain("agent-as-server.md");
      expect(skill.content).toContain("debug-setup.md");
      expect(skill.content).toContain("agent-samples.md");
    });

    test("contains error handling section", () => {
      expect(skill.content).toContain("## Error Handling");
    });

    test("references workflow patterns", () => {
      expect(skill.content).toContain("workflow-basics.md");
      expect(skill.content).toContain("workflow-agents.md");
      expect(skill.content).toContain("workflow-foundry.md");
    });

    test("documents MCP tools", () => {
      expect(skill.content).toContain("foundry_models_list");
      expect(skill.content).toContain("foundry_models_deployments_list");
      expect(skill.content).toContain("foundry_resource_get");
    });

    test("specifies SDK version pinning", () => {
      expect(skill.content).toContain("1.0.0b260107");
    });
  });
});
