/**
 * Trigger Tests for entra-app-registration
 * 
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 */

import { TriggerMatcher } from "../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "entra-app-registration";

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger", () => {
    const shouldTriggerPrompts: string[] = [
      "How do I create an app registration in Azure?",
      "Register an Azure AD app for my web application",
      "Configure OAuth authentication for my application",
      "Set up authentication with Microsoft Entra ID",
      "Add API permissions to my Entra app registration",
      "Generate a service principal for Azure authentication",
      "Show me an MSAL example for Entra authentication",
      "Create a console app with Azure AD authentication",
      "Help me set up Entra ID authentication for my app",
      "Configure Azure AD OAuth authentication for my API",
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
      const longPrompt = "Entra ID app registration ".repeat(100);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe("boolean");
    });

    test("is case insensitive", () => {
      const lowerResult = triggerMatcher.shouldTrigger("create app registration");
      const upperResult = triggerMatcher.shouldTrigger("CREATE APP REGISTRATION");
      expect(lowerResult.triggered).toBe(upperResult.triggered);
    });
  });
});
