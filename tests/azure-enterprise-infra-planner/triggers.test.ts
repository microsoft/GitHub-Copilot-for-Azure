/**
 * Trigger Tests for azure-infra-planner
 * 
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 */

import { TriggerMatcher } from "../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-infra-planner";

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger", () => {
    const shouldTriggerPrompts: string[] = [
      "Create an infrastructure plan for my Azure deployment",
      "Plan Azure infrastructure for a serverless data pipeline",
      "Generate Bicep templates for my workload",
      "Deploy infrastructure to Azure with Terraform",
      "What Azure resources do I need for this project?",
      "Create a multi-environment infrastructure plan",
      "Plan dev staging and production Azure environments",
      "I need to provision Azure resources for my app",
      "Generate infrastructure as code for Azure",
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
      "Help me write a poem about clouds",
      "Write a Python script to parse CSV files",
      "Help me with AWS Lambda",
      "How do I use Kubernetes on GCP?",
      "Help me write unit tests for my React app",
      "What is the capital of France?",
      "Explain quantum computing",
      "How do I use Google Cloud Platform?",
    ];

    test.each(shouldNotTriggerPrompts)(
      'does not trigger on: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(false);
      }
    );
  });

  describe("Boundary Cases - azure-prepare territory (keyword overlap expected)", () => {
    // NOTE: These app-first prompts DO trigger the keyword matcher because they
    // contain "Azure", "deployment", etc. This is expected behavior — the keyword
    // matcher is intentionally broad. Skill disambiguation is handled by the LLM
    // routing layer, not by the trigger matcher. These tests document that overlap.
    const preparePrompts: string[] = [
      "Add authentication to my existing Express app on Azure",
      "Set up my Node.js app for Azure deployment",
      "Add Azure Key Vault to my existing application code",
      "Help me migrate my app from Heroku to Azure",
    ];

    test.each(preparePrompts)(
      'keyword matcher triggers on app-first prompt (expected overlap): "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        // Keyword matcher WILL trigger — this is expected; LLM routing disambiguates
        expect(result.triggered).toBe(true);
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
      const longPrompt = "Azure infrastructure ".repeat(1000);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe("boolean");
    });

    test("is case insensitive", () => {
      const result1 = triggerMatcher.shouldTrigger("plan azure infrastructure");
      const result2 = triggerMatcher.shouldTrigger("PLAN AZURE INFRASTRUCTURE");
      expect(result1.triggered).toBe(result2.triggered);
    });
  });
});
