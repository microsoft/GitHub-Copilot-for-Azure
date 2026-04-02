/**
 * Trigger Tests for spring-apps-to-aca
 * 
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 */

import { TriggerMatcher } from "../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "spring-apps-to-aca";

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger", () => {
    const shouldTriggerPrompts: string[] = [
      "How do I migrate Spring Boot to Azure Container Apps?",
      "Help me move my Spring application from Azure Spring Apps to ACA",
      "I want to containerize my Spring Boot microservice for Container Apps",
      "Migrate Spring Boot application to Container Apps",
      "Convert Spring Boot app to run on Azure Container Apps",
      "Move my Spring microservices to Container Apps",
      "Guide me through Spring Boot to ACA migration",
      "Modernize my Spring application on Azure Container Apps",
      "Deploy Spring Boot to Container Apps from Azure Spring Apps",
      "How to move Spring Boot from VM to Container Apps?",
    ];

    test.each(shouldTriggerPrompts)(
      'triggers on: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
      }
    );
  });

  describe("Should NOT Trigger", () => {
    const shouldNotTriggerPrompts: string[] = [
      "What is the weather today?",
      "Help me write a poem",
      "Explain quantum computing",
      "How to install Node.js on Windows?",
      "Best practices for React development",
      "Configure GitHub Actions for Python",
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
      const longPrompt = "Spring Boot migrate Container Apps ".repeat(100);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe("boolean");
    });

    test("is case insensitive", () => {
      const result1 = triggerMatcher.shouldTrigger("migrate spring boot to container apps");
      const result2 = triggerMatcher.shouldTrigger("MIGRATE SPRING BOOT TO CONTAINER APPS");
      expect(result1.triggered).toBe(result2.triggered);
    });
  });

  describe("Specificity Tests", () => {
    test("triggers on Azure Spring Apps to ACA migration", () => {
      const result = triggerMatcher.shouldTrigger("Migrate from Azure Spring Apps to Container Apps");
      expect(result.triggered).toBe(true);
    });

    test("triggers on Spring Boot containerization for ACA", () => {
      const result = triggerMatcher.shouldTrigger("Containerize my Spring Boot app for Azure Container Apps");
      expect(result.triggered).toBe(true);
    });

    test("triggers on microservices migration", () => {
      const result = triggerMatcher.shouldTrigger("Move Spring microservices to Azure Container Apps");
      expect(result.triggered).toBe(true);
    });
  });
});
