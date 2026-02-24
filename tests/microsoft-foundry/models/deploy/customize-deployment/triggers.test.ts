/**
 * Trigger Tests for customize-deployment
 * 
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 */

import { TriggerMatcher } from "../../../../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../../../../utils/skill-loader";

const SKILL_NAME = "microsoft-foundry";

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger", () => {
    // Prompts that SHOULD trigger this skill
    const shouldTriggerPrompts: string[] = [
      // Core customization phrases
      "I want to customize the deployment for gpt-4o",
      "customize model deployment",
      "deploy with custom settings",

      // SKU selection
      "deploy with specific SKU",
      "select SKU for deployment",

      // Capacity configuration
      "set capacity for deployment",
      "deploy with 50K TPM capacity",

      // Advanced options
      "deployment with advanced options",
      "detailed deployment configuration",

      // PTU deployments
      "deploy with PTU",
      "PTU deployment",
      "provisioned throughput deployment",
      "deploy with provisioned capacity",
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
    // Prompts that should NOT trigger this skill
    const shouldNotTriggerPrompts: string[] = [
      // General unrelated
      "What is the weather today?",
      "Help me write a poem",
      "Explain quantum computing",

      // Wrong cloud provider
      "Deploy to AWS Lambda",
      "Configure GCP Cloud Functions",

      // Quick deployment scenarios (should use deploy-model-optimal-region)
      "Deploy to optimal region",

      // Non-deployment Azure tasks
      "Set up virtual network",
      "Configure Azure Storage",
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
    test("case insensitive matching", () => {
      const result = triggerMatcher.shouldTrigger("CUSTOMIZE DEPLOYMENT FOR GPT-4O");
      expect(result.triggered).toBe(true);
    });
  });
});
