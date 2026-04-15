/**
 * Trigger Tests for azure-iac-generator
 *
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 *
 * Uses snapshot testing + parameterized tests for comprehensive coverage.
 */

import { TriggerMatcher } from "../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-iac-generator";

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
      // Live Azure reverse-engineering
      "Generate Bicep from my Azure resource group",
      "Generate bicep templates for my Azure resources",
      "Reverse engineer my Azure infrastructure into Bicep",
      "Export my Azure resource group as infrastructure as code",
      "Generate IaC from my Azure subscription",
      "Create Bicep templates from my existing Azure resources",
      "Azure to Bicep conversion for my resource group",
      "Convert my live Azure environment to Bicep",
      "Export infrastructure as code from Azure",
      "Reverse engineer my Azure resources into IaC",

      // Diagram-to-Bicep
      "Generate Bicep from my Draw.io diagram",
      "Create Bicep from my architecture diagram",
      "Convert my .drawio file to Bicep templates",
      "Bicep from my diagram",
      "Diagram to Bicep for my Azure architecture",
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
      // Unrelated topics
      "What is the weather today?",
      "Help me write a poem",
      "Explain quantum computing",
      "Write me a unit test in Python",
      "Summarize this article for me",

      // Non-cloud topics
      "How do I set up a local PostgreSQL database?",
      "What is the best way to structure a Node.js project?",
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
      const longPrompt = "Generate Bicep from Azure ".repeat(1000);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe("boolean");
    });

    test("is case insensitive", () => {
      const result1 = triggerMatcher.shouldTrigger("generate bicep from azure");
      const result2 = triggerMatcher.shouldTrigger("GENERATE BICEP FROM AZURE");
      expect(result1.triggered).toBe(result2.triggered);
    });
  });
});
