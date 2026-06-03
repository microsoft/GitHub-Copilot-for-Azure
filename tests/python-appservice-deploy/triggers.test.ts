/**
 * Trigger Tests for python-appservice-deploy
 *
 * Tests that verify the skill triggers on Python + App Service deployment
 * prompts (Flask, Django, FastAPI) and does NOT trigger on unrelated prompts
 * or on Python deployments to other Azure compute (Container Apps, Functions).
 */

import { TriggerMatcher } from "../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "python-appservice-deploy";

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger", () => {
    // NOTE: FastAPI uses one code path regardless of Python version (the skill
    // always sets the uvicorn startup command). No version-keyed trigger tests
    // are needed — Phase 2 collapsed the previous 3.14-vs-older branch.
    const shouldTriggerPrompts: string[] = [
      // Direct activation phrases from the skill description
      "Deploy my Flask app to App Service",
      "Deploy Django to Azure App Service",
      "Deploy FastAPI to Azure App Service",
      "Deploy my FastAPI app to Azure App Service",
      "Deploy my Python app to App Service",
      "Deploy my Python web app to Azure App Service",
      "Publish Python to App Service",
      "Host Django on Azure App Service",
      "Host my Flask app on Azure App Service",

      // Common framework variants
      "Push my Flask web app to Azure App Service",
      "Ship my Django application to Azure App Service",
      "Deploy a FastAPI service to Azure App Service",

      // Python web app phrasings
      "Python web app on App Service",
      "Get my Python Flask API running on Azure App Service",
    ];

    test.each(shouldTriggerPrompts)('triggers on: "%s"', (prompt) => {
      const result = triggerMatcher.shouldTrigger(prompt);
      expect(result.triggered).toBe(true);
    });
  });

  describe("Should NOT Trigger", () => {
    const shouldNotTriggerPrompts: string[] = [
      // Completely unrelated topics
      "What is the weather today?",
      "Help me write a poem",
      "Explain quantum computing",
      "How do I bake a cake?",

      // Pure code questions (no Azure / App Service / Python-framework keywords)
      "Write a sorting algorithm",
      "Fix this null reference exception in C#",
      "Debug this JavaScript promise chain",

      // Other clouds without Azure / framework keywords
      "Help me with AWS S3 buckets",
      "Configure GCP Cloud Storage",

      // NOTE: Prompts mixing "App Service" or "Flask/Django/FastAPI" with non-Python
      // languages or other compute targets (e.g. "Deploy my Java app to App Service",
      // "Deploy my Python app to Container Apps") are intentionally NOT included
      // here. The trigger matcher is keyword-based and can't model LLM routing
      // disambiguation. Those cases are handled at routing time by the description's
      // "PREFER OVER azure-prepare" and "DO NOT USE FOR" guidance, and are covered
      // by the integration test / Vally eval suites instead.
    ];

    test.each(shouldNotTriggerPrompts)('does not trigger on: "%s"', (prompt) => {
      const result = triggerMatcher.shouldTrigger(prompt);
      expect(result.triggered).toBe(false);
    });
  });

  describe("Trigger Keywords Snapshot", () => {
    test("skill keywords match snapshot", () => {
      expect(triggerMatcher.getKeywords()).toMatchSnapshot();
    });

    test("skill description triggers match snapshot", () => {
      expect({
        name: skill.metadata.name,
        description: skill.metadata.description,
        extractedKeywords: triggerMatcher.getKeywords(),
      }).toMatchSnapshot();
    });
  });

  describe("Edge Cases", () => {
    test("handles empty prompt", () => {
      const result = triggerMatcher.shouldTrigger("");
      expect(result.triggered).toBe(false);
    });

    test("handles very long prompt", () => {
      const longPrompt = "Deploy Flask to App Service ".repeat(500);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe("boolean");
    });

    test("is case insensitive", () => {
      const lower = triggerMatcher.shouldTrigger(
        "deploy my flask app to app service"
      );
      const upper = triggerMatcher.shouldTrigger(
        "DEPLOY MY FLASK APP TO APP SERVICE"
      );
      expect(lower.triggered).toBe(upper.triggered);
    });
  });
});
