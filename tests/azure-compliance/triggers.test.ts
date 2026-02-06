/**
 * Trigger Tests for azure-compliance
 * 
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 */

import { TriggerMatcher } from "../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-compliance";

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger", () => {
    const shouldTriggerPrompts: string[] = [
      // Comprehensive compliance assessment prompts
      "Run azqr to check Azure compliance",
      "Check my Azure subscription for compliance issues",
      "Perform compliance assessment using Azure Quick Review",
      "Assess my Azure resources against best practices",
      "Review my Azure security posture",
      "Run compliance scan on my Azure subscription",
      "Identify orphaned resources in Azure",
      "Find resources that don't comply with best practices",
      
      // Key Vault expiration audit prompts
      "Show me expired certificates in my Key Vault",
      "Check what secrets are expiring in the next 30 days",
      "Audit my Key Vault for compliance",
      "Find secrets without expiration dates",
      "Generate a security report for my Key Vault",
      "Which keys have expired in production Key Vault?",
      "Check certificate expiration dates in my vault",
      "List expiring secrets and keys in Azure Key Vault",
      
      // Combined assessment prompts
      "Run a full compliance scan including Key Vault expiration checks",
      "Audit my Azure environment for security and compliance",
      "Check for best practice violations and expiring credentials",
      "Perform comprehensive Azure compliance assessment",
      "Run security audit on Azure resources and Key Vault",
    ];

    test.each(shouldTriggerPrompts)(
      'triggers on: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
        // Trigger matcher requires >= 2 keywords or >= 20% confidence
        expect(result.matchedKeywords.length).toBeGreaterThanOrEqual(2);
      }
    );
  });

  describe("Should NOT Trigger", () => {
    // Prompts that should NOT trigger - avoid matching >= 2 keywords
    const shouldNotTriggerPrompts: string[] = [
      "What is the weather today?",
      "Help me write a poem",
      "Explain quantum computing",
      "Help me with AWS Lambda functions",
      "Write a Python script",
      "How do I use Docker?",
      "Set up a database connection",
      "Configure networking for my web app",
      "How do I create a React component?",
      "Optimize my website performance",
      "Build a REST API",
      "Debug my Node.js application",
      "Install Node packages",
      "Configure Git repository",
      "Write unit tests for my code",
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
      const longPrompt = "Azure compliance assessment ".repeat(100);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe("boolean");
    });

    test("is case insensitive", () => {
      const result1 = triggerMatcher.shouldTrigger("RUN AZURE COMPLIANCE SCAN");
      const result2 = triggerMatcher.shouldTrigger("run azure compliance scan");
      expect(result1.triggered).toBe(result2.triggered);
    });
  });
});
