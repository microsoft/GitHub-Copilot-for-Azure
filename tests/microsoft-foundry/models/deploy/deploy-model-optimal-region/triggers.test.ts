/**
 * Trigger Tests for deploy-model-optimal-region
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
      // Quick deployment
      "Deploy gpt-4o quickly to best region",
      "quick deployment of gpt-4o",
      "fast deployment setup",
      "fast setup for gpt-4o deployment",
      
      // Optimal region
      "find optimal region for deployment",

      // Automatic region selection
      "deploy with automatic region",

      // Multi-region capacity check
      "find region with capacity",

      // High availability
      "high availability deployment",
      
      // Generic deployment (should choose this as default)
      "deploy gpt-4o model to the optimal region",
      "deploy models to Azure",
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

      // Customization scenarios (should use customize-deployment)
      "Choose model version",
      "Configure capacity manually",
      "Select RAI policy",
      "Configure content filter",

      // Other Azure AI tasks
      "Configure RBAC",

      // Non-deployment tasks
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
    test("multiple trigger phrases in one prompt", () => {
      const result = triggerMatcher.shouldTrigger("Quick deployment to optimal region with high availability");
      expect(result.triggered).toBe(true);
    });

    test("should prefer this skill over customize-deployment for simple requests", () => {
      // This is a design preference - simple "deploy" requests should use the fast path
      const simpleDeployPrompt = "Deploy models to optimal region quickly";
      const result = triggerMatcher.shouldTrigger(simpleDeployPrompt);
      expect(result.triggered).toBe(true);
    });
  });
});
