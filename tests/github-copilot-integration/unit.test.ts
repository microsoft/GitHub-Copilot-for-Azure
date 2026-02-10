/**
 * Unit Tests for github-copilot-integration
 * 
 * Test isolated skill logic and validation rules.
 */

import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "github-copilot-integration";

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

    test("description is detailed with triggers", () => {
      expect(skill.metadata.description.length).toBeGreaterThan(150);
      expect(skill.metadata.description.length).toBeLessThan(1024);
    });

    test("description contains USE FOR triggers", () => {
      const description = skill.metadata.description;
      expect(description).toContain("USE FOR:");
    });

    test("description contains DO NOT USE FOR anti-triggers", () => {
      const description = skill.metadata.description;
      expect(description).toContain("DO NOT USE FOR:");
    });
  });

  describe("Skill Content", () => {
    test("has substantive content", () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(100);
    });

    test("documents SDK scaffold workflow", () => {
      expect(skill.content).toContain("@github/copilot-sdk");
      expect(skill.content).toContain("Copilot SDK reference");
    });

    test("documents Extensions scaffold workflow", () => {
      expect(skill.content).toContain("preview-sdk");
      expect(skill.content).toContain("Extensions reference");
    });

    test("documents Azure hosting options", () => {
      expect(skill.content).toContain("Container Apps");
    });

    test("references azure-prepare and azure-deploy skills", () => {
      expect(skill.content).toContain("azure-prepare");
      expect(skill.content).toContain("azure-deploy");
    });
  });

  describe("Frontmatter Formatting", () => {
    test("frontmatter has no tabs", () => {
      const raw = require("fs").readFileSync(skill.filePath, "utf-8");
      const frontmatter = raw.split("---")[1];
      expect(frontmatter).not.toMatch(/\t/);
    });

    test("frontmatter keys are only supported attributes", () => {
      const raw = require("fs").readFileSync(skill.filePath, "utf-8");
      const frontmatter = raw.split("---")[1];
      const supported = ["name", "description", "compatibility", "license", "metadata",
        "argument-hint", "disable-model-invocation", "user-invokable"];
      // Extract top-level keys (lines starting with a word followed by colon)
      const keys = frontmatter.split("\n")
        .filter((l: string) => /^[a-z][\w-]*\s*:/.test(l))
        .map((l: string) => l.split(":")[0].trim());
      for (const key of keys) {
        expect(supported).toContain(key);
      }
    });

    test("USE FOR and DO NOT USE FOR are inside description value, not separate keys", () => {
      // These must be embedded in the description string, not parsed as YAML keys
      const description = skill.metadata.description;
      expect(description).toContain("USE FOR:");
      expect(description).toContain("DO NOT USE FOR:");
    });
  });
});
