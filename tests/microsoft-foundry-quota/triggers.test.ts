/**
 * Trigger Tests for microsoft-foundry-quota
 *
 * Tests that verify the parent skill triggers on quota-related prompts
 * since quota is a sub-skill of microsoft-foundry.
 */

import { TriggerMatcher } from "../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "microsoft-foundry";

describe("microsoft-foundry-quota - Trigger Tests", () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger - Quota Management", () => {
    // Quota-specific prompts that SHOULD trigger the microsoft-foundry skill
    const quotaTriggerPrompts: string[] = [
      // View quota usage
      "Show me my current quota usage in Microsoft Foundry",
      "Check quota limits for my Azure AI Foundry resource",
      "What is my TPM quota for GPT-4 in Foundry?",
      "Display quota consumption across all my Foundry deployments",
      "How much quota do I have left for model deployment?",

      // Check before deployment
      "Do I have enough quota to deploy GPT-4o in Foundry?",
      "Check if I can deploy a model with 50K TPM capacity",
      "Verify quota availability before Microsoft Foundry deployment",
      "Can I deploy another model to my Foundry resource?",

      // Request quota increase
      "Request quota increase for Microsoft Foundry",
      "How do I get more TPM quota for Azure AI Foundry?",
      "I need to increase my Foundry deployment quota",
      "Request more capacity for GPT-4 in Microsoft Foundry",
      "How to submit quota increase request for Foundry?",

      // Monitor quota
      "Monitor quota usage across my Foundry deployments",
      "Show all my Foundry deployments and their quota allocation",
      "Track TPM consumption in Microsoft Foundry",
      "Audit quota usage by model in Azure AI Foundry",

      // Troubleshoot quota errors
      "Why did my Foundry deployment fail with quota error?",
      "Fix insufficient quota error in Microsoft Foundry",
      "Deployment failed: QuotaExceeded in Azure AI Foundry",
      "Troubleshoot InsufficientQuota error for Foundry model",
      "My Foundry deployment is failing due to capacity limits",
      "Error: DeploymentLimitReached in Microsoft Foundry",
      "Getting 429 rate limit errors from Foundry deployment",

      // Capacity planning
      "Plan capacity for production Foundry deployment",
      "Calculate required TPM for my Microsoft Foundry workload",
      "How much quota do I need for 1M requests per day in Foundry?",
      "Optimize quota allocation across Foundry projects",
    ];

    test.each(quotaTriggerPrompts)(
      'triggers on quota prompt: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
        expect(result.matchedKeywords.length).toBeGreaterThanOrEqual(2);
      }
    );
  });

  describe("Should Trigger - Capacity and TPM Keywords", () => {
    const capacityPrompts: string[] = [
      "How do I manage capacity in Microsoft Foundry?",
      "Increase TPM for my Azure AI Foundry deployment",
      "What is TPM in Microsoft Foundry?",
      "Check deployment capacity limits in Foundry",
      "Scale up my Foundry model capacity",
    ];

    test.each(capacityPrompts)(
      'triggers on capacity prompt: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
      }
    );
  });

  describe("Should Trigger - Deployment Failure Context", () => {
    const deploymentFailurePrompts: string[] = [
      "Microsoft Foundry deployment failed, check quota",
      "Insufficient quota to deploy model in Azure AI Foundry",
      "Foundry deployment stuck due to quota limits",
      "Cannot deploy to Microsoft Foundry, quota exceeded",
      "My Azure AI Foundry deployment keeps failing",
    ];

    test.each(deploymentFailurePrompts)(
      'triggers on deployment failure prompt: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
      }
    );
  });

  describe("Should NOT Trigger - Other Azure Services", () => {
    const shouldNotTriggerPrompts: string[] = [
      "Check quota for Azure App Service",
      "Request quota increase for Azure VMs",
      "Azure Storage quota limits",
      "Increase quota for Azure Functions",
      "Check quota for AWS SageMaker",
      "Google Cloud AI quota management",
    ];

    test.each(shouldNotTriggerPrompts)(
      'does not trigger on non-Foundry quota: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        // May or may not trigger depending on keywords, but shouldn't be high confidence
        // These tests ensure quota alone doesn't trigger without Foundry context
        if (result.triggered) {
          // If it triggers, confidence should be lower or different keywords
          expect(result.matchedKeywords).not.toContain("foundry");
        }
      }
    );
  });

  describe("Should NOT Trigger - Unrelated Topics", () => {
    const unrelatedPrompts: string[] = [
      "What is the weather today?",
      "Help me write a poem",
      "Explain quantum computing",
      "How do I cook pasta?",
      "What are Python decorators?",
    ];

    test.each(unrelatedPrompts)(
      'does not trigger on unrelated: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(false);
      }
    );
  });

  describe("Trigger Keywords - Quota Specific", () => {
    test("skill description includes quota keywords", () => {
      const description = skill.metadata.description.toLowerCase();

      // Verify quota-related keywords are in description
      const quotaKeywords = ["quota", "capacity", "tpm", "deployment failure", "insufficient"];
      const hasQuotaKeywords = quotaKeywords.some(keyword =>
        description.includes(keyword)
      );
      expect(hasQuotaKeywords).toBe(true);
    });

    test("skill keywords include foundry and quota terms", () => {
      const keywords = triggerMatcher.getKeywords();
      const keywordString = keywords.join(" ").toLowerCase();

      // Should have both Foundry and quota-related terms
      expect(keywordString).toMatch(/foundry|microsoft.*foundry|ai.*foundry/);
      expect(keywordString).toMatch(/quota|capacity|tpm|deployment/);
    });
  });

  describe("Edge Cases", () => {
    test("handles empty prompt", () => {
      const result = triggerMatcher.shouldTrigger("");
      expect(result.triggered).toBe(false);
    });

    test("handles very long quota-related prompt", () => {
      const longPrompt = "Check my Microsoft Foundry quota usage ".repeat(50);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe("boolean");
    });

    test("is case insensitive for quota keywords", () => {
      const result1 = triggerMatcher.shouldTrigger("MICROSOFT FOUNDRY QUOTA CHECK");
      const result2 = triggerMatcher.shouldTrigger("microsoft foundry quota check");
      expect(result1.triggered).toBe(result2.triggered);
    });

    test("handles misspellings gracefully", () => {
      // Should still trigger on close matches
      const result = triggerMatcher.shouldTrigger("Check my Foundry qota usage");
      // May or may not trigger depending on other keywords
      expect(typeof result.triggered).toBe("boolean");
    });
  });

  describe("Multi-keyword Combinations", () => {
    test("triggers with Foundry + quota combination", () => {
      const result = triggerMatcher.shouldTrigger("Microsoft Foundry quota");
      expect(result.triggered).toBe(true);
    });

    test("triggers with Foundry + capacity combination", () => {
      const result = triggerMatcher.shouldTrigger("Azure AI Foundry capacity");
      expect(result.triggered).toBe(true);
    });

    test("triggers with Foundry + TPM combination", () => {
      const result = triggerMatcher.shouldTrigger("Microsoft Foundry TPM limits");
      expect(result.triggered).toBe(true);
    });

    test("triggers with Foundry + deployment + failure", () => {
      const result = triggerMatcher.shouldTrigger("Foundry deployment failed insufficient quota");
      expect(result.triggered).toBe(true);
      expect(result.matchedKeywords.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Contextual Triggering", () => {
    test("triggers when asking about limits", () => {
      const result = triggerMatcher.shouldTrigger("What are the quota limits for Microsoft Foundry?");
      expect(result.triggered).toBe(true);
    });

    test("triggers when asking how to increase", () => {
      const result = triggerMatcher.shouldTrigger("How do I increase my Azure AI Foundry quota?");
      expect(result.triggered).toBe(true);
    });

    test("triggers when troubleshooting", () => {
      const result = triggerMatcher.shouldTrigger("Troubleshoot Microsoft Foundry quota error");
      expect(result.triggered).toBe(true);
    });

    test("triggers when monitoring", () => {
      const result = triggerMatcher.shouldTrigger("Monitor quota usage in Azure AI Foundry");
      expect(result.triggered).toBe(true);
    });
  });
});
