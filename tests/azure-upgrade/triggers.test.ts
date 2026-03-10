/**
 * Trigger Tests for azure-upgrade
 *
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 *
 * Uses snapshot testing + parameterized tests for comprehensive coverage.
 */

import { TriggerMatcher } from "../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-upgrade";

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger", () => {
    // Prompts that SHOULD trigger this skill - Azure-to-Azure upgrade workflows
    const shouldTriggerPrompts: string[] = [
      "Upgrade my function app from Consumption to Flex Consumption",
      "Move my function app to a better plan",
      "Is my function app ready for Flex Consumption?",
      "Automate the steps to upgrade my Functions plan",
      "Upgrade my Azure Functions SKU",
      "Change my function app hosting plan",
      "Migrate my Azure Functions from Consumption to Flex Consumption",
      "Assess my function app for upgrade readiness",
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
    // Prompts that should NOT trigger this skill (avoid upgrade/Azure keywords)
    const shouldNotTriggerPrompts: string[] = [
      "What is the weather today?",
      "Help me write a poem",
      "Explain quantum computing",
      "How do I use Google Cloud Platform?",
      "Write a Python script to parse JSON",
      "What is the capital of France?",
      "Help me debug my React application",
      "How do I optimize MySQL queries?",
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
      const longPrompt = "upgrade Azure Functions plan ".repeat(1000);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe("boolean");
    });

    test("is case insensitive", () => {
      const lower = triggerMatcher.shouldTrigger("upgrade my function app to flex consumption");
      const upper = triggerMatcher.shouldTrigger("UPGRADE MY FUNCTION APP TO FLEX CONSUMPTION");
      expect(lower.triggered).toBe(upper.triggered);
    });
  });
});
