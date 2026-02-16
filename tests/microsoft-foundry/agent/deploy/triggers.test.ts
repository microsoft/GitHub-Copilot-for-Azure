/**
 * Trigger Tests for foundry-agent-deploy
 *
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 */

import { TriggerMatcher } from "../../../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../../../utils/skill-loader";

const SKILL_NAME = "microsoft-foundry/agent/deploy";

describe("deploy - Trigger Tests", () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger", () => {
    const shouldTriggerPrompts: string[] = [
      "Deploy my agent to Azure AI Foundry",
      "Create a hosted agent in Foundry",
      "Start my agent container in Foundry",
      "Stop my hosted agent container",
      "Check agent container status in Foundry",
      "Create a prompt agent with gpt-4o model",
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
      "Help me with AWS SageMaker",
      "How do I configure my PostgreSQL database?",
      "Explain how Kubernetes pods work",
      "Set up monitoring for my web application",
      "Generate a Dockerfile for my Python web service",
      "Push my image to a registry",
      "Create a serverless function endpoint",
      "Send a test message to my Foundry agent",
      "Invoke my deployed Foundry agent endpoint",
      "Call my existing Foundry agent to run a query",
      "Test my already deployed Azure AI Foundry agent",
      "Use my Foundry agent to process this request",
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
      const longPrompt = "deploy agent Foundry ".repeat(100);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe("boolean");
    });

    test("is case insensitive", () => {
      const result1 = triggerMatcher.shouldTrigger("DEPLOY AGENT FOUNDRY");
      const result2 = triggerMatcher.shouldTrigger("deploy agent foundry");
      expect(result1.triggered).toBe(result2.triggered);
    });
  });
});
