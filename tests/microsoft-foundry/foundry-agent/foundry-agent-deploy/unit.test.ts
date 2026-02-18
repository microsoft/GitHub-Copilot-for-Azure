/**
 * Unit Tests for foundry-agent-deploy
 *
 * Test isolated skill logic and validation rules.
 */

import { loadSkill, LoadedSkill } from "../../../utils/skill-loader";

const SKILL_NAME = "microsoft-foundry/foundry-agent/foundry-agent-deploy";

describe("deploy - Unit Tests", () => {
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
  });

  describe("Skill Metadata", () => {
    test("has valid SKILL.md with required fields", () => {
      expect(skill.metadata).toBeDefined();
      expect(skill.metadata.name).toBe("foundry-agent-deploy");
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
      expect(skill.content).toContain("## MCP Tools");
      expect(skill.content).toContain("## Error Handling");
    });

    test("contains both agent type workflows", () => {
      expect(skill.content).toContain("## Workflow: Hosted Agent Deployment");
      expect(skill.content).toContain("## Workflow: Prompt Agent Deployment");
    });

    test("references MCP tools", () => {
      expect(skill.content).toContain("agent_update");
      expect(skill.content).toContain("agent_container_control");
      expect(skill.content).toContain("agent_definition_schema_get");
    });

    test("documents agent definition schemas", () => {
      expect(skill.content).toContain("## Agent Definition Schemas");
      expect(skill.content).toContain("Prompt Agent");
      expect(skill.content).toContain("Hosted Agent");
    });
  });
});
