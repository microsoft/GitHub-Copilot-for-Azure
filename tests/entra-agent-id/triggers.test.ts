/**
 * Trigger Tests for entra-agent-id
 *
 * Verify the skill triggers on appropriate prompts and does NOT trigger on unrelated prompts.
 */

import { TriggerMatcher } from "../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "entra-agent-id";

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger", () => {
    const shouldTriggerPrompts: string[] = [
      "How do I create an Agent Identity Blueprint in Microsoft Entra?",
      "Register an AI agent identity via Microsoft Graph",
      "Set up a BlueprintPrincipal for my agent",
      "Configure OAuth authentication for an Entra Agent ID",
      "Exchange tokens with fmi_path for an agent identity",
      "Set up Workload Identity Federation for an Entra agent",
      "Configure OBO flow for an agent identity",
      "Deploy the Microsoft Entra SDK for AgentID sidecar container",
      "Enable polyglot agent authentication with the auth sidecar",
      "Provision a cross-tenant agent identity blueprint",
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
      "Help me with AWS IAM roles",
      "How do I create a Lambda function?",
      "What is the best database for my project?",
      "Help me write a Python script",
      "Explain microservices architecture",
      "How do I use GitHub Actions?",
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
      const longPrompt = "Agent Identity Blueprint ".repeat(100);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe("boolean");
    });

    test("is case insensitive", () => {
      const lower = triggerMatcher.shouldTrigger("create agent identity blueprint");
      const upper = triggerMatcher.shouldTrigger("CREATE AGENT IDENTITY BLUEPRINT");
      expect(lower.triggered).toBe(upper.triggered);
    });
  });
});
