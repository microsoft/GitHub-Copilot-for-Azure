/**
 * Trigger Tests for foundry-agent-invoke
 *
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 */

import { TriggerMatcher } from "../../../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../../../utils/skill-loader";

const SKILL_NAME = "microsoft-foundry";

describe("invoke - Trigger Tests", () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger", () => {
    const shouldTriggerPrompts: string[] = [
      "Invoke my Foundry agent with a test message",
      "Send a message to my deployed agent",
      "Test my deployed agent in Foundry",
      "Run my agent with a test prompt",
      "Have a conversation with my Foundry agent",
      "Chat with my agent in Azure AI Foundry",
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
      "Help me with AWS Lambda",
      "How do I configure my PostgreSQL database?",
      "Explain how Kubernetes pods work",
      "Set up monitoring for my web application",
      "Generate a Dockerfile for my Python web service",
      "Push my image to a registry",
      "Set up a serverless endpoint on AWS",
      "Package my Node.js app into a tarball",
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
      const longPrompt = "invoke agent ".repeat(100);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe("boolean");
    });

    test("is case insensitive", () => {
      const result1 = triggerMatcher.shouldTrigger("INVOKE MY AGENT");
      const result2 = triggerMatcher.shouldTrigger("invoke my agent");
      expect(result1.triggered).toBe(result2.triggered);
    });
  });
});
