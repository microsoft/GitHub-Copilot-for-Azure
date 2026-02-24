/**
 * Trigger Tests for azure-observability
 *
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 *
 * Uses snapshot testing + parameterized tests for comprehensive coverage.
 */

import { TriggerMatcher } from "../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-observability";

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger", () => {
    // Prompts that SHOULD trigger this skill
    const shouldTriggerPrompts: string[] = [
      // Azure Monitor queries and setup
      "How do I set up Azure Monitor for my application?",
      "Monitor my app performance on Azure",
      "Set up Azure Monitor to track CPU and memory metrics",

      // Application Insights
      "Configure Application Insights for my web app",
      "Show me Application Insights telemetry for my service",
      "View distributed traces in Application Insights",

      // Log Analytics / KQL
      "Query my Log Analytics workspace to find application errors using KQL",
      "Write a KQL query to analyze logs in Azure Monitor",
      "Analyze logs with KQL for my Azure app",

      // Alert rules
      "Create an alert rule when CPU exceeds 80%",
      "Set up alert notifications for my Azure resources",
      "Configure Azure Monitor alerts for my application",

      // Dashboards and workbooks
      "Build a monitoring dashboard for my Azure resources",
      "Create an Azure Monitor workbook for my app",

      // Observability setup
      "Set up observability for my Azure service",
      "Check application performance metrics on Azure",
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
    // Prompts that should NOT trigger this skill (must match fewer than 2 keywords)
    const shouldNotTriggerPrompts: string[] = [
      // Non-Azure topics
      "What is the weather today?",
      "Help me write a poem",
      "Explain quantum computing",
      "How do I bake a cake?",

      // No azure-observability keywords
      "Write unit tests for my Python functions",
      "Fix the CSS styling in my web app",
      "Install opentelemetry SDK in my Node.js project",
      "Deploy my app to Azure",
      "Write a Dockerfile for my Python app",
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
      const longPrompt = "Azure Monitor observability metrics ".repeat(100);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      // Should not throw, may or may not trigger
      expect(typeof result.triggered).toBe("boolean");
    });

    test("is case insensitive for monitoring keywords", () => {
      const lowerResult = triggerMatcher.shouldTrigger("monitor my azure application");
      const upperResult = triggerMatcher.shouldTrigger("MONITOR MY AZURE APPLICATION");
      const mixedResult = triggerMatcher.shouldTrigger("Monitor My Azure Application");

      expect(lowerResult.triggered).toBe(upperResult.triggered);
      expect(lowerResult.triggered).toBe(mixedResult.triggered);
    });

    test("distinguishes observability from deployment", () => {
      const observability = triggerMatcher.shouldTrigger("monitor my azure app performance");
      const deployment = triggerMatcher.shouldTrigger("deploy my app to azure");

      // Observability should trigger, pure deployment should not
      expect(observability.triggered).toBe(true);
      expect(deployment.triggered).toBe(false);
    });
  });
});
