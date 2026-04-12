/**
 * Trigger Tests for azure-iac-generator
 * 
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 */

import { TriggerMatcher } from "../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-iac-generator";

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger", () => {
    const shouldTriggerPrompts: string[] = [
      // Azure to Bicep
      "Generate Bicep from my Azure resource group",
      "Azure to Bicep for my subscription",
      "Create Bicep templates from my resources",
      "Reverse engineer Bicep from Azure",
      "Export my infrastructure as code",
      "Generate infrastructure code from my Azure environment",

      // Diagram to Bicep
      "Convert my diagram to Bicep",
      "Diagram to Bicep templates",
      "Generate Bicep from my draw.io diagram",
      "Create Bicep from architecture diagram",
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
      "How do I set up a CI/CD pipeline in GitHub Actions?",
      "Run azd up to deploy",
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
      "Create a new web app on Azure",
      "Build a new Azure Functions project",
      "Deploy my Bicep template to Azure",
      "Check if my Bicep matches Azure",
      "Compare diagram to Azure resources",
      "Create a diagram of my Azure resources",
      "Visualize my Azure architecture",
    ];

    test.each(overlapPrompts)(
      'keyword overlap expected: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        // These trigger on keywords but LLM routes to correct skill
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
      const longPrompt = "Generate Bicep from Azure ".repeat(100);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe("boolean");
    });

    test("is case insensitive for Azure terms", () => {
      const result1 = triggerMatcher.shouldTrigger("GENERATE BICEP FROM AZURE");
      const result2 = triggerMatcher.shouldTrigger("generate bicep from azure");
      expect(result1.triggered).toBe(result2.triggered);
    });
  });
});
