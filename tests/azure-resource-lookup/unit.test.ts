/**
 * Unit Tests for azure-resource-lookup
 * 
 * Test isolated skill logic and validation rules.
 */

import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-resource-lookup";

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

    test("description is concise and actionable", () => {
      expect(skill.metadata.description.length).toBeGreaterThan(150);
      expect(skill.metadata.description.length).toBeLessThan(1024);
    });

    test("description contains USE FOR trigger phrases", () => {
      const description = skill.metadata.description;
      expect(description).toContain("USE FOR:");
    });

    test("description contains DO NOT USE FOR anti-triggers", () => {
      const description = skill.metadata.description;
      expect(description).toContain("DO NOT USE FOR:");
    });

    test("description mentions cross-cutting resource queries", () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).toMatch(/across.*subscription/);
      expect(description).toMatch(/orphaned|unattached/);
      expect(description).toMatch(/tag/);
    });
  });

  describe("Skill Content", () => {
    test("has substantive content", () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(500);
    });

    test("contains required sections", () => {
      expect(skill.content).toContain("## When to Use This Skill");
      expect(skill.content).toContain("## Quick Reference");
      expect(skill.content).toContain("## MCP Tools");
      expect(skill.content).toContain("## Workflow");
      expect(skill.content).toContain("## Error Handling");
    });

    test("positions as resource lookup skill with MCP routing", () => {
      expect(skill.content).toMatch(/dedicated.*MCP tool/i);
      expect(skill.content).toContain("extension_cli_generate");
    });

    test("references Azure Resource Graph", () => {
      expect(skill.content).toContain("Azure Resource Graph");
      expect(skill.content).toContain("az graph query");
    });

    test("documents extension_cli_generate as primary tool", () => {
      expect(skill.content).toContain("extension_cli_generate");
    });

    test("links to ARG reference documentation", () => {
      expect(skill.content).toContain("references/azure-resource-graph.md");
    });
  });

  describe("Error Handling", () => {
    test("documents common errors", () => {
      expect(skill.content).toContain("resource-graph extension not found");
      expect(skill.content).toContain("AuthorizationFailed");
      expect(skill.content).toContain("BadRequest");
    });
  });

  describe("Constraints", () => {
    test("documents query best practices", () => {
      expect(skill.content).toContain("=~");
      expect(skill.content).toContain("case-insensitive");
    });
  });
});
