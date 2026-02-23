/**
 * Trigger Tests for check-model-availability
 * 
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import matter from "gray-matter";
import { TriggerMatcher } from "../../../utils/trigger-matcher";
import { LoadedSkill } from "../../../utils/skill-loader";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SKILL_FILE = path.resolve(
  __dirname,
  "../../../../plugin/skills/microsoft-foundry/troubleshooting/check-model-availability.md"
);

function loadTroubleshootingSkill(): LoadedSkill {
  const fileContent = fs.readFileSync(SKILL_FILE, "utf-8");
  const { data: metadata, content } = matter(fileContent);
  return {
    metadata: {
      name: metadata.name as string,
      description: metadata.description as string,
      ...metadata,
    },
    content: content.trim(),
    path: path.dirname(SKILL_FILE),
    filePath: SKILL_FILE,
  };
}

describe("check-model-availability - Trigger Tests", () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(() => {
    skill = loadTroubleshootingSkill();
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger", () => {
    const shouldTriggerPrompts: string[] = [
      "Is the GPT-4o model available in the West Europe region?",
      "Which regions have GPT-4 model available?",
      "Check model availability for my Azure OpenAI deployment",
      "Model not found error when deploying to eastus",
      "Can I deploy GPT-4o in my region?",
      "What regions support the model I need?",
      "SKU not available error for my model deployment",
      "Check if a model version is available in my region",
      "Compare model availability across Azure regions",
      "Where can I deploy the GPT-4 model?",
      "Capacity check for model deployment in eastus2",
      "My model deployment failed because the model is not supported in this region",
    ];

    test.each(shouldTriggerPrompts)(
      'triggers on: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
        expect(result.matchedKeywords.length).toBeGreaterThanOrEqual(2);
      }
    );
  });

  describe("Should NOT Trigger", () => {
    const shouldNotTriggerPrompts: string[] = [
      "What is the weather today?",
      "Help me write a poem",
      "Explain quantum computing",
      "Help me with AWS SageMaker",
      "Configure my PostgreSQL database",
      "How do I write Python code?",
      "Help me with Kubernetes pods",
      "Set up a virtual network in Azure",
      "Create a new storage account",
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

    test("handles very long prompt", () => {
      const longPrompt = "model availability region ".repeat(100);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe("boolean");
    });

    test("is case insensitive", () => {
      const result1 = triggerMatcher.shouldTrigger("MODEL AVAILABILITY IN AZURE REGION");
      const result2 = triggerMatcher.shouldTrigger("model availability in azure region");
      expect(result1.triggered).toBe(result2.triggered);
    });
  });
});
