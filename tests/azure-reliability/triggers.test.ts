/**
 * Trigger Tests for azure-reliability
 *
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 */

import { TriggerMatcher } from "../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-reliability";

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger", () => {
    const shouldTriggerPrompts: string[] = [
      // Direct activation prompts from Skill Activation Triggers
      "Assess my app's reliability",
      "Check the reliability of my resource group",
      "Is my function app zone redundant?",
      "Make my function app zone redundant",
      "Set up multi-region failover for my Functions app",
      "Check my reliability posture",
      "Find single points of failure in my Azure environment",
      "Enable high availability for my Azure Functions resources",
      "Check disaster recovery readiness",
      "Improve my Azure Functions app's resilience",
      // Storage redundancy (always paired with reliability/zone keywords)
      "Is my storage zone redundant?",
      // Functions-specific
      "Add zone redundancy to my Azure Functions Premium plan",
      // Multi-region
      "Set up Azure Front Door for failover between regions",
      "How do I make my Azure Functions app multi-region?",
    ];

    test.each(shouldTriggerPrompts)('triggers on: "%s"', (prompt) => {
      const result = triggerMatcher.shouldTrigger(prompt);
      expect(result.triggered).toBe(true);
    });
  });

  describe("Should NOT Trigger", () => {
    const shouldNotTriggerPrompts: string[] = [
      // Unrelated topics
      "What is the weather today?",
      "Help me write a poem",
      "Explain quantum computing",
      // Different cloud providers
      "Help me with AWS Lambda",
      "How do I use Google Cloud Platform?",
      "Configure GCP Cloud Run autoscaling",
      // Different Azure tasks (not reliability)
      "Write a Python script to parse JSON",
      "Show me my Azure subscription cost breakdown",
      "Generate a Bicep template for a new web app",
    ];

    test.each(shouldNotTriggerPrompts)('does not trigger on: "%s"', (prompt) => {
      const result = triggerMatcher.shouldTrigger(prompt);
      expect(result.triggered).toBe(false);
    });
  });

  describe("Trigger Keywords Snapshot", () => {
    test("skill keywords match snapshot", () => {
      expect(triggerMatcher.getKeywords()).toMatchSnapshot();
    });

    test("skill description triggers match snapshot", () => {
      expect({
        name: skill.metadata.name,
        description: skill.metadata.description,
        extractedKeywords: triggerMatcher.getKeywords(),
      }).toMatchSnapshot();
    });
  });

  describe("Edge Cases", () => {
    test("handles empty prompt", () => {
      const result = triggerMatcher.shouldTrigger("");
      expect(result.triggered).toBe(false);
    });

    test("handles very long prompt", () => {
      const longPrompt = "Azure reliability ".repeat(1000);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe("boolean");
    });

    test("is case insensitive", () => {
      const lower = triggerMatcher.shouldTrigger(
        "is my function app zone redundant?"
      );
      const upper = triggerMatcher.shouldTrigger(
        "IS MY FUNCTION APP ZONE REDUNDANT?"
      );
      expect(lower.triggered).toBe(upper.triggered);
    });
  });
});
