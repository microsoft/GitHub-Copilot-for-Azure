/**
 * Unit Tests for k8s-to-container-apps
 * 
 * Test isolated skill logic and validation rules.
 */

import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "k8s-to-container-apps";

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

    test("has correct version and author", () => {
      expect(skill.metadata).toHaveProperty("metadata");
      const metadata = skill.metadata.metadata as { version?: string; author?: string };
      expect(metadata.version).toBe("1.0.0");
      expect(metadata.author).toBe("Microsoft");
    });

    test("has MIT license", () => {
      expect(skill.metadata.license).toBe("MIT");
    });

    test("description contains migration-specific triggers", () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).toContain("migrate");
      expect(description).toContain("kubernetes");
      expect(description).toContain("container apps");
    });

    test("description includes DO NOT USE FOR clause", () => {
      const description = skill.metadata.description;
      expect(description).toMatch(/DO NOT USE FOR/i);
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
      const content = skill.content;
      expect(content).toContain("Export Kubernetes Resources");
      expect(content).toContain("Assess Compatibility");
      expect(content).toContain("Migrate Container Images");
      expect(content).toContain("Infrastructure as Code");
      expect(content).toContain("Deploy and Verify");
    });

    test("includes testing and validation phase", () => {
      const content = skill.content;
      expect(content).toContain("Testing and Validation");
    });
  });

  describe("MCP Tools Documentation", () => {
    test("documents required MCP tools", () => {
      const content = skill.content;
      expect(content).toContain("mcp_azure_mcp_documentation");
      expect(content).toContain("mcp_azure_mcp_get_bestpractices");
    });

    test("includes tool parameters", () => {
      const content = skill.content;
      expect(content).toContain("Required/Optional");
    });
  });

  describe("Error Handling", () => {
    test("includes common error scenarios", () => {
      const content = skill.content;
      expect(content).toContain("Image pull");
      expect(content).toContain("Port mismatch");
      expect(content).toContain("OOM");
      expect(content).toContain("Key Vault");
    });

    test("includes error messages and resolutions", () => {
      const content = skill.content;
      expect(content).toContain("Message/Pattern");
      expect(content).toContain("Resolution");
    });
  });

  describe("Guardrails", () => {
    test("includes DO NOT USE FOR guidance", () => {
      const content = skill.content;
      expect(content).toMatch(/DO NOT use for/i);
      expect(content).toContain("azure-prepare");
      expect(content).toContain("azure-kubernetes");
      expect(content).toContain("azure-cloud-migrate");
    });
  });
});
