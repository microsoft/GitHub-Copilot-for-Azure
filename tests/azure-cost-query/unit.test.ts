/**
 * Unit Tests for azure-cost-query
 *
 * Tests isolated skill logic and validation rules.
 */

import { readFileSync } from "node:fs";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-cost-query";

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

    test("description contains cost-query-related keywords", () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).toMatch(/cost|query|spend|breakdown|actual|amortized/);
    });

    test("description mentions key use cases", () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).toContain("when:");
      expect(description).toMatch(/query|breakdown|spending/);
    });

    test("description clarifies what NOT to use it for", () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).toMatch(/do not\s+use for/);
      expect(description).toMatch(/forecasting.*azure-cost-forecast|optimization.*azure-cost-optimization/);
    });
  });

  describe("Skill Content", () => {
    test("has substantive content", () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(100);
    });

    test("contains Quick Reference section", () => {
      expect(skill.content).toMatch(/## Quick Reference/i);
    });

    test("contains When to Use section", () => {
      expect(skill.content).toMatch(/## When to Use/i);
    });

    test("contains MCP Tools section", () => {
      expect(skill.content).toMatch(/## MCP Tools/i);
    });

    test("contains Workflow section", () => {
      expect(skill.content).toMatch(/## Workflow/i);
    });

    test("contains Error Handling section", () => {
      expect(skill.content).toMatch(/## Error Handling/i);
    });

    test("contains Guardrails section", () => {
      expect(skill.content).toMatch(/Guardrails/i);
    });

    test("references MCP tools", () => {
      expect(skill.content).toContain("azure__documentation");
      expect(skill.content).toContain("azure__extension_cli_generate");
      expect(skill.content).toContain("azure__get_azure_bestpractices");
    });

    test("references Cost Management API endpoint", () => {
      expect(skill.content).toMatch(/Microsoft\.CostManagement\/query/);
    });

    test("mentions key guardrails", () => {
      const content = skill.content.toLowerCase();
      expect(content).toMatch(/granularity/);
      expect(content).toMatch(/date range/);
      expect(content).toMatch(/groupby/i);
    });

    test("references scopes", () => {
      const content = skill.content.toLowerCase();
      expect(content).toMatch(/subscription/);
      expect(content).toMatch(/resource group/);
      expect(content).toMatch(/billing account/);
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
