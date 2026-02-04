/**
 * Trigger Tests for {SKILL_NAME}
 * 
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 * 
 * Uses snapshot testing + parameterized tests for comprehensive coverage.
 * Copy this file to /tests/{skill-name}/triggers.test.ts
 */

import { TriggerMatcher } from "../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

// Replace with your skill name
const SKILL_NAME = "your-skill-name";

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger", () => {
    // Parameterized tests - prompts that SHOULD trigger this skill
    const shouldTriggerPrompts: string[] = [
      // Add prompts that should trigger your skill
      // 'How do I deploy to Azure?',
      // 'Configure my storage account',
      // 'Help me with Azure CLI commands',
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
    // Parameterized tests - prompts that should NOT trigger this skill
    const shouldNotTriggerPrompts: string[] = [
      // Add prompts that should NOT trigger your skill
      "What is the weather today?",
      "Help me write a poem",
      "Explain quantum computing",
      // Add skill-specific negatives:
      // 'Help me with AWS Lambda', // Wrong cloud provider
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
      // This snapshot helps detect unintended changes to trigger behavior
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
      const longPrompt = "Azure ".repeat(1000);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      // Should not throw, may or may not trigger
      expect(typeof result.triggered).toBe("boolean");
    });

    test("is case insensitive", () => {
      // If your skill triggers on 'azure', it should also trigger on 'AZURE'
      const result1 = triggerMatcher.shouldTrigger("azure");
      const result2 = triggerMatcher.shouldTrigger("AZURE");
      expect(result1).toBe(result2);
    });
  });
});
