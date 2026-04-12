/**
 * Unit Tests for azure-iac-generator
 * 
 * Tests for IaC generation skill (Azure/Diagram → Bicep).
 */

import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-iac-generator";

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
      expect(skill.metadata.description.length).toBeGreaterThan(50);
      expect(skill.metadata.description.length).toBeLessThan(1024);
    });

    test("description contains WHEN trigger phrases", () => {
      const description = skill.metadata.description;
      expect(description).toContain("WHEN:");
    });

    test("description contains DO NOT USE FOR disambiguation", () => {
      const description = skill.metadata.description;
      expect(description).toContain("DO NOT USE FOR:");
    });
  });

  describe("Skill Content", () => {
    test("has substantive content", () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(200);
    });

    test("contains required sections", () => {
      expect(skill.content).toContain("## Prerequisites");
      expect(skill.content).toContain("## When to Use This Skill");
      expect(skill.content).toContain("## Routing");
      expect(skill.content).toContain("## Output Structure");
      expect(skill.content).toContain("## Error Handling");
    });

    test("documents both source paths", () => {
      expect(skill.content).toContain("azure-to-bicep-workflow.md");
      expect(skill.content).toContain("diagram-to-bicep-workflow.md");
    });

    test("references Bicep best practices", () => {
      expect(skill.content).toContain("bicep-best-practices.md");
    });

    test("references deployment verification", () => {
      expect(skill.content).toContain("azure-deployment-verification.md");
    });

    test("documents modular output structure", () => {
      expect(skill.content).toContain("main.bicep");
      expect(skill.content).toContain("main.bicepparam");
      expect(skill.content).toContain("modules/");
    });
  });

  describe("Routing Logic", () => {
    test("routes Azure source to azure-to-bicep workflow", () => {
      expect(skill.content).toMatch(/azure.*bicep.*workflow/i);
    });

    test("routes diagram source to diagram-to-bicep workflow", () => {
      expect(skill.content).toMatch(/diagram.*bicep.*workflow/i);
    });
  });
});
