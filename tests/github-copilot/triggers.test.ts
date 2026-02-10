/**
 * Trigger Tests for github-copilot
 * 
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 */

import { TriggerMatcher } from "../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "github-copilot";

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger", () => {
    const shouldTriggerPrompts: string[] = [
      "Build a repo quality rater with the Copilot SDK",
      "Create a Copilot Extension and deploy it to Azure",
      "Build an app using the copilot-extensions preview-sdk",
      "Deploy my Copilot Extension to Azure Container Apps",
      "Create a copilot agent endpoint with SSE streaming",
      "Build a Copilot Extension that reviews pull requests",
      "I want to build a copilot-powered app using @github/copilot-sdk",
      "Set up a copilot webhook endpoint on Azure",
      "Embed Copilot in my Node.js application",
      "Build an app that uses the GitHub Copilot SDK",
    ];

    test.each(shouldTriggerPrompts)(
      'triggers on: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
        expect(result.confidence).toBeGreaterThan(0.5);
      }
    );
  });

  describe("Should NOT Trigger", () => {
    const shouldNotTriggerPrompts: string[] = [
      "What is the weather today?",
      "Help me write a poem",
      "Explain quantum computing",
      "How do I use GitHub Copilot in VS Code",
      "Deploy my Node.js app to Azure App Service",
      "Help me with AWS Lambda functions",
      "Create an Azure Function with a timer trigger",
      "Set up a PostgreSQL database on Azure",
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
      const longPrompt = "Copilot SDK ".repeat(1000);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe("boolean");
    });

    test("is case insensitive", () => {
      const result1 = triggerMatcher.shouldTrigger("copilot extension");
      const result2 = triggerMatcher.shouldTrigger("COPILOT EXTENSION");
      expect(result1.triggered).toBe(result2.triggered);
    });
  });
});
