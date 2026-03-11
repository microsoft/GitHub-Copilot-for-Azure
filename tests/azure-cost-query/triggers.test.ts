/**
 * Trigger Tests for azure-cost-query
 *
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 */

import { TriggerMatcher } from "../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-cost-query";

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger", () => {
    const shouldTriggerPrompts: string[] = [
      // Direct cost query requests
      "What are my Azure costs this month?",
      "Show me cost breakdown by service for my subscription",
      "Query Azure spending for the last 30 days",
      "How much did I spend on storage last month?",
      "Show me a cost breakdown by resource group",
      "Show me actual vs amortized cost for my subscription",
      "What are my top cost drivers in Azure?",
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
      // Forecast skill (should not trigger cost-query)
      "Predict the budget for next quarter",
      "What will the projected budget look like next quarter?",
      // Optimization skill (should not trigger cost-query)
      "Find orphaned resources and rightsize VMs",
      "Reduce waste and optimize cloud expenses",
      // Deployment (different skill)
      "Deploy a new VM to Azure",
      // Wrong cloud provider
      "Set up an AWS budget",
      // Unrelated
      "Write a Python script",
      "Help me write a poem",
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
      const longPrompt = "Azure cost query breakdown ".repeat(500);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe("boolean");
    });

    test("is case insensitive", () => {
      const result1 = triggerMatcher.shouldTrigger("AZURE COST BREAKDOWN");
      const result2 = triggerMatcher.shouldTrigger("azure cost breakdown");
      expect(result1.triggered).toBe(result2.triggered);
    });
  });
});
