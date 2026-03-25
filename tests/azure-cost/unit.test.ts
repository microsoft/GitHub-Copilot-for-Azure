/**
 * Generic Unit Tests for azure-cost
 *
 * Shared skill structure, metadata, and content validation.
 * Sub-area-specific tests live in cost-query-unit, cost-forecast-unit,
 * and cost-optimization-unit test files.
 */

import { readFileSync } from "node:fs";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-cost";

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
      expect(skill.metadata.description.length).toBeLessThan(1000);
    });
  });

  describe("Skill Content Structure", () => {
    test("has substantive content", () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(1000);
    });

    test("contains Quick Reference section", () => {
      expect(skill.content).toMatch(/## Quick Reference/i);
    });

    test("contains When to Use This Skill section", () => {
      expect(skill.content).toMatch(/## When to Use This Skill/i);
    });

    test("contains MCP Tools section", () => {
      expect(skill.content).toMatch(/## MCP Tools/i);
    });

    test("contains Error Handling section", () => {
      expect(skill.content).toMatch(/## Error Handling/i);
    });

    test("contains Guardrails section", () => {
      expect(skill.content).toMatch(/Guardrails/i);
    });

    test("contains Best Practices section", () => {
      expect(skill.content).toMatch(/## Best Practices/i);
    });

    test("contains Safety Requirements section", () => {
      expect(skill.content).toMatch(/## Safety Requirements/i);
    });

    test("contains Common Pitfalls section", () => {
      expect(skill.content).toMatch(/## Common Pitfalls/i);
      expect(skill.content).toContain("free tier");
    });
  });

  describe("MCP Tool References", () => {
    test("references azure__documentation tool", () => {
      expect(skill.content).toContain("azure__documentation");
    });

    test("references azure__extension_cli_generate tool", () => {
      expect(skill.content).toContain("azure__extension_cli_generate");
    });

    test("references azure__get_azure_bestpractices tool", () => {
      expect(skill.content).toContain("azure__get_azure_bestpractices");
    });
  });

  describe("Scope Reference", () => {
    test("references scopes", () => {
      const content = skill.content.toLowerCase();
      expect(content).toMatch(/subscription/);
      expect(content).toMatch(/resource group/);
      expect(content).toMatch(/billing account/);
    });
  });

  describe("Data Classification", () => {
    test("includes data classification guidance", () => {
      expect(skill.content).toContain("ACTUAL DATA");
      expect(skill.content).toContain("ESTIMATED");
      expect(skill.content).toContain("VALIDATED");
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
});
