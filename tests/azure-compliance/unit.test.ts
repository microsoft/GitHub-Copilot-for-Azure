/**
 * Unit Tests for azure-compliance
 * 
 * Test isolated skill logic and validation rules.
 */

import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-compliance";

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
      expect(skill.metadata.description.length).toBeLessThan(1025);
    });

    test("description contains trigger phrases", () => {
      const description = skill.metadata.description.toLowerCase();
      const hasTriggerPhrases = 
        description.includes("use for") ||
        description.includes("use when") ||
        description.includes("helps") ||
        description.includes("activate") ||
        description.includes("trigger");
      expect(hasTriggerPhrases).toBe(true);
    });

    test("description contains anti-trigger phrases", () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).toContain("do not use for");
    });
  });

  describe("Skill Content", () => {
    test("has substantive content", () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(100);
    });

    test("contains comprehensive compliance assessment sections", () => {
      expect(skill.content).toContain("Assessment Workflow");
      expect(skill.content.toLowerCase()).toContain("azqr");
    });

    test("contains Key Vault expiration audit sections", () => {
      expect(skill.content).toContain("Key Vault");
      expect(skill.content.toLowerCase()).toContain("expir");
    });

    test("includes skill activation triggers section", () => {
      expect(skill.content).toContain("Skill Activation Triggers");
    });

    test("describes both primary capabilities", () => {
      expect(skill.content).toContain("Comprehensive Resources Assessment");
      expect(skill.content).toContain("Key Vault Expiration Monitoring");
    });
  });

  describe("Compliance Assessment Features", () => {
    test("mentions azqr tool usage", () => {
      expect(skill.content).toContain("mcp_azure_mcp_extension_azqr");
    });

    test("includes scan scope options", () => {
      const content = skill.content.toLowerCase();
      expect(content).toMatch(/subscription|resource group|management group/);
    });

    test("describes result analysis", () => {
      expect(skill.content).toContain("Analyze Scan Results");
      expect(skill.content.toLowerCase()).toMatch(/recommendations|findings/);
    });

    test("includes remediation guidance", () => {
      expect(skill.content.toLowerCase()).toMatch(/remediation|fix|resolution/);
    });
  });

  describe("Key Vault Expiration Features", () => {
    test("mentions all three resource types", () => {
      expect(skill.content).toContain("keys");
      expect(skill.content).toContain("secrets");
      expect(skill.content).toContain("certificates");
    });

    test("mentions expiration date checking", () => {
      expect(skill.content.toLowerCase()).toMatch(/expiresOn|expiration.*date/);
    });

    test("mentions resources without expiration", () => {
      const content = skill.content.toLowerCase();
      expect(content).toMatch(/no expiration|without expiration|missing expiration/);
    });

    test("includes priority classification", () => {
      expect(skill.content).toContain("Critical");
      expect(skill.content.toLowerCase()).toMatch(/critical|high|medium|low/);
    });

    test("references Key Vault specific MCP tools", () => {
      expect(skill.content).toContain("keyvault_key");
      expect(skill.content).toContain("keyvault_secret");
      expect(skill.content).toContain("keyvault_certificate");
    });
  });

  describe("MCP Tools Documentation", () => {
    test("documents compliance scanning tools", () => {
      expect(skill.content).toContain("mcp_azure_mcp_extension_azqr");
    });

    test("documents Key Vault tools", () => {
      expect(skill.content).toMatch(/keyvault_.*_list/);
      expect(skill.content).toMatch(/keyvault_.*_get/);
    });
  });

  describe("Prerequisites", () => {
    test("mentions authentication requirements", () => {
      expect(skill.content.toLowerCase()).toMatch(/authentication|logged in|az login/);
    });

    test("mentions required permissions", () => {
      expect(skill.content.toLowerCase()).toMatch(/reader|permissions|access/);
    });
  });

  describe("References", () => {
    test("references original skills", () => {
      expect(skill.content).toContain("azure-keyvault-expiration-audit");
      expect(skill.content).toContain("azure-quick-review");
    });

    test("links to reference documentation", () => {
      expect(skill.content).toContain("references/");
    });
  });

  describe("Best Practices", () => {
    test("includes best practices section or guidance", () => {
      expect(skill.content).toContain("Best Practices");
    });

    test("mentions regular auditing schedules", () => {
      const content = skill.content.toLowerCase();
      expect(content).toMatch(/weekly|monthly|regular|schedule/);
    });
  });
});
