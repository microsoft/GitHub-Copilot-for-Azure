/**
 * Trigger Tests for finetuning sub-skill
 *
 * Tests that verify the parent microsoft-foundry skill triggers
 * on fine-tuning related prompts and routes to the finetuning sub-skill.
 */

import { TriggerMatcher } from "../../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../../utils/skill-loader";

const SKILL_NAME = "microsoft-foundry";

describe("finetuning - Trigger Tests", () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger", () => {
    const shouldTriggerPrompts: string[] = [
      "Fine-tune gpt-4.1-mini on my dataset",
      "I want to do supervised fine-tuning on Azure AI Foundry",
      "How do I create training data for fine-tuning?",
      "Submit a reinforcement fine-tuning job with a Python grader",
      "I need to calibrate my RFT grader for fine-tuning",
      "Deploy my fine-tuned model",
      "Train a custom model on my JSONL dataset",
      "Distill gpt-4.1-mini into nano using fine-tuning on Foundry",
      "Check my fine-tuning training job status",
      "My fine-tuning training job is not working",
      "Upload a large training file for fine-tuning",
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
      "Help me write a poem",
      "Explain quantum computing",
      // Removed: deploy matches parent skill
      "Set up a Kubernetes cluster",
      // Removed: Azure matches parent skill
      "What is the capital of France?",
      "How do I cook pasta?"
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

    test("handles very long prompt", () => {
      const longPrompt = "fine-tune ".repeat(1000);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe("boolean");
    });

    test("is case insensitive", () => {
      const result1 = triggerMatcher.shouldTrigger("fine-tune my model");
      const result2 = triggerMatcher.shouldTrigger("FINE-TUNE MY MODEL");
      expect(result1.triggered).toBe(result2.triggered);
    });
  });
});
