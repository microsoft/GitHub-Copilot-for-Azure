/**
 * Trigger Tests for foundry-agent
 *
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 */

import { TriggerMatcher } from "../../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../../utils/skill-loader";

const SKILL_NAME = "microsoft-foundry/foundry-agent";

describe("foundry-agent - Trigger Tests", () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger", () => {
    const shouldTriggerPrompts: string[] = [
      "Create a new agent in Microsoft Foundry",
      "Deploy my agent to Azure AI Foundry",
      "Invoke my Foundry agent with a test message",
      "Troubleshoot my Foundry agent that is not responding",
      "Create a prompt agent with gpt-4o model",
      "Build a hosted agent using Python for Foundry",
      "List all agents in my Foundry project",
      "Delete an agent from my Foundry project",
      "Update my agent instructions in Foundry",
      "Add web search tool to my Foundry agent",
      "Add memory tool to my agent",
      "Set up MCP tool for my agent",
      "Chat with my agent in Foundry",
      "Show agent logs for debugging",
      "Create an agent with Bing grounding",
      "Add Azure AI Search to my agent",
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
      "Help me write a poem about clouds",
      "Explain quantum computing",
      "Configure my PostgreSQL database",
      "Help me with Kubernetes pods",
      "How do I set up a cron job in Linux?",
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
      const longPrompt = "create agent Foundry ".repeat(100);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe("boolean");
    });

    test("is case insensitive", () => {
      const result1 = triggerMatcher.shouldTrigger("CREATE AGENT FOUNDRY");
      const result2 = triggerMatcher.shouldTrigger("create agent foundry");
      expect(result1.triggered).toBe(result2.triggered);
    });
  });
});
