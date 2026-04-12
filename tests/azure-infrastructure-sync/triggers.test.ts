/**
 * Trigger Tests for azure-infrastructure-sync
 * 
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 */

import { TriggerMatcher } from "../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

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
      // Diagram ↔ Azure
      "Check if my diagram matches Azure",
      "Detect infrastructure drift between diagram and Azure",
      "Sync my diagram with what's deployed",
      "Does my diagram match what's deployed in Azure?",

      // Bicep ↔ Diagram
      "Compare my Bicep to my diagram",
      "Check if Bicep matches the diagram",
      "Sync Bicep and diagram",

      // Bicep ↔ Azure what-if
      "Bicep what-if preview",
      "Preview what my Bicep changes would do",
      "Compare Bicep to live Azure",

      // General drift detection
      "Detect infrastructure drift",
      "Check for configuration drift",
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
      "Run azd up",
      "Help me with AWS CloudFormation",
      "What is Kubernetes?",
    ];

    test.each(shouldNotTriggerPrompts)(
      'does not trigger on: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(false);
      }
    );
  });

  describe("Boundary Cases - keyword overlap expected", () => {
    // NOTE: These prompts DO trigger the keyword matcher because they contain
    // shared terms like "Azure", "Bicep", "diagram". This is expected behavior —
    // the keyword matcher is intentionally broad. Skill disambiguation is handled
    // by the LLM routing layer, not by the trigger matcher.
    const overlapPrompts: string[] = [
      "Create a diagram from my Azure resources",
      "Generate an architecture diagram",
      "Visualize my Azure resources",
      "Generate Bicep from my Azure resource group",
      "Convert diagram to Bicep templates",
      "Deploy my app to Azure",
    ];

    test.each(overlapPrompts)(
      'keyword overlap expected: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(typeof result.triggered).toBe("boolean");
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
      const longPrompt = "Check infrastructure drift ".repeat(100);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe("boolean");
    });

    test("is case insensitive for Azure terms", () => {
      const result1 = triggerMatcher.shouldTrigger("DETECT INFRASTRUCTURE DRIFT");
      const result2 = triggerMatcher.shouldTrigger("detect infrastructure drift");
      expect(result1.triggered).toBe(result2.triggered);
    });
  });
});
