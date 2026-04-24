/**
 * Unit Tests for azure-resource-visualizer
 * 
 * Test isolated skill logic and validation rules.
 */

import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-resource-visualizer";

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
      // Descriptions should be 50-1024 chars for readability
      expect(skill.metadata.description.length).toBeGreaterThan(50);
      expect(skill.metadata.description.length).toBeLessThan(1024);
    });

    test("description contains WHEN trigger phrases", () => {
      const description = skill.metadata.description;
      expect(description).toContain("WHEN:");
    });
  });

  describe("Skill Content", () => {
    test("has substantive content", () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(100);
    });

    test("contains expected sections", () => {
      expect(skill.content).toContain("## Workflow Process");
      expect(skill.content).toContain("mermaid-diagram-workflow");
      expect(skill.content).toContain("Resource Group Selection");
      expect(skill.content).toContain("Resource Discovery & Analysis");
      expect(skill.content).toContain("Diagram Construction");
    });

    test("includes Mermaid diagram references", () => {
      expect(skill.content).toContain("Mermaid");
      expect(skill.content).toContain("mermaid-diagram-workflow");
    });

    test("defines quality standards", () => {
      expect(skill.content).toContain("Quality Standards");
      expect(skill.content).toContain("Accuracy");
      expect(skill.content).toContain("Completeness");
    });
  });

  describe("Diagram Generation Guidelines", () => {
    test("provides diagram structure guidelines", () => {
      expect(skill.content).toContain("Key Diagram Requirements");
      expect(skill.content).toContain("subgraph");
      expect(skill.content).toContain("Resource Group");
    });

    test("includes relationship mapping guidance", () => {
      expect(skill.content).toContain("Map relationships");
      expect(skill.content).toContain("Network connections");
      expect(skill.content).toContain("Data flow");
    });
  });

  describe("Azure Resource Graph Integration", () => {
    test("links to Azure Resource Graph reference", () => {
      expect(skill.content).toContain("references/azure-resource-graph.md");
    });

    test("mentions Resource Graph for resource discovery", () => {
      expect(skill.content).toContain("Azure Resource Graph");
    });
  });

  describe("Draw.io Support", () => {
    test("description mentions Draw.io as supported output format", () => {
      expect(skill.metadata.description).toContain("Draw.io");
    });

    test("references drawio diagram workflow", () => {
      expect(skill.content).toContain("drawio-diagram-workflow.md");
    });

    test("references drawio diagram conventions", () => {
      expect(skill.content).toContain("drawio-diagram-conventions.md");
    });

    test("routes draw.io trigger phrases to drawio workflow", () => {
      expect(skill.content).toContain("draw.io");
      expect(skill.content).toContain("drawio");
    });

    test("description includes draw.io trigger phrases", () => {
      const description = skill.metadata.description;
      expect(description).toContain("draw.io diagram");
      expect(description).toContain("generate draw.io");
    });
  });
});
