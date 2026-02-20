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

    test("description contains USE FOR trigger phrases", () => {
      const description = skill.metadata.description;
      expect(description).toContain("USE FOR:");
    });

    test("description contains DO NOT USE FOR anti-triggers", () => {
      const description = skill.metadata.description;
      expect(description).toContain("DO NOT USE FOR:");
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

    test("contains connectivity troubleshooting section", () => {
      expect(skill.content).toContain("Connectivity Troubleshooting");
    });

    test("references SDK troubleshooting guides", () => {
      expect(skill.content).toContain("SDK Troubleshooting Guides");
    });

    test("links to language-specific SDK references", () => {
      expect(skill.content).toContain("references/sdk/azure-eventhubs-py.md");
      expect(skill.content).toContain("references/sdk/azure-servicebus-py.md");
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
});
