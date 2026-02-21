/**
 * Trigger Tests for create
 * 
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 */

import { TriggerMatcher } from "../../../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../../../utils/skill-loader";

const SKILL_NAME = "microsoft-foundry";

describe("create - Trigger Tests", () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger", () => {
    const shouldTriggerPrompts: string[] = [
      "Create a new hosted agent for Foundry",
      "Build a hosted agent using LangGraph for Foundry",
      "Scaffold an agent project from a sample",
      "Create a new agent application for Foundry",
      "Start a new greenfield agent project for Foundry",
      "Build a custom hosted agent for Foundry",
      "Create an agent using Microsoft Agent Framework",
      "New LangChain agent for Foundry",
      "Scaffold agent from foundry-samples",
      "Create a hosted agent in C# for Foundry",
      "Convert my agent to a Foundry hosted agent",
      "Add hosting adapter to my Foundry agent project",
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
      "Configure my PostgreSQL database",
      "Help me with Kubernetes pods",
      "How do I configure a timer-based Azure function?",
      "Help me deploy a static website",
      "Write a unit test for my React component",
      "How do I use Git branches?",
      "Explain Docker networking basics",
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
      const longPrompt = "create agent ".repeat(100);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe("boolean");
    });

    test("is case insensitive", () => {
      const result1 = triggerMatcher.shouldTrigger("CREATE AGENT WITH FRAMEWORK");
      const result2 = triggerMatcher.shouldTrigger("create agent with framework");
      expect(result1.triggered).toBe(result2.triggered);
    });
  });
});
