/**
 * Trigger Tests for azure-infrastructure-sync
 *
 * Verify prompts that should and should not activate the skill.
 */

import { loadSkill, LoadedSkill } from "../utils/skill-loader";
import { TriggerMatcher } from "../utils/trigger-matcher";

const SKILL_NAME = "azure-infrastructure-sync";

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger", () => {
    const shouldTriggerPrompts: string[] = [
      "Check if my diagram matches Azure",
      "Detect infrastructure drift between diagram and Azure",
      "Sync my diagram with what is deployed in Azure",
      "Compare my Bicep to my diagram",
      "Check if Bicep matches the diagram",
      "Compare Bicep to live Azure",
      "Compare Bicep to Azure for drift",
      "Does Azure match my Bicep template",
      "Detect infrastructure drift",
      "Check for diagram drift",
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
      // Off-topic
      "What is the weather today?",
      "Help me write a poem",
      "Explain quantum computing",

      // Non-Azure cloud providers
      "Help me with AWS CloudFormation",
      "Design a GCP network topology",

      // Code generation (no drift/comparison intent)
      "Write a TypeScript function to call a REST API",
      "Implement retry logic for my HTTP client",

      // Azure cost management (use azure-cost)
      "How much am I spending on Azure this month?",
      "Show me my Azure billing summary",

      // Service questions that are out of scope for infra drift/sync
      "Troubleshoot cache latency in production",
      "Managed cache pricing options",
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
        extractedKeywords: triggerMatcher.getKeywords(),
      }).toMatchSnapshot();
    });
  });

  describe("Edge Cases", () => {
    test("handles empty prompt", () => {
      const result = triggerMatcher.shouldTrigger("");
      expect(result.triggered).toBe(false);
    });

    test("is case insensitive for skill prompts", () => {
      const lowerCase = triggerMatcher.shouldTrigger("detect infrastructure drift");
      const upperCase = triggerMatcher.shouldTrigger("DETECT INFRASTRUCTURE DRIFT");
      expect(lowerCase.triggered).toBe(upperCase.triggered);
    });
  });
});
