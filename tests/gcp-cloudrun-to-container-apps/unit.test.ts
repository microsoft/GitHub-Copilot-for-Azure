/**
 * Unit Tests for gcp-cloudrun-to-container-apps
 * 
 * Test isolated skill logic and validation rules.
 */

import { readFileSync } from "node:fs";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "gcp-cloudrun-to-container-apps";

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

    test("has MIT license", () => {
      expect(skill.metadata.license).toBe("MIT");
    });

    test("description contains migration-specific triggers", () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).toContain("cloud run");
      expect(description).toContain("container apps");
      expect(description).toContain("migrate");
    });

    test("description includes DO NOT USE FOR clause", () => {
      const description = skill.metadata.description;
      expect(description).toContain("DO NOT USE FOR");
      expect(description).toContain("azure-cloud-migrate");
      expect(description).toContain("azure-prepare");
    });
  });

  describe("Skill Content Structure", () => {
    test("has Quick Reference section", () => {
      expect(skill.content).toContain("## Quick Reference");
    });

    test("has When to Use This Skill section", () => {
      expect(skill.content).toContain("## When to Use This Skill");
    });

    test("has Rules section", () => {
      expect(skill.content).toContain("## Rules");
    });

    test("has Migration Workflow section", () => {
      expect(skill.content).toContain("## Migration Workflow");
    });

    test("has MCP Tools section", () => {
      expect(skill.content).toContain("## MCP Tools");
    });

    test("has Error Handling section", () => {
      expect(skill.content).toContain("## Error Handling");
    });

    test("references assessment guide", () => {
      expect(skill.content).toContain("assessment-guide.md");
    });

    test("references deployment guide", () => {
      expect(skill.content).toContain("deployment-guide.md");
    });
  });

  describe("Migration Workflow", () => {
    test("includes all required phases", () => {
      expect(skill.content).toContain("Phase 1: Assessment");
      expect(skill.content).toContain("Phase 2: Image Migration");
      expect(skill.content).toContain("Phase 3: Configuration");
      expect(skill.content).toContain("Phase 4: Deployment");
    });
  });

  describe("MCP Tools Documentation", () => {
    test("documents required MCP tools", () => {
      expect(skill.content).toContain("mcp_azure_mcp_documentation");
      expect(skill.content).toContain("mcp_azure_mcp_get_bestpractices");
    });

    test("includes tool parameters", () => {
      expect(skill.content).toContain("Parameters");
      expect(skill.content).toContain("Required");
    });
  });

  describe("Error Handling", () => {
    test("includes common error scenarios", () => {
      expect(skill.content).toContain("ACR auth");
      expect(skill.content).toContain("Key Vault access");
    });

    test("includes error messages and resolutions", () => {
      expect(skill.content).toContain("Resolution");
      expect(skill.content).toMatch(/unauthorized|forbidden/i);
    });
  });

  describe("Guardrails", () => {
    test("includes DO NOT USE FOR guidance", () => {
      const description = skill.metadata.description;
      expect(description).toMatch(/DO NOT USE FOR:/i);
      expect(description).toContain("azure-cloud-migrate");
      expect(description).toContain("azure-prepare");
    });
  });

  describe("Frontmatter Formatting", () => {
    test("frontmatter has no tabs", () => {
      const raw = readFileSync(skill.filePath, "utf-8");
      const frontmatter = raw.split("---")[1];
      expect(frontmatter).not.toMatch(/\t/);
    });

    test("WHEN clause is inside description", () => {
      const description = skill.metadata.description;
      expect(description).toContain("WHEN:");
    });
  });
});
