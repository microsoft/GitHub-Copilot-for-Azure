/**
 * Trigger Tests for azure-messaging
 *
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 */

import { TriggerMatcher } from "../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-messaging";

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger", () => {
    const shouldTriggerPrompts: string[] = [
      // Event Hubs SDK issues
      "event hub SDK error in my Python app",
      "my event hub consumer is not receiving messages",
      "event hub checkpoint store failing",
      "eventhub python connection timeout",
      "eventhub javascript client disconnects",

      // Service Bus SDK issues
      "service bus SDK issue with message lock lost",
      "service bus queue issue with dead letter",
      "servicebus java send timeout",
      "servicebus dotnet receiver disconnected",

      // General messaging issues
      "AMQP error connecting to Azure messaging",
      "messaging connection failure to Event Hubs",
      "event processor host issue stops processing",
      "enable logging for event hub SDK",
      "service bus logging for troubleshooting",
      "azure messaging SDK troubleshooting",
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
      // Non-Azure topics
      "What is the weather today?",
      "Help me write a poem",
      "Explain quantum computing",
      "How do I bake a cake?",

      // Wrong cloud provider
      "Debug my AWS SQS queue",

      // Deployment tasks (not troubleshooting)
      "Deploy my app to production",
      "Publish my web application",

      // Monitoring setup (not troubleshooting)
      "Configure Prometheus dashboards",
      "Set up Grafana alerts",

      // Cost analysis (not troubleshooting)
      "Reduce my cloud compute costs",
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
      const longPrompt = "Azure Event Hubs SDK troubleshooting ".repeat(100);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe("boolean");
    });

    test("is case insensitive for messaging keywords", () => {
      const lowerResult = triggerMatcher.shouldTrigger("event hub sdk error");
      const upperResult = triggerMatcher.shouldTrigger("EVENT HUB SDK ERROR");
      const mixedResult = triggerMatcher.shouldTrigger("Event Hub SDK Error");

      expect(lowerResult.triggered).toBe(upperResult.triggered);
      expect(lowerResult.triggered).toBe(mixedResult.triggered);
    });

    test("distinguishes between troubleshooting and resource creation", () => {
      const troubleshoot = triggerMatcher.shouldTrigger("service bus SDK issue message lock lost");
      const create = triggerMatcher.shouldTrigger("create a new service bus namespace");

      expect(troubleshoot.triggered).toBe(true);
      expect(create.triggered).toBe(false);
    });
  });
});
