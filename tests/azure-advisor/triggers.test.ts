/**
 * Trigger Tests for azure-advisor
 *
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 *
 */

import { TriggerMatcher } from "../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-advisor";

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger - Advisor Review", () => {
    const advisorPrompts: string[] = [
      "Run an Azure Advisor review of my subscription",
      "Check my Azure Advisor recommendations",
      "Summarize the Advisor findings for my subscription",
      "What does Advisor say about my Azure subscription?",
      "Give me an Azure Advisor health check",
      "Audit my Azure resources with Advisor",
      "Show me the top high-impact Azure Advisor recommendations",
      "Aggregate my Advisor recommendations by category",
    ];

    test.each(advisorPrompts)(
      'triggers on: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
        expect(result.matchedKeywords.length).toBeGreaterThanOrEqual(2);
      }
    );
  });

  describe("Should NOT Trigger", () => {
    const shouldNotTriggerPrompts: string[] = [
      "What is the weather today?",
      "Help me write a poem",
      "Explain quantum computing",
      "How do I write a Python web scraper?",
      "Analyze my Azure costs and spending trends",
      "Troubleshoot my Azure App Service deployment failure",
      "Help me set up Azure Key Vault for secrets management",
      "Deploy my web app to Azure App Service",
      "Set up Azure RBAC role assignments for my team",
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
        extractedKeywords: triggerMatcher.getKeywords(),
      }).toMatchSnapshot();
    });
  });

  describe("Edge Cases", () => {
    test("handles empty prompt", () => {
      const result = triggerMatcher.shouldTrigger("");
      expect(result.triggered).toBe(false);
    });

    test("is case insensitive", () => {
      const result1 = triggerMatcher.shouldTrigger(
        "RUN AN AZURE ADVISOR REVIEW"
      );
      const result2 = triggerMatcher.shouldTrigger(
        "run an azure advisor review"
      );
      expect(result1.triggered).toBe(true);
      expect(result1.triggered).toBe(result2.triggered);
    });
  });
});
