/**
 * Cost Query Trigger Tests for azure-cost
 *
 * Query-specific positive trigger prompts.
 * Snapshots, edge cases, and negatives are in triggers.test.ts.
 */

import { TriggerMatcher } from "../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-cost";

describe(`${SKILL_NAME} - Cost Query Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;

  beforeAll(async () => {
    const skill: LoadedSkill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger on Query Prompts", () => {
    const queryPrompts: string[] = [
      "What are my Azure costs this month?",
      "Show me cost breakdown by service for my subscription",
      "Query Azure spending for the last 30 days",
      "How much did I spend on storage last month?",
      "Show me a cost breakdown by resource group",
      "Show me actual vs amortized cost for my subscription",
      "What are my top cost drivers in Azure?",
    ];

    test.each(queryPrompts)(
      'triggers on: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
      }
    );
  });
});
