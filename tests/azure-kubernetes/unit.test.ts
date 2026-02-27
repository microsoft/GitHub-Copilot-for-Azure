/**
 * Unit Tests for azure-kubernetes
 *
 * Test isolated skill logic and validation rules.
 */

import { readFileSync } from "node:fs";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-kubernetes";

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

    test("description contains USE FOR trigger phrases", () => {
      const description = skill.metadata.description;
      expect(description).toContain("USE FOR:");
    });

    test("description contains DO NOT USE FOR anti-triggers", () => {
      const description = skill.metadata.description;
      expect(description).toContain("DO NOT USE FOR:");
    });

    test("has AKS-specific trigger keywords", () => {
      const description = skill.metadata.description.toLowerCase();
      const hasAKSKeywords =
        description.includes("aks") ||
        description.includes("kubernetes") ||
        description.includes("cluster");
      expect(hasAKSKeywords).toBe(true);
    });
  });

  describe("Skill Content", () => {
    test("has substantive content", () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(500);
    });

    test("contains expected sections", () => {
      expect(skill.content).toContain("## Triggers");
      expect(skill.content).toContain("## When to Use");
      expect(skill.content).toContain("## Decision Framework");
      expect(skill.content).toContain("## Step-by-Step Execution");
    });

    test("covers AKS cluster configuration topics", () => {
      const content = skill.content.toLowerCase();
      expect(content).toContain("networking");
      expect(content).toContain("identity");
      expect(content).toContain("observability");
    });

    test("references AKS documentation", () => {
      expect(skill.content).toContain("learn.microsoft.com");
    });

    test("covers Day-0 and Day-1 planning", () => {
      expect(skill.content).toContain("Day-0");
      expect(skill.content).toContain("Day-1");
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
      const supported = [
        "name",
        "description",
        "compatibility",
        "license",
        "metadata",
        "argument-hint",
        "disable-model-invocation",
        "user-invokable",
      ];
      const keys = frontmatter
        .split("\n")
        .filter((l: string) => /^[a-z][\w-]*\s*:/.test(l))
        .map((l: string) => l.split(":")[0].trim());
      for (const key of keys) {
        expect(supported).toContain(key);
      }
    });

    test("USE FOR and DO NOT USE FOR are inside description value, not separate keys", () => {
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
