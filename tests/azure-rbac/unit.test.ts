/**
 * Unit Tests for azure-rbac
 * 
 * Test isolated skill logic and validation rules.
 */

import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-rbac";

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
      expect(skill.metadata.description.length).toBeLessThan(1024);
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

    test("description contains anti-triggers", () => {
      const description = skill.metadata.description.toLowerCase();
      const hasAntiTriggers = 
        description.includes("do not use for") ||
        description.includes("not for") ||
        description.includes("instead use");
      expect(hasAntiTriggers).toBe(true);
    });
  });

  describe("Skill Content", () => {
    test("has substantive content", () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(100);
    });

    test("mentions azure documentation tool", () => {
      expect(skill.content.toLowerCase()).toContain("azure__documentation");
    });

    test("mentions CLI generation", () => {
      expect(skill.content.toLowerCase()).toContain("cli");
    });

    test("mentions Bicep", () => {
      expect(skill.content.toLowerCase()).toContain("bicep");
    });

    test("mentions finding minimal role definition", () => {
      expect(skill.content.toLowerCase()).toMatch(/minimal role|least privilege|role definition/);
    });

    test("mentions custom role creation", () => {
      expect(skill.content.toLowerCase()).toContain("custom role");
    });

    test("includes azure__extension_cli_generate tool", () => {
      expect(skill.content.toLowerCase()).toContain("azure__extension_cli_generate");
    });

    test("mentions azure__bicepschema tool", () => {
      expect(skill.content.toLowerCase()).toContain("azure__bicepschema");
    });

    test("includes azure__get_azure_bestpractices tool", () => {
      expect(skill.content.toLowerCase()).toContain("azure__get_azure_bestpractices");
    });
  });

  describe("RBAC Role Assignment Workflow", () => {
    test("describes workflow for finding roles", () => {
      const content = skill.content.toLowerCase();
      const hasWorkflow = content.includes("find") || content.includes("search") || content.includes("documentation");
      expect(hasWorkflow).toBe(true);
    });

    test("mentions role assignment process", () => {
      expect(skill.content.toLowerCase()).toMatch(/assign.*role|role.*assign/);
    });

    test("includes guidance for no built-in role scenario", () => {
      const content = skill.content.toLowerCase();
      const hasCustomRoleGuidance = content.includes("no built-in role") || content.includes("custom role");
      expect(hasCustomRoleGuidance).toBe(true);
    });
  });

  describe("Output Expectations", () => {
    test("mentions generating CLI commands", () => {
      expect(skill.content.toLowerCase()).toMatch(/cli command|generate.*command/);
    });

    test("mentions providing Bicep code snippet", () => {
      expect(skill.content.toLowerCase()).toMatch(/bicep.*code|bicep.*snippet/);
    });

    test("references role assignment in Bicep", () => {
      const content = skill.content.toLowerCase();
      const hasBicepAssignment = content.includes("role assignment") && content.includes("bicep");
      expect(hasBicepAssignment).toBe(true);
    });
  });

  describe("Prerequisites Guidance", () => {
    test("mentions prerequisites for granting roles", () => {
      const content = skill.content.toLowerCase();
      const hasPrerequisites = content.includes("prerequisite") || content.includes("permission");
      expect(hasPrerequisites).toBe(true);
    });

    test("mentions User Access Administrator role", () => {
      expect(skill.content.toLowerCase()).toContain("user access administrator");
    });

    test("mentions authorization write permission", () => {
      const content = skill.content.toLowerCase();
      const hasAuthPermission = content.includes("microsoft.authorization/roleassignments/write") || 
                                 content.includes("roleassignments/write");
      expect(hasAuthPermission).toBe(true);
    });
  });
});
