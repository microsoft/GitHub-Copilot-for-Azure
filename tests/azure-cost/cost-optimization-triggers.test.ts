/**
 * Cost Optimization Trigger Tests for azure-cost
 *
 * Optimization-specific positive trigger prompts and boundary cases.
 * Snapshots, edge cases, and negatives are in triggers.test.ts.
 */

import { TriggerMatcher } from "../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-cost";

describe(`${SKILL_NAME} - Cost Optimization Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;

  beforeAll(async () => {
    const skill: LoadedSkill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger on Optimization Prompts", () => {
    const optimizationPrompts: string[] = [
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

    test.each(optimizationPrompts)(
      'triggers on: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
      }
    );
  });

  describe("Mixed Terminology", () => {
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
