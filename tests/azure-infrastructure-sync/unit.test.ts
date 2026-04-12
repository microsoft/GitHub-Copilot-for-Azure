/**
 * Unit Tests for azure-infrastructure-sync
 * 
 * Tests for infrastructure drift detection and sync skill.
 */

import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-infrastructure-sync";

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
      expect(skill.content).toContain("## Drift Report Format");
      expect(skill.content).toContain("## Resolution Options");
      expect(skill.content).toContain("## Error Handling");
    });

    test("documents all four sync modes", () => {
      expect(skill.content).toContain("diagram-azure-sync-workflow.md");
      expect(skill.content).toContain("diagram-azure-sync-deep-workflow.md");
      expect(skill.content).toContain("bicep-diagram-sync-workflow.md");
      expect(skill.content).toContain("bicep-whatif-workflow.md");
    });

    test("references resource matching algorithm", () => {
      expect(skill.content).toContain("resource-matching.md");
    });

    test("shows drift report format with status indicators", () => {
      expect(skill.content).toContain("✅ In Sync");
      expect(skill.content).toContain("⬜ Diagram Only");
      expect(skill.content).toContain("🔷 Azure Only");
    });
  });

  describe("Routing Logic", () => {
    test("routes diagram-azure comparison", () => {
      expect(skill.content).toMatch(/diagram.*azure/i);
    });

    test("routes bicep-diagram comparison", () => {
      expect(skill.content).toMatch(/bicep.*diagram/i);
    });

    test("routes bicep-azure what-if", () => {
      expect(skill.content).toMatch(/bicep.*what-if/i);
    });

    test("distinguishes quick and deep modes", () => {
      expect(skill.content).toContain("Quick mode");
      expect(skill.content).toContain("Deep mode");
    });
  });
});
