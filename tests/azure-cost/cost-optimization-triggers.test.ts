/**
 * Trigger Tests for azure-cost (cost optimization)
 * 
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 * Migrated from azure-cost-optimization to the unified azure-cost skill.
 */

import { TriggerMatcher } from "../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-cost";

describe(`${SKILL_NAME} - Cost Optimization Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger", () => {
    const shouldTriggerPrompts: string[] = [
      "How can I optimize my Azure costs?",
      "Reduce my Azure spending",
      "Find cost savings in my Azure subscription",
      "Analyze my Azure costs and find savings",
      "Find orphaned resources in my subscription",
      "List unused Azure resources I can delete",
      "Find unattached disks as orphaned resources",
      "Find resources wasting money",
      "What resources can I safely delete to save costs?",
      "Rightsize my Azure VMs",
      "Find overprovisioned resources",
      "Generate an Azure cost optimization report",
      "Analyze my Azure spending",
      "Audit my Azure subscription for cost savings",
      "Where am I overspending in Azure?",
      "Show me my biggest Azure cost drivers",
      "Optimize my Redis costs",
      "How can I reduce my storage costs?",
      "Find unused storage accounts",
      "Optimize my App Service costs",
      "Reduce waste in my Azure environment",
      "Find resources I'm paying for but not using",
      "Identify idle resources",
      "Clean up unused Azure resources",
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
      "What is machine learning?",
      "Deploy my app to Azure",
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
      const longPrompt = "Azure cost optimization savings ".repeat(500);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe("boolean");
    });

    test("is case insensitive", () => {
      const result1 = triggerMatcher.shouldTrigger("OPTIMIZE AZURE COSTS");
      const result2 = triggerMatcher.shouldTrigger("optimize azure costs");
      expect(result1.triggered).toBe(result2.triggered);
      expect(result1.triggered).toBe(true);
    });

    test("handles mixed terminology", () => {
      const prompts = [
        "reduce azure spending",
        "optimize azure costs",
      ];
      prompts.forEach(prompt => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
      });
    });

    test("triggers on synonymous cost terminology", () => {
      const result = triggerMatcher.shouldTrigger("reduce azure expenses and spending");
      expect(result.triggered).toBe(true);
    });
  });

  describe("Boundary Cases", () => {
    test("distinguishes from non-cost topics", () => {
      const nonCostPrompts = [
        "deploy my app to kubernetes",
        "configure DNS settings",
        "set up a database schema",
      ];
      nonCostPrompts.forEach(prompt => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(false);
      });
    });

    test("triggers on optimization-focused cost queries", () => {
      const optimizationPrompts = [
        "analyze current costs",
        "reduce existing spending",
        "find savings in my subscription",
      ];
      optimizationPrompts.forEach(prompt => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
      });
    });
  });
});
