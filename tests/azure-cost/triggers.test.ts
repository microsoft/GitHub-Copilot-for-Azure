/**
 * Generic Trigger Tests for azure-cost
 *
 * Keyword snapshots, edge cases, and negative (should-not-trigger) prompts.
 * Sub-area-specific positive trigger prompts live in cost-query-triggers,
 * cost-forecast-triggers, and cost-optimization-triggers test files.
 */

import { TriggerMatcher } from "../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-cost";

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
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

  describe("Should NOT Trigger", () => {
    const shouldNotTriggerPrompts: string[] = [
      "Deploy a new VM to Azure",
      "Set up an AWS budget",
      "Write a Python script",
      "Help me write a poem",
      "What is the weather today?",
      "Explain quantum computing",
      "What is machine learning?",
      "Help me set up a new virtual network",
      "Create a new storage account",
      "Provision infrastructure with Bicep",
      "Why is my app crashing?",
      "Troubleshoot connection issues",
      "My Container App won't start",
      "Set up RBAC for my subscription",
      "Configure Key Vault",
      "Audit security compliance",
      "Set up Application Insights",
      "Monitor my app performance",
      "Configure alerts for errors",
      "View logs for my Function App",
      "Deploy my app to Azure",
    ];

    test.each(shouldNotTriggerPrompts)(
      'does not trigger on: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(false);
      }
    );
  });

  describe("Edge Cases", () => {
    test("handles empty prompt", () => {
      const result = triggerMatcher.shouldTrigger("");
      expect(result.triggered).toBe(false);
    });

    test("handles very long prompt", () => {
      const longPrompt = "Azure cost management analysis ".repeat(500);
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
