/**
 * Trigger Tests for azure-rbac
 * 
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 */

import { TriggerMatcher } from "../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-rbac";

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger", () => {
    const shouldTriggerPrompts: string[] = [
      "What Azure RBAC role should I assign to my managed identity?",
      "Which Azure role gives least privilege access to read blobs from storage?",
      "What role do I need for my identity to access Azure Key Vault secrets?",
      "Help me find the right Azure role for container registry access",
      "I need a custom role definition for my Azure storage account",
      "What Azure role should I use to give my function app access to Service Bus?",
      "Assign an Azure RBAC role to my identity for Cosmos DB read access",
      "What is the least privilege role for reading from a storage queue?",
      "I need to assign a role to my app service managed identity for database access",
      "Generate Bicep code for assigning a role to my function app",
      "Create a custom Azure role with specific permissions for my app",
      "What role should I use for my identity to write to Event Hubs?",
      "Help me find the minimal RBAC role for SQL Database read access",
      "I want to assign a role to read secrets from Key Vault with least privilege",
      // New: Permissions to grant roles
      "what RBAC/access roles do I need to grant access to storage accounts in the azure portal, or in copilot, for Web Apps and Functions",
      "what role do I need to grant Storage Blob Data Owner access to a Web App or Function resource",
      "what RBAC role needs to be given so a portal user can grant Storage Blob Data Owner access to a Web App or Function resource",
      "What permissions do I need to assign roles to managed identities?",
      "I'm getting authorization errors when trying to assign roles, what do I need?",
      "What role allows me to grant access to other identities?",
      "Do I need User Access Administrator to assign roles?",
    ];

    test.each(shouldTriggerPrompts)(
      'triggers on: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
      }
    );
  });

  describe("Should NOT Trigger", () => {
    const shouldNotTriggerPrompts: string[] = [
      "What is the weather today?",
      "Help me write a poem",
      "Explain quantum computing",
      "How do I set up a virtual network?",
      "Configure network security groups",
      "What is the best way to deploy my web app?",
      "How do I monitor my application performance?",
      "How do I scale my Azure App Service?",
      "Show me available pricing tiers for Azure SQL Database",
      "Set up a service principal for my deployment pipeline",
      "Configure firewall rules for my storage account",
      "How do I enable encryption at rest?",
      "Optimize my Azure costs",
      "Deploy my app to Azure App Service",
    ];

    test.each(shouldNotTriggerPrompts)(
      'does not trigger on: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(false);
      }
    );
  });

  describe("Trigger Keywords Snapshot", () => {
    test("skill keywords match snapshot", () => {
      expect(triggerMatcher.getKeywords()).toMatchSnapshot();
    });

    test("skill description triggers match snapshot", () => {
      expect({
        name: skill.metadata.name,
        description: skill.metadata.description,
        extractedKeywords: triggerMatcher.getKeywords()
      }).toMatchSnapshot();
    });
  });

  describe("Edge Cases", () => {
    test("handles empty prompt", () => {
      const result = triggerMatcher.shouldTrigger("");
      expect(result.triggered).toBe(false);
    });

    test("handles very long prompt", () => {
      const longPrompt = "Azure role ".repeat(1000);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe("boolean");
    });

    test("is case insensitive", () => {
      const result1 = triggerMatcher.shouldTrigger("What ROLE should I ASSIGN?");
      const result2 = triggerMatcher.shouldTrigger("what role should i assign?");
      expect(result1.triggered).toBe(result2.triggered);
    });
  });
});
