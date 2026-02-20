/**
 * Trigger Tests for agent-framework-deploy
 * 
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 */

import { TriggerMatcher } from "../../../../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../../../../utils/skill-loader";

const SKILL_NAME = "microsoft-foundry/agent/deploy/agent-framework-deploy";

describe("agent-framework-deploy - Trigger Tests", () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger", () => {
    const shouldTriggerPrompts: string[] = [
      "Deploy my agent to Azure AI Foundry",
      "Deploy my agent to production on Foundry",
      "Host my agent on Azure",
      "Deploy my workflow to Foundry",
      "Go live with my agent",
      "Deploy agent to production",
      "Push my agent to Azure AI Foundry",
      "Deploy my multi-agent workflow",
      "Production deployment for my agent",
      "Deploy agent framework app to Foundry",
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
      "Help me with AWS SageMaker",
      "Configure my PostgreSQL database",
      "Optimize my Azure spending and reduce costs",
      "Check model capacity across regions",
      "Create a React web application",
      "Help me with Kubernetes pods",
      "Set up a virtual network in Azure",
      "How do I write Python code?",
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
      const longPrompt = "deploy agent ".repeat(100);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe("boolean");
    });

    test("is case insensitive", () => {
      const result1 = triggerMatcher.shouldTrigger("DEPLOY AGENT TO FOUNDRY");
      const result2 = triggerMatcher.shouldTrigger("deploy agent to foundry");
      expect(result1.triggered).toBe(result2.triggered);
    });
  });
});
