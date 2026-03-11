/**
 * Unit Tests for azure-cost-forecast
 *
 * Tests isolated skill logic and validation rules.
 */

import { readFileSync } from "node:fs";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-cost-forecast";

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

    test("description contains trigger phrases", () => {
      const description = skill.metadata.description.toLowerCase();
      const hasTriggerPhrases =
        description.includes("use this") ||
        description.includes("use when") ||
        description.includes("helps") ||
        description.includes("activate") ||
        description.includes("trigger");
      expect(hasTriggerPhrases).toBe(true);
    });

    test("description contains forecast-related keywords", () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).toMatch(/forecast|predict|project|estimate|future/);
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

  describe("Forecast API References", () => {
    test("references forecast API endpoint or resource type", () => {
      expect(skill.content).toMatch(/Microsoft\.CostManagement\/forecast|forecast\s+API/i);
    });
  });

  describe("Forecast Guardrails", () => {
    test("mentions to-date must be in the future", () => {
      const content = skill.content.toLowerCase();
      expect(content).toMatch(/future|must be in the future/);
    });

    test("mentions grouping not supported", () => {
      const content = skill.content.toLowerCase();
      expect(content).toContain("grouping");
      expect(content).toMatch(/not supported/);
    });

    test("mentions includeActualCost field", () => {
      expect(skill.content).toContain("includeActualCost");
    });

    test("mentions minimum training data requirement", () => {
      const content = skill.content.toLowerCase();
      expect(content).toMatch(/training data|28 days/);
    });
  });

  describe("Response Type References", () => {
    test("references CostStatus or response types", () => {
      expect(skill.content).toMatch(/CostStatus|("Actual".*"Forecast"|Actual.*Forecast)/);
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
