/**
 * Trigger Tests for azure-kubernetes
 *
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 *
 * Uses snapshot testing + parameterized tests for comprehensive coverage.
 */

import { TriggerMatcher } from "../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-kubernetes";

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger", () => {
    // Prompts that SHOULD trigger this skill - include multiple keywords
    const shouldTriggerPrompts: string[] = [
      "Create an Azure Kubernetes cluster for production",
      "Set up AKS cluster with Azure networking",
      "Configure Azure AKS cluster autoscaling",
      "Plan Azure Kubernetes workload identity setup",
      "Azure AKS Automatic vs Standard cluster",
      "Set up Azure Kubernetes monitoring with Prometheus",
      "Configure Azure AKS deployment safeguards",
      "Azure Kubernetes cluster upgrade strategy",
    ];

    test.each(shouldTriggerPrompts)('triggers on: "%s"', (prompt) => {
      const result = triggerMatcher.shouldTrigger(prompt);
      expect(result.triggered).toBe(true);
    });
  });

  describe("Should NOT Trigger", () => {
    // Prompts that should NOT trigger this skill (avoid Azure/kubernetes/AKS keywords)
    const shouldNotTriggerPrompts: string[] = [
      "What is the weather today?",
      "Help me write a poem",
      "Explain quantum computing",
      "Help me with AWS EKS",
      "How do I use Google GKE?",
      "Write a Python script to parse JSON",
      "What is the capital of France?",
      "Configure my local Docker container",
      "Set up PostgreSQL database locally",
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
      const longPrompt = "AKS cluster Azure ".repeat(1000);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe("boolean");
    });

    test("is case insensitive", () => {
      const result1 = triggerMatcher.shouldTrigger("azure kubernetes cluster");
      const result2 = triggerMatcher.shouldTrigger("AZURE KUBERNETES CLUSTER");
      expect(result1.triggered).toBe(result2.triggered);
    });
  });
});

