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

    test("contains connectivity troubleshooting section", () => {
      expect(skill.content).toContain("Connectivity Troubleshooting");
    });

    test("references SDK troubleshooting guides", () => {
      expect(skill.content).toContain("SDK Troubleshooting Guides");
    });

    test("links to language-specific SDK references in azure-diagnostics", () => {
      expect(skill.content).toContain("azure-diagnostics/troubleshooting/messaging/azure-eventhubs-py.md");
      expect(skill.content).toContain("azure-diagnostics/troubleshooting/messaging/azure-servicebus-py.md");
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
    test("links to all language-specific Event Hubs SDK guides in azure-diagnostics", () => {
      expect(skill.content).toContain("azure-diagnostics/troubleshooting/messaging/azure-eventhubs-py.md");
      expect(skill.content).toContain("azure-diagnostics/troubleshooting/messaging/azure-eventhubs-java.md");
      expect(skill.content).toContain("azure-diagnostics/troubleshooting/messaging/azure-eventhubs-js.md");
      expect(skill.content).toContain("azure-diagnostics/troubleshooting/messaging/azure-eventhubs-dotnet.md");
    });

    test("links to all language-specific Service Bus SDK guides in azure-diagnostics", () => {
      expect(skill.content).toContain("azure-diagnostics/troubleshooting/messaging/azure-servicebus-py.md");
      expect(skill.content).toContain("azure-diagnostics/troubleshooting/messaging/azure-servicebus-java.md");
      expect(skill.content).toContain("azure-diagnostics/troubleshooting/messaging/azure-servicebus-js.md");
      expect(skill.content).toContain("azure-diagnostics/troubleshooting/messaging/azure-servicebus-dotnet.md");
    });

    test("links to service-level troubleshooting guide in azure-diagnostics", () => {
      expect(skill.content).toContain("azure-diagnostics/troubleshooting/messaging/service-troubleshooting.md");
    });

    test("keeps auth-best-practices locally", () => {
      expect(skill.content).toContain("references/auth-best-practices.md");
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
