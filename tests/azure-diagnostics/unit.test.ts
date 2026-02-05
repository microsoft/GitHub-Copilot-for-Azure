/**
 * Unit Tests for azure-diagnostics
 * 
 * Test isolated skill logic and validation rules.
 */

import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-diagnostics";

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

    test("description is comprehensive and actionable", () => {
      // Descriptions should be 150-1024 chars for optimal triggering
      expect(skill.metadata.description.length).toBeGreaterThan(150);
      expect(skill.metadata.description.length).toBeLessThan(1024);
    });

    test("description contains USE FOR trigger phrases", () => {
      const description = skill.metadata.description;
      expect(description).toContain("USE FOR:");
    });

    test("description contains DO NOT USE FOR anti-triggers", () => {
      const description = skill.metadata.description;
      expect(description).toContain("DO NOT USE FOR:");
    });

    test("has diagnostic-specific trigger keywords", () => {
      const description = skill.metadata.description.toLowerCase();
      const hasDiagnosticKeywords = 
        description.includes("debug") ||
        description.includes("troubleshoot") ||
        description.includes("diagnose") ||
        description.includes("fix") ||
        description.includes("investigate");
      expect(hasDiagnosticKeywords).toBe(true);
    });
  });

  describe("Skill Content", () => {
    test("has substantive content", () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(500);
    });

    test("contains diagnostic workflow sections", () => {
      expect(skill.content).toContain("Quick Diagnosis Flow");
      expect(skill.content).toContain("Troubleshooting");
    });

    test("includes AppLens MCP tool references", () => {
      expect(skill.content).toContain("mcp_azure_mcp_applens");
    });

    test("includes Azure Monitor tool references", () => {
      expect(skill.content).toContain("mcp_azure_mcp_monitor");
    });

    test("includes Resource Health tool references", () => {
      expect(skill.content).toContain("mcp_azure_mcp_resourcehealth");
    });

    test("provides diagnostic commands for Container Apps", () => {
      expect(skill.content).toContain("containerapp logs");
    });

    test("references KQL query documentation", () => {
      expect(skill.content).toContain("kql-queries.md");
    });
  });

  describe("Skill Structure", () => {
    test("follows authoritative guidance pattern", () => {
      expect(skill.content).toContain("AUTHORITATIVE GUIDANCE");
    });

    test("has systematic diagnosis approach", () => {
      expect(skill.content).toContain("Identify symptoms");
      expect(skill.content).toContain("Check resource health");
      expect(skill.content).toContain("Review logs");
    });
  });
});
