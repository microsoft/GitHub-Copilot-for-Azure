/**
 * Cost Forecast Trigger Tests for azure-cost
 *
 * Forecast-specific positive trigger prompts.
 * Snapshots, edge cases, and negatives are in triggers.test.ts.
 */

import { TriggerMatcher } from "../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-cost";

describe(`${SKILL_NAME} - Cost Forecast Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;

  beforeAll(async () => {
    const skill: LoadedSkill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger on Forecast Prompts", () => {
    const forecastPrompts: string[] = [
      "What will my Azure costs be next month?",
      "Forecast my Azure spending for the rest of the quarter",
      "Predict my subscription costs for the next 90 days",
      "Show me projected costs for this billing period",
      "Estimate my Azure bill for next month",
      "How much will I spend on Azure by end of year?",
      "Show my forecast for Azure costs going forward",
    ];

    test.each(forecastPrompts)(
      'triggers on: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
      }
    );
  });
});
