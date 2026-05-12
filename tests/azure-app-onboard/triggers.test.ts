import { TriggerMatcher } from "../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-app-onboard";

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger", () => {
    const shouldTriggerPrompts: string[] = [
      // Entry — First-Time Deployment & Guided Onboarding
      "I have an app in GitHub — can you deploy it to Azure for me?",
      "I'm new to Azure. Can you get my existing app running without me setting up infrastructure?",
      "I just signed up for Azure. What's the fastest way to bring my app over?",
      "Can Azure automatically figure out how my app should be deployed?",
      "I want a one-click way to deploy my app to Azure.",
      "I built a side project and want to get it live on Azure",
      "I have a prototype ready — help me get it to production on Azure",
      "I'm building a SaaS app, can you help me plan my Azure setup from scratch?",
      "I'm a startup founder and need to deploy my MVP on Azure",
      "I have no Azure experience but need to host my web app",
      // Entry — Application Migration
      "I have an existing app — what's the best way to migrate it to Azure?",
      "We're running this app today. How do we bring it to Azure with minimal changes?",
      "I want to modernize my app on Azure without rewriting it.",
      // Entry — Repo & Multi-Component
      "My repo has multiple services — can Azure deploy the whole thing?",
      // Entry — Business Intent & App-Type
      "What Azure services would I need for a fitness tracking app?",
      "I'm building a B2B dashboard — help me figure out the right Azure setup",
      "Help me plan the cloud infrastructure for my new mobile app backend",
    ];

    test.each(shouldTriggerPrompts)(
      'triggers on: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
        expect(result.confidence).toBeGreaterThan(0);
      }
    );
  });

  describe("Should NOT Trigger", () => {
    // Generic negatives — avoid Azure/deploy keywords that false-positive on keyword matcher.
    // Competing skill negatives belong in integration tests (LLM routing), not here.
    const shouldNotTriggerPrompts: string[] = [
      "What is the weather today?",
      "Help me write a poem",
      "Explain quantum computing",
      "How do I configure an AWS Lambda function?",
      "Set up a GCP Cloud Run service",
      "Write a Python script to sort a list",
      "What is the capital of France?",
      "What is the best recipe for chocolate cake?",
      "Calculate the fibonacci sequence",
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
      const longPrompt = "Azure ".repeat(1000);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe("boolean");
    });

    test("is case insensitive", () => {
      const result1 = triggerMatcher.shouldTrigger("azure");
      const result2 = triggerMatcher.shouldTrigger("AZURE");
      expect(result1.triggered).toBe(result2.triggered);
    });
  });
});
