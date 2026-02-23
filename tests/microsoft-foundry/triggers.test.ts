/**
 * Trigger Tests for microsoft-foundry
 * 
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 */

import { TriggerMatcher } from "../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "microsoft-foundry";

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger", () => {
    // Prompts that SHOULD trigger this skill based on frontmatter USE FOR
    const shouldTriggerPrompts: string[] = [
      "How do I deploy an AI model from Microsoft Foundry catalog?",
      "Build a RAG application with Azure AI Foundry knowledge index",
      "Create an AI agent in Microsoft Foundry with web search",
      "Evaluate agent performance using Foundry evaluators",
      "Set up agent monitoring and continuous evaluation in Foundry",
      "Help me with Microsoft Foundry model deployment",
      "How to use knowledge index for RAG in Azure AI Foundry?",
      "Create a new Azure AI Foundry project",
      "Set up a Foundry project for my AI agents",
      "How do I onboard to Microsoft Foundry and create a project?",
      "Provision Foundry infrastructure with azd",
      "I need a new Foundry project to host my models",
    ];

    test.each(shouldTriggerPrompts)(
      'triggers on: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
        // TriggerMatcher uses >= 2 keywords or 20% confidence
        expect(result.matchedKeywords.length).toBeGreaterThanOrEqual(2);
      }
    );
  });

  describe("Should Trigger - RBAC Sub-Skill", () => {
    // RBAC-specific prompts that SHOULD trigger this skill
    const rbacTriggerPrompts: string[] = [
      "Grant Alice role assignment access to my Microsoft Foundry project",
      "Assign Azure AI User role to a user in Foundry",
      "Make Bob a project manager in Azure AI Foundry",
      "Who has role assignment access to my Microsoft Foundry resource?",
      "Audit role assignments on my Foundry account",
      "Can I deploy models to Foundry? Check my permissions",
      "Validate my permissions on the Foundry project",
      "Set up managed identity for my Foundry project",
      "Configure managed identity roles for Storage access",
      "Create a service principal for Foundry CI/CD pipeline",
      "Set up service principal for Microsoft Foundry automation",
      "Assign Azure AI Owner role to developer",
      "List all RBAC assignments on my Foundry resource",
      "Setup developer permissions for Foundry",
    ];

    test.each(rbacTriggerPrompts)(
      'triggers on RBAC prompt: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
        expect(result.matchedKeywords.length).toBeGreaterThanOrEqual(2);
      }
    );
  });

  describe("Should NOT Trigger", () => {
    // Prompts that should NOT trigger - completely unrelated topics
    const shouldNotTriggerPrompts: string[] = [
      "What is the weather today?",
      "Help me write a poem",
      "Explain quantum computing",
      "Help me with AWS SageMaker", // Wrong cloud provider
      "Configure my PostgreSQL database", // Use azure-postgres
      "Help me with Kubernetes pods", // Use azure-aks
      "How do I write Python code?", // Generic programming
      "How do I configure a timer-based cron job in my web app?", // Use azure-functions
      "Host my static website on a cloud platform", // Use azure-create-app
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
      const longPrompt = "Microsoft Foundry ".repeat(100);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe("boolean");
    });

    test("is case insensitive for Foundry mentions", () => {
      const result1 = triggerMatcher.shouldTrigger("Help with MICROSOFT FOUNDRY");
      const result2 = triggerMatcher.shouldTrigger("help with microsoft foundry");
      expect(result1.triggered).toBe(result2.triggered);
    });
  });
});
