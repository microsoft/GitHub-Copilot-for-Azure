/**
 * Trigger Tests for k8s-to-container-apps
 * 
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 */

import { TriggerMatcher } from "../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "k8s-to-container-apps";

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger", () => {
    const shouldTriggerPrompts: string[] = [
      "migrate Kubernetes to Container Apps",
      "convert k8s manifests to Azure Container Apps",
      "move from GKE to Azure Container Apps",
      "migrate from EKS to Azure Container Apps",
      "migrate k8s deployments to Azure",
      "k8s to ACA migration assessment",
      "convert my Kubernetes deployment to Container Apps",
      "I want to migrate my GKE workload to Azure",
      "help me move from Kubernetes to Container Apps",
      "assess my k8s cluster for Container Apps migration",
    ];

    test.each(shouldTriggerPrompts)(
      'triggers on: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
        // Note: Confidence scores may be lower due to complex description
        // but the matcher should still identify these as valid triggers
      }
    );
  });

  describe("Should NOT Trigger", () => {
    const shouldNotTriggerPrompts: string[] = [
      "What is the weather today?",
      "Help me write a poem",
      "How do I write a Python function?",
      "Explain quantum computing",
      "What is the capital of France?",
      "Debug my JavaScript code",
    ];

    test.each(shouldNotTriggerPrompts)(
      'does NOT trigger on: "%s"',
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

  describe("Trigger Configuration", () => {
    test("has clear activation triggers in description", () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).toContain("migrate");
      expect(description).toContain("kubernetes");
      expect(description).toContain("container apps");
    });

    test("includes DO NOT USE FOR clause", () => {
      const description = skill.metadata.description;
      expect(description).toContain("DO NOT USE FOR");
    });
  });
});
