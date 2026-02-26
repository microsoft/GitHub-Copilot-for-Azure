/**
 * Trigger Tests for trace
 *
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 */

import { TriggerMatcher } from "../../../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../../../utils/skill-loader";

const SKILL_NAME = "microsoft-foundry";

describe("trace - Trigger Tests", () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger", () => {
    const shouldTriggerPrompts: string[] = [
      "Analyze my agent traces in App Insights",
      "Search agent conversations in Foundry",
      "Find failing traces for my Foundry agent",
      "My Foundry agent is slow, show me the latency",
      "Show me the trace for this Foundry agent conversation",
      "Why is my Foundry agent returning errors in production",
      "Search traces by conversation ID in Foundry",
      "Find slow agent traces in App Insights",
      "Show me GenAI telemetry for my Foundry agent",
      "Analyze production errors for my Foundry agent",
    ];

    test.each(shouldTriggerPrompts)(
      "triggers on: \"%s\"",
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
      "Help me write a poem about clouds",
      "Help me with AWS SageMaker",
      "How do I configure my PostgreSQL database?",
      "Explain how Kubernetes pods work",
      "Create a REST API in Python",
      "Set up a React application",
      "Set up a Jenkins CI pipeline for my Java project",
      "Write unit tests for my JavaScript code",
    ];

    test.each(shouldNotTriggerPrompts)(
      "does not trigger on: \"%s\"",
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
      const longPrompt = "analyze traces Foundry agent ".repeat(100);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe("boolean");
    });

    test("is case insensitive", () => {
      const result1 = triggerMatcher.shouldTrigger("ANALYZE TRACES FOUNDRY AGENT");
      const result2 = triggerMatcher.shouldTrigger("analyze traces foundry agent");
      expect(result1.triggered).toBe(result2.triggered);
    });
  });
});
