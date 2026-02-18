/**
 * Trigger Tests for agent-framework (evaluate)
 * 
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 */

import { TriggerMatcher } from "../../../../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../../../../utils/skill-loader";

const SKILL_NAME = "microsoft-foundry/agent/evaluate/agent-framework";

describe("agent-framework (evaluate) - Trigger Tests", () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger", () => {
    const shouldTriggerPrompts: string[] = [
      "Evaluate my agent's performance",
      "Test my agent with built-in evaluators",
      "Assess agent quality with pytest",
      "Add evaluation to my agent framework project",
      "Set up agent evaluation with metrics",
      "Measure agent performance using evaluators",
      "Add a custom evaluator to my agent tests",
      "Create evaluation dataset for my agent",
      "Configure judge model for agent evaluation",
      "Run pytest evaluation on my agent",
    ];

    test.each(shouldTriggerPrompts)(
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
      "Help me fix my SageMaker pipeline",
      "Configure my PostgreSQL database",
      "Optimize my spending and reduce costs",
      "Build a multi-agent workflow",
      "Set up a virtual network",
      "How do I write Python scripts?",
      "Help me debug my Kubernetes pods",
      "Explain how to use Docker containers",
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
      const longPrompt = "evaluate agent ".repeat(100);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe("boolean");
    });

    test("is case insensitive", () => {
      const result1 = triggerMatcher.shouldTrigger("EVALUATE AGENT PERFORMANCE");
      const result2 = triggerMatcher.shouldTrigger("evaluate agent performance");
      expect(result1.triggered).toBe(result2.triggered);
    });
  });
});
