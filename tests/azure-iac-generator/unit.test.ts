/**
 * Unit Tests for azure-iac-generator
 *
 * Test isolated skill logic and validation rules.
 */

import { readFileSync } from "node:fs";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-iac-generator";

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
      const description = skill.metadata.description;
      expect(description).toContain("WHEN:");
    });

    test("description contains DO NOT USE FOR boundary phrases", () => {
      const description = skill.metadata.description;
      expect(description).toContain("DO NOT USE FOR:");
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
        "name", "description", "compatibility", "license", "metadata",
        "argument-hint", "disable-model-invocation", "user-invokable"
      ];
      const keys = frontmatter.split("\n")
        .filter((l: string) => /^[a-z][\w-]*\s*:/.test(l))
        .map((l: string) => l.split(":")[0].trim());
      for (const key of keys) {
        expect(supported).toContain(key);
      }
    });
  });

  describe("Skill Content", () => {
    test("has substantive content", () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(100);
    });

    test("contains Prerequisites section", () => {
      expect(skill.content).toContain("## Prerequisites");
    });

    test("contains Quick Reference section with MCP tools", () => {
      expect(skill.content).toContain("## Quick Reference");
      expect(skill.content).toContain("MCP tools");
    });

    test("contains Error Handling section", () => {
      expect(skill.content).toContain("## Error Handling");
    });
  });

  describe("Output Structure", () => {
    test("documents the expected output folder layout", () => {
      expect(skill.content).toContain("main.bicep");
      expect(skill.content).toContain("main.bicepparam");
      expect(skill.content).toContain("modules/");
      expect(skill.content).toContain("dependencies/");
      expect(skill.content).toContain("README.md");
    });

    test("lists all expected module files", () => {
      expect(skill.content).toContain("networking.bicep");
      expect(skill.content).toContain("compute.bicep");
      expect(skill.content).toContain("data.bicep");
      expect(skill.content).toContain("identity.bicep");
      expect(skill.content).toContain("monitoring.bicep");
    });

    test("warns against flat single-file output", () => {
      // The skill must explicitly forbid a single flat main.bicep
      expect(skill.content).toContain("NEVER generate a single flat");
    });
  });

  describe("Routing", () => {
    test("contains a routing section", () => {
      expect(skill.content).toContain("## Routing");
    });

    test("routes live-Azure requests to azure-to-bicep-workflow", () => {
      expect(skill.content).toContain("azure-to-bicep-workflow.md");
    });

    test("routes diagram requests to diagram-to-bicep-workflow", () => {
      expect(skill.content).toContain("diagram-to-bicep-workflow.md");
    });

    test("identifies live-Azure trigger keywords in routing", () => {
      const content = skill.content.toLowerCase();
      // The routing section should mention resource group or subscription
      expect(content).toMatch(/resource group|subscription/);
    });

    test("identifies diagram trigger keywords in routing", () => {
      const content = skill.content.toLowerCase();
      expect(content).toMatch(/draw\.io|\.drawio|diagram/);
    });
  });

  describe("Mandatory References", () => {
    test("references bicep-best-practices.md", () => {
      expect(skill.content).toContain("bicep-best-practices.md");
    });

    test("references azure-resource-configs.md", () => {
      expect(skill.content).toContain("azure-resource-configs.md");
    });

    test("references azure-deployment-verification.md", () => {
      expect(skill.content).toContain("azure-deployment-verification.md");
    });

    test("references version-currency.md", () => {
      expect(skill.content).toContain("version-currency.md");
    });

    test("references bicep-parsing.md", () => {
      expect(skill.content).toContain("bicep-parsing.md");
    });
  });

  describe("MCP Tool References", () => {
    test("mentions Azure MCP tools for resource discovery", () => {
      expect(skill.content).toContain("group_resource_list");
    });

    test("mentions Bicep MCP tools for schema and best practices", () => {
      expect(skill.content).toContain("get_bicep_best_practices");
      expect(skill.content).toContain("get_az_resource_type_schema");
    });
  });

  describe("Security Requirements", () => {
    test("addresses secrets handling with @secure()", () => {
      expect(skill.content).toContain("@secure()");
    });

    test("references readEnvironmentVariable for secrets in params", () => {
      expect(skill.content).toContain("readEnvironmentVariable()");
    });
  });
});
