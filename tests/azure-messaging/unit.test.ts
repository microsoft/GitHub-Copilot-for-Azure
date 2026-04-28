/**
 * Unit Tests for azure-messaging
 *
 * Test isolated skill logic and validation rules.
 */

import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-messaging";

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
      expect(skill.metadata.description.length).toBeGreaterThan(150);
      expect(skill.metadata.description.length).toBeLessThan(1024);
    });

    test("description contains WHEN trigger phrases", () => {
      const description = skill.metadata.description;
      expect(description).toContain("WHEN:");
    });

    test("has messaging-specific trigger keywords", () => {
      const description = skill.metadata.description.toLowerCase();
      const hasMessagingKeywords =
        description.includes("event hub") ||
        description.includes("service bus") ||
        description.includes("amqp") ||
        description.includes("messaging");
      expect(hasMessagingKeywords).toBe(true);
    });
  });

  describe("Skill Content", () => {
    test("has substantive content", () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(500);
    });

    test("contains diagnosis workflow section", () => {
      expect(skill.content).toContain("Diagnosis Workflow");
    });

    test("contains troubleshooting guides section", () => {
      expect(skill.content).toContain("Troubleshooting Guides");
    });

    test("directs to azure-diagnostics skill for troubleshooting content", () => {
      expect(skill.content).toContain(
        "troubleshooting guides are located in the azure-diagnostics skill under `troubleshooting/messaging/`"
      );
    });
  });

  describe("MCP Tools Documentation", () => {
    test("references messaging MCP tools", () => {
      expect(skill.content).toContain("mcp_azure_mcp_eventhubs");
      expect(skill.content).toContain("mcp_azure_mcp_servicebus");
    });

    test("references diagnostic MCP tools", () => {
      expect(skill.content).toContain("mcp_azure_mcp_monitor");
      expect(skill.content).toContain("mcp_azure_mcp_resourcehealth");
      expect(skill.content).toContain("mcp_azure_mcp_documentation");
    });
  });

  describe("Reference Files", () => {
    test("does not duplicate troubleshooting files locally", () => {
      // Troubleshooting content moved to azure-diagnostics; no local references/ links should remain
      expect(skill.content).not.toContain("references/sdk/");
      expect(skill.content).not.toContain("references/service-troubleshooting.md");
      expect(skill.content).not.toContain("references/auth-best-practices.md");
    });
  });

  describe("Diagnosis Workflow", () => {
    test("includes systematic diagnosis steps", () => {
      expect(skill.content).toContain("Identify the SDK and version");
      expect(skill.content).toContain("Check resource health");
      expect(skill.content).toContain("Review the error message");
      expect(skill.content).toContain("Recommend fix");
    });
  });
});
