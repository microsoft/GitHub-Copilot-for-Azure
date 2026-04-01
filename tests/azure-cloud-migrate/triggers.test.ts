/**
 * Trigger Tests for azure-cloud-migrate
 * 
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 * 
 * Uses snapshot testing + parameterized tests for comprehensive coverage.
 */

import { TriggerMatcher } from "../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-cloud-migrate";

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger — Lambda to Functions", () => {
    const lambdaPrompts: string[] = [
      "How do I migrate my AWS Lambda functions to Azure Functions?",
      "I want to migrate from AWS to Azure",
      "Can you do a Lambda migration assessment for my project?",
      "Convert my serverless functions to Azure",
      "Generate a migration readiness report for my Lambda functions",
      "Help me migrate code to Azure Functions",
      "Assess my AWS Lambda project for Azure migration",
      "I need to move my Lambda workloads to Azure Functions",
    ];

    test.each(lambdaPrompts)(
      'triggers on: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
      }
    );
  });

  describe("Should Trigger — Beanstalk to App Service", () => {
    const beanstalkPrompts: string[] = [
      "How do I migrate my Elastic Beanstalk app to Azure App Service?",
      "Migrate my Beanstalk application to Azure",
      "I need to move from AWS Beanstalk to Azure",
      "Assess my Elastic Beanstalk project for Azure migration",
    ];

    test.each(beanstalkPrompts)(
      'triggers on: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
      }
    );
  });

  describe("Should Trigger — Heroku to Azure", () => {
    const herokuPrompts: string[] = [
      "How do I migrate my Heroku app to Azure?",
      "Migrate from Heroku to Azure App Service",
      "I want to move my Heroku web app to Azure",
      "Help me migrate my Heroku application to Azure",
    ];

    test.each(herokuPrompts)(
      'triggers on: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
      }
    );
  });

  describe("Should Trigger — App Engine to App Service", () => {
    const appEnginePrompts: string[] = [
      "How do I migrate my Google App Engine app to Azure App Service?",
      "Migrate from App Engine to Azure",
      "Move my Google Cloud app to Azure App Service",
    ];

    test.each(appEnginePrompts)(
      'triggers on: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
      }
    );
  });

  describe("Should NOT Trigger", () => {
    // Prompts that should NOT trigger this skill (avoid migration/Azure keywords)
    const shouldNotTriggerPrompts: string[] = [
      "What is the weather today?",
      "Help me write a poem",
      "Explain quantum computing",
      "How do I use Google Cloud Platform?",
      "Write a Python script to parse JSON",
      "What is the capital of France?",
      "Help me debug my React application",
      "How do I optimize MySQL queries?",
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
      const longPrompt = "migrate AWS Lambda ".repeat(1000);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe("boolean");
    });

    test("is case insensitive", () => {
      const lower = triggerMatcher.shouldTrigger("migrate lambda to functions");
      const upper = triggerMatcher.shouldTrigger("MIGRATE LAMBDA TO FUNCTIONS");
      expect(lower.triggered).toBe(upper.triggered);
    });
  });
});
