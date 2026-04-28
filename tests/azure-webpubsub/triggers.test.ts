/**
 * Trigger Tests for azure-webpubsub
 *
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 */

import { TriggerMatcher } from "../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-webpubsub";

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger", () => {
    const shouldTriggerPrompts: string[] = [
      "Add Azure Web PubSub to my chat app",
      "Replace polling with Azure Web PubSub in an existing application",
      "Should I use upstream handlers or group pubsub in Azure Web PubSub?",
      "Build a negotiate endpoint for Azure Web PubSub browser clients",
      "Use Azure Web PubSub for Socket.IO rooms",
      "Help me choose between WebPubSubServiceClient and client group pubsub",
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
      "Set up AWS AppSync subscriptions",
      "Troubleshoot PostgreSQL replication lag",
      "Build a Redis cache invalidation worker",
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
      const longPrompt = "Azure Web PubSub upstream negotiate ".repeat(100);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe("boolean");
    });

    test("is case insensitive for webpubsub prompts", () => {
      const lowerResult = triggerMatcher.shouldTrigger("azure web pubsub chat app");
      const upperResult = triggerMatcher.shouldTrigger("AZURE WEB PUBSUB CHAT APP");

      expect(lowerResult.triggered).toBe(true);
      expect(lowerResult.triggered).toBe(upperResult.triggered);
    });

    test("distinguishes webpubsub prompts from unrelated realtime stacks", () => {
      const webPubSubResult = triggerMatcher.shouldTrigger("azure web pubsub upstream handler");
      const signalRResult = triggerMatcher.shouldTrigger("set up SignalR backplane for ASP.NET Core");

      expect(webPubSubResult.triggered).toBe(true);
      expect(signalRResult.triggered).toBe(false);
    });
  });
});