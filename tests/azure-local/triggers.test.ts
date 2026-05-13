/**
 * Trigger Tests for azure-local
 *
 * Tests that verify the skill triggers on Azure Local prompts
 * and does NOT trigger on unrelated public Azure or non-Azure prompts.
 */

import { TriggerMatcher } from "../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-local";

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger", () => {
    const shouldTriggerPrompts: string[] = [
      "Plan an Azure Local deployment",
      "What are the prerequisites for Azure Stack HCI?",
      "Troubleshoot Azure Local deployment failure",
      "Check Azure Local update readiness",
      "How do I manage an Azure Local VM?",
      "Create an Arc VM on Azure Local",
      "Set up AKS on Azure Local",
      "Help with AKS hybrid cluster networking",
      "Configure SDN for Azure Local",
      "Troubleshoot Arc resource bridge for Azure Local",
      "Inventory Microsoft.AzureStackHCI clusters with Azure Resource Graph",
      "How do I use Lifecycle Manager for Azure Local?",
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
      "Describe my AWS S3 buckets",
      "Create a standard Azure VM in eastus",
      "Recommend a VM size for my public Azure workload",
      "List my Azure storage accounts",
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

    test("handles mixed case Azure Local prompt", () => {
      const result = triggerMatcher.shouldTrigger("TROUBLESHOOT AZURE LOCAL UPDATE FAILURE");
      expect(result.triggered).toBe(true);
    });

    test("handles very long prompt", () => {
      const longPrompt = "Azure Local update ".repeat(100);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe("boolean");
    });
  });
});
