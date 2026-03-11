/**
 * Trigger Tests for azure-quotas
 *
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 */

import { TriggerMatcher } from "../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-quotas";

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger", () => {
    const shouldTriggerPrompts: string[] = [
      "How do I check my Azure quota limits?",
      "What are the service limits for my Azure subscription?",
      "Check current usage for my compute quota",
      "I need to request a quota increase for VMs in East US",
      "My deployment failed with a quota exceeded error",
      "How do I validate deployment capacity before provisioning?",
      "Help me select a region based on quota availability",
      "Compare quotas across regions for Standard_D4s_v3",
      "What is the provisioning limit for public IP addresses?",
      "Check regional capacity for Container Apps",
      "How many vCPUs do I have available in my subscription?",
      "I need to check Azure quotas before deploying my infrastructure",
      "Show me my current Azure resource usage vs limits",
      "How do I increase my VM quota in West US 2?",
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
      "How do I optimize my Azure costs?",
      "Help me set up AWS Lambda functions",
      "Configure monitoring for my application",
      "How do I troubleshoot my container app?",
      "What role should I assign to my managed identity?",
      "Show me my Azure billing information",
      "Help me write a Bicep template for a storage account",
      "How do I configure Azure Key Vault secrets?",
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
      const longPrompt = "Azure quota ".repeat(1000);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe("boolean");
    });

    test("is case insensitive", () => {
      const result1 = triggerMatcher.shouldTrigger("Check my AZURE QUOTA limits");
      const result2 = triggerMatcher.shouldTrigger("check my azure quota limits");
      expect(result1.triggered).toBe(result2.triggered);
    });
  });
});
