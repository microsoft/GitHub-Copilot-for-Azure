/**
 * Unit Tests for {SKILL_NAME}
 * 
 * Test isolated skill logic and validation rules.
 * Copy this file to /tests/{skill-name}/unit.test.ts
 */

import { readFileSync } from "node:fs";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

// Replace with your skill name
const SKILL_NAME = "your-skill-name";

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
      // Descriptions should be 50-500 chars for readability
      expect(skill.metadata.description.length).toBeGreaterThan(50);
      expect(skill.metadata.description.length).toBeLessThan(500);
    });

    test("description contains trigger phrases", () => {
      // Descriptions should contain keywords that help with skill activation
      const description = skill.metadata.description.toLowerCase();
      const hasTriggerPhrases =
        description.includes("use this") ||
        description.includes("use when") ||
        description.includes("helps") ||
        description.includes("activate") ||
        description.includes("trigger");
      expect(hasTriggerPhrases).toBe(true);
    });
  });

  describe("Skill Content", () => {
    test("has substantive content", () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(100);
    });
  });

  describe("Frontmatter Formatting", () => {
    test("frontmatter has no tabs", () => {
      const raw = readFileSync(skill.filePath, "utf-8");
      const frontmatter = raw.split("---")[1];
      expect(frontmatter).not.toMatch(/\t/);
    });

    test("frontmatter keys are only supported attributes", () => {
      const raw = readFileSync(skill.filePath, "utf-8");
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
      if (description.includes("USE FOR")) {
        expect(description).toContain("USE FOR:");
      }
      if (description.includes("DO NOT USE FOR")) {
        expect(description).toContain("DO NOT USE FOR:");
      }
    });
  });
});
