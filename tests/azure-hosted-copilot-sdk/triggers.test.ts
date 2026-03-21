/**
 * Trigger Tests for azure-hosted-copilot-sdk
 * 
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 */

import { TriggerMatcher } from "../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-hosted-copilot-sdk";

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger", () => {
    const shouldTriggerPrompts: string[] = [
      "Build a Copilot SDK app and deploy it",
      "Create a new copilot SDK service",
      "Scaffold a copilot-powered app on Azure",
      "Build with the GitHub Copilot SDK and host it",
      "Build a Copilot SDK app with my own Azure model",
      "Create a copilot app using my Azure OpenAI model",
      "Set up a copilot service with BYOM and DefaultAzureCredential",
      "Build a copilot app that uses a self-hosted model on Azure",
      "Deploy a copilot SDK app with my own endpoint",
      "Create a copilot app and bring your own model from Azure OpenAI",
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
      "Help me with AWS Lambda",
      "How do I use Google Cloud Platform?",
      "Write a Python script to parse JSON",
      "Set up a PostgreSQL database with read replicas",
      "Configure a VNet peering between two subscriptions",
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
      const longPrompt = "Azure ".repeat(1000);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe("boolean");
    });

    test("is case insensitive", () => {
      const result1 = triggerMatcher.shouldTrigger("azure");
      const result2 = triggerMatcher.shouldTrigger("AZURE");
      expect(result1.triggered).toBe(result2.triggered);
    });
  });
});
