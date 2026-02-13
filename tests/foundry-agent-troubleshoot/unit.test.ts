/**
 * Unit Tests for foundry-agent-troubleshoot
 *
 * Test isolated skill logic and validation rules.
 */

import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "microsoft-foundry/agent/troubleshoot";

describe(`troubleshoot - Unit Tests`, () => {
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
  });

  describe("Skill Metadata", () => {
    test("has valid SKILL.md with required fields", () => {
      expect(skill.metadata).toBeDefined();
      expect(skill.metadata.name).toBe("troubleshoot");
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
      expect(skill.content).toContain("## Workflow");
      expect(skill.content).toContain("## Error Handling");
    });

    test("references container logs documentation", () => {
      expect(skill.content).toContain("az cognitiveservices agent logs");
    });

    test("references account connection documentation", () => {
      expect(skill.content).toContain("az cognitiveservices account connection");
    });

    test("references azure-kusto skill for telemetry", () => {
      expect(skill.content).toContain("azure-kusto");
    });

    test("documents both agent types", () => {
      expect(skill.content).toContain("hosted");
      expect(skill.content).toContain("prompt");
    });

    test("references Application Insights", () => {
      expect(skill.content).toContain("Application Insights");
    });
  });
});
