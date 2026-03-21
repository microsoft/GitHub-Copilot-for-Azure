/**
 * Unit Tests for azure-upgrade
 *
 * Test isolated skill logic and validation rules.
 */

import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-upgrade";

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

    test("description meets Medium-High compliance length", () => {
      // Descriptions should be 150-1024 chars for Medium-High compliance
      expect(skill.metadata.description.length).toBeGreaterThan(150);
      expect(skill.metadata.description.length).toBeLessThanOrEqual(1024);
    });

    test("description contains WHEN trigger phrases", () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).toContain("when:");
    });

    test("description word count is within limit", () => {
      const words = skill.metadata.description.split(/\s+/).length;
      expect(words).toBeLessThanOrEqual(60);
    });
  });

  describe("Skill Content", () => {
    test("has substantive content", () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(100);
    });

    test("contains expected sections", () => {
      expect(skill.content).toContain("## Triggers");
      expect(skill.content).toContain("## Rules");
      expect(skill.content).toContain("## Steps");
      expect(skill.content).toContain("## Upgrade Scenarios");
      expect(skill.content).toContain("## MCP Tools");
    });

    test("references azure-validate for post-upgrade validation", () => {
      expect(skill.content).toContain("azure-validate");
    });

    test("references azure-deploy for CI/CD hand-off", () => {
      expect(skill.content).toContain("azure-deploy");
    });

    test("distinguishes from azure-cloud-migrate", () => {
      expect(skill.content).toContain("azure-cloud-migrate");
    });
  });

  describe("Upgrade Workflow", () => {
    test("mentions assessment phase", () => {
      expect(skill.content.toLowerCase()).toContain("assess");
    });

    test("includes identify phase", () => {
      expect(skill.content.toLowerCase()).toContain("identify");
    });

    test("includes pre-migrate phase", () => {
      expect(skill.content.toLowerCase()).toContain("pre-migrate");
    });

    test("includes validate phase", () => {
      expect(skill.content.toLowerCase()).toContain("validate");
    });

    test("tracks progress in upgrade-status.md", () => {
      expect(skill.content).toContain("upgrade-status.md");
    });

    test("references upgrade scenarios", () => {
      const content = skill.content.toLowerCase();
      const hasConsumptionToFlex = content.includes("consumption") && content.includes("flex");
      const hasScenarios = content.includes("upgrade scenarios");
      expect(hasConsumptionToFlex || hasScenarios).toBe(true);
    });

    test("references consumption-to-flex scenario", () => {
      expect(skill.content).toContain("consumption-to-flex.md");
    });

    test("references workflow details", () => {
      expect(skill.content).toContain("workflow-details.md");
    });

    test("references global rules", () => {
      expect(skill.content).toContain("global-rules.md");
    });
  });

  describe("Safety and Confirmation", () => {
    test("requires user confirmation for destructive actions", () => {
      const content = skill.content.toLowerCase();
      expect(content).toContain("confirm");
    });

    test("requires idempotent and resumable scripts", () => {
      const content = skill.content.toLowerCase();
      expect(content).toContain("idempotent");
    });

    test("prohibits deleting original app without confirmation", () => {
      const content = skill.content.toLowerCase();
      const hasDeleteProtection = content.includes("never delete") || content.includes("explicit user confirmation");
      expect(hasDeleteProtection).toBe(true);
    });
  });
});
