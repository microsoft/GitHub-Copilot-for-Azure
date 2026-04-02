/**
 * Unit Tests for spring-apps-to-aca
 * 
 * Test isolated skill logic and validation rules.
 */

import { readFileSync } from "node:fs";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "spring-apps-to-aca";

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
      expect(skill.metadata.description.length).toBeLessThan(500);
    });

    test("description contains WHEN clause", () => {
      const description = skill.metadata.description;
      expect(description).toContain("WHEN:");
    });

    test("has MIT license", () => {
      expect(skill.metadata.license).toBe("MIT");
    });

    test("has version in metadata", () => {
      expect(skill.metadata.metadata).toBeDefined();
      const metadata = skill.metadata.metadata as { version?: string };
      expect(metadata.version).toBeDefined();
    });

    test("has author in metadata", () => {
      const metadata = skill.metadata.metadata as { author?: string };
      expect(metadata.author).toBe("Microsoft");
    });
  });

  describe("Skill Content", () => {
    test("has substantive content", () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(100);
    });

    test("contains Quick Reference section", () => {
      expect(skill.content).toContain("## Quick Reference");
    });

    test("contains When to Use section", () => {
      expect(skill.content).toContain("## When to Use This Skill");
    });

    test("contains Migration Workflow section", () => {
      expect(skill.content).toContain("## Migration Workflow");
    });

    test("contains MCP Tools section", () => {
      expect(skill.content).toContain("## MCP Tools");
    });

    test("contains Error Handling section", () => {
      expect(skill.content).toContain("## Error Handling");
    });

    test("references assessment guide", () => {
      expect(skill.content).toContain("assessment-guide.md");
    });

    test("references deployment guide", () => {
      expect(skill.content).toContain("deployment-guide.md");
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
      const keys = frontmatter.split("\n")
        .filter((l: string) => /^[a-z][\w-]*\s*:/.test(l))
        .map((l: string) => l.split(":")[0].trim());
      for (const key of keys) {
        expect(supported).toContain(key);
      }
    });

    test("WHEN clause is inside description", () => {
      const description = skill.metadata.description;
      expect(description).toContain("WHEN:");
    });
  });

  describe("Migration Workflow", () => {
    test("includes assessment phase", () => {
      expect(skill.content.toLowerCase()).toContain("assess");
    });

    test("includes containerization phase", () => {
      expect(skill.content.toLowerCase()).toContain("containerize");
    });

    test("includes deployment phase", () => {
      expect(skill.content.toLowerCase()).toContain("deploy");
    });

    test("includes optimization phase", () => {
      expect(skill.content.toLowerCase()).toContain("optimize");
    });
  });

  describe("Security Guidance", () => {
    test("mentions Key Vault for secrets", () => {
      expect(skill.content).toContain("Key Vault");
    });

    test("warns against storing secrets in application.properties", () => {
      expect(skill.content.toLowerCase()).toContain("never store secrets");
    });
  });

  describe("Azure Container Apps Integration", () => {
    test("mentions Azure Container Apps", () => {
      expect(skill.content).toContain("Azure Container Apps");
    });

    test("mentions Azure Spring Apps migration source", () => {
      expect(skill.content).toContain("Azure Spring Apps");
    });

    test("mentions Container Registry (ACR)", () => {
      expect(skill.content.toLowerCase()).toContain("acr");
    });
  });

  describe("Spring Boot Specifics", () => {
    test("mentions Spring Boot", () => {
      expect(skill.content).toContain("Spring Boot");
    });

    test("mentions Spring Cloud components", () => {
      const content = skill.content.toLowerCase();
      const hasSpringCloud = 
        content.includes("spring cloud") ||
        content.includes("eureka") ||
        content.includes("config server") ||
        content.includes("gateway");
      expect(hasSpringCloud).toBe(true);
    });
  });
});
