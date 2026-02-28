/**
 * Unit Tests for azure-cloud-migrate
 *
 * Test isolated skill logic and validation rules.
 */
 
import { loadSkill, LoadedSkill } from "../utils/skill-loader";
 
const SKILL_NAME = "azure-cloud-migrate";
 
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

    test("description does not use risky DO NOT USE FOR", () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).not.toContain("do not use for:");
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
      expect(skill.content).toContain("## Rules");
      expect(skill.content).toContain("## Steps");
      expect(skill.content).toContain("## Migration Scenarios");
      expect(skill.content).toContain("## Output Directory");
    });
 
    test("references azure-prepare for post-migration", () => {
      expect(skill.content).toContain("azure-prepare");
    });
  });
 
  describe("Migration Workflow", () => {
    test("mentions assessment phase", () => {
      expect(skill.content.toLowerCase()).toContain("assessment");
    });
 
    test("includes code migration guidance", () => {
      const content = skill.content.toLowerCase();
      expect(content).toContain("code migration");
    });
 
    test("references migration scenarios", () => {
      const content = skill.content.toLowerCase();
      const hasLambda = content.includes("lambda");
      const hasScenarios = content.includes("migration scenarios");
      expect(hasLambda || hasScenarios).toBe(true);
    });
 
    test("references workflow details", () => {
      expect(skill.content).toContain("workflow-details.md");
    });
  });
});