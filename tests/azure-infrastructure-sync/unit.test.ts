/**
 * Unit Tests for azure-infrastructure-sync
 *
 * Validate the skill metadata and the core workflow documentation.
 */

import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-infrastructure-sync";

describe(`${SKILL_NAME} - Unit Tests`, () => {
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
  });

  describe("Skill Metadata", () => {
    test("has valid SKILL.md frontmatter", () => {
      expect(skill.metadata).toBeDefined();
      expect(skill.metadata.name).toBe(SKILL_NAME);
      expect(skill.metadata.description).toBeDefined();
      expect(skill.metadata.description.length).toBeGreaterThan(50);
      expect(skill.metadata.description.length).toBeLessThan(1024);
    });

    test("includes routing guidance in the description", () => {
      const description = skill.metadata.description;
      expect(description).toContain("WHEN:");
      expect(description).toContain("DO NOT USE FOR:");
    });
  });

  describe("Skill Content", () => {
    test("has substantive content", () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(200);
    });

    test("documents the core workflow sections", () => {
      expect(skill.content).toContain("## Prerequisites");
      expect(skill.content).toContain("## When to Use This Skill");
      expect(skill.content).toContain("## Routing");
      expect(skill.content).toContain("## Workflow References");
      expect(skill.content).toContain("## Drift Report Format");
      expect(skill.content).toContain("## Resolution Options");
      expect(skill.content).toContain("## Error Handling");
    });

    test("links all supported sync workflows", () => {
      expect(skill.content).toContain("references/diagram-azure-sync-workflow.md");
      expect(skill.content).toContain("references/diagram-azure-sync-deep-workflow.md");
      expect(skill.content).toContain("references/bicep-diagram-sync-workflow.md");
      expect(skill.content).toContain("references/bicep-whatif-workflow.md");
    });

    test("references shared comparison artifacts", () => {
      expect(skill.content).toContain("references/azure-resource-model.md");
      expect(skill.content).toContain("references/procedures/resource-matching.md");
    });

    test("shows the drift status examples", () => {
      expect(skill.content).toContain("✅ In Sync");
      expect(skill.content).toContain("⬜ Diagram Only");
      expect(skill.content).toContain("🔷 Azure Only");
    });
  });
});
