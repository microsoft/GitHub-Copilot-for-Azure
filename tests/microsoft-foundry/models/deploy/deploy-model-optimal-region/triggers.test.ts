/**
 * Trigger Tests for deploy-model-optimal-region
 * 
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 */

import { TriggerMatcher } from "../../../../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../../../../utils/skill-loader";

const SKILL_NAME = "microsoft-foundry/models/deploy-model/preset";

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
      "Deploy gpt-4o model",
      "Deploy gpt-4o quickly",
      "quick deployment of gpt-4o",
      "fast deployment",
      "fast setup for gpt-4o",
      
      // Optimal region
      "Deploy to optimal region",
      "deploy gpt-4o to best region",
      "find optimal region for deployment",
      "deploy to best location",
      "which region should I deploy to",
      
      // Automatic region selection
      "automatically select region",
      "automatic region selection",
      "deploy with automatic region",
      
      // Multi-region capacity check
      "check capacity across regions",
      "multi-region capacity check",
      "find region with capacity",
      "which regions have capacity",
      
      // High availability
      "deploy for high availability",
      "high availability deployment",
      "deploy with HA",
      
      // Generic deployment (should choose this as default)
      "deploy gpt-4o model to the optimal region",
      "I need to deploy gpt-4o",
      "deploy model to Azure",
    ];

    test.each(shouldTriggerPrompts)(
      'triggers on: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
        expect(result.confidence).toBeGreaterThan(0.5);
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
      "I want to customize the deployment",
      "Deploy with custom SKU",
      "Select specific version",
      "Choose model version",
      "Deploy with PTU",
      "Configure capacity manually",
      "Set custom capacity",
      "Select RAI policy",
      "Configure content filter",
      
      // Other Azure AI tasks
      "Create AI Foundry project",
      "Deploy an agent",
      "Create knowledge index",
      "Manage quota",
      "Configure RBAC",
      
      // Non-deployment tasks
      "Create Azure resource group",
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
      const result = triggerMatcher.shouldTrigger("DEPLOY TO OPTIMAL REGION");
      expect(result.triggered).toBe(true);
    });

    test("partial phrase matching", () => {
      const result = triggerMatcher.shouldTrigger("I need to deploy gpt-4o to the best available region");
      expect(result.triggered).toBe(true);
    });

    test("multiple trigger phrases in one prompt", () => {
      const result = triggerMatcher.shouldTrigger("Quick deployment to optimal region with high availability");
      expect(result.triggered).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.7);
    });
    
    test("should prefer this skill over customize-deployment for simple requests", () => {
      // This is a design preference - simple "deploy" requests should use the fast path
      const simpleDeployPrompt = "Deploy gpt-4o model";
      const result = triggerMatcher.shouldTrigger(simpleDeployPrompt);
      expect(result.triggered).toBe(true);
    });
  });
});
