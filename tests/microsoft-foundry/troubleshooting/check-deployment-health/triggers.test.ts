/**
 * Trigger Tests for check-deployment-health
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
  "../../../../plugin/skills/microsoft-foundry/troubleshooting/check-deployment-health.md"
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

describe("check-deployment-health - Trigger Tests", () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(() => {
    skill = loadTroubleshootingSkill();
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger", () => {
    const shouldTriggerPrompts: string[] = [
      "My deployment is stuck in creating state",
      "Check the health of my Azure OpenAI deployment",
      "My model deployment failed with a provisioning error",
      "The deployment endpoint is not responding",
      "My inference calls are failing on the deployed model",
      "Check deployment status for my Foundry model",
      "My deployment seems degraded with high latency",
      "Is my model deployment healthy?",
      "Deployment monitoring for my Azure OpenAI resource",
      "My model endpoint is down and returning errors",
      "The deployment is stuck and not working",
      "Check if my deployment provisioning succeeded",
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
      "Help me with AWS Lambda",
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
      const longPrompt = "deployment health check ".repeat(100);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe("boolean");
    });

    test("is case insensitive", () => {
      const result1 = triggerMatcher.shouldTrigger("DEPLOYMENT HEALTH CHECK AZURE");
      const result2 = triggerMatcher.shouldTrigger("deployment health check azure");
      expect(result1.triggered).toBe(result2.triggered);
    });
  });
});
