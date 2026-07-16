/**
 * Trigger Tests for azure-iac-security
 *
 * Tests that verify the skill triggers on appropriate pre-deployment
 * IaC security prompts and does NOT trigger on unrelated prompts.
 *
 * Note: nuanced routing-boundary cases (runtime compliance vs. pre-deployment,
 * deploy-readiness vs. security scan) are validated by the vally eval suite in
 * evals/azure-iac-security/eval.yaml, which exercises the real router. This
 * lightweight keyword matcher only asserts coarse trigger/no-trigger behavior.
 */

import { TriggerMatcher } from "../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-iac-security";

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger", () => {
    const shouldTriggerPrompts: string[] = [
      // ARM template scanning
      "Scan this ARM template for security issues before I deploy",
      "Find security misconfigurations in my ARM template",
      "Pre-deployment security review of my ARM JSON",
      "Harden my ARM template before deployment",
      // Bicep scanning
      "Check my Bicep for security misconfigurations",
      "Check my Bicep template for MCSB compliance before deploy",
      "Review my Bicep for public network access before deploying",
      // Terraform scanning
      "Review my Terraform for security vulnerabilities before deploying",
      "Analyze my Terraform azurerm configuration for insecure settings",
      "Validate security controls in my Terraform before Azure deployment",
      // MCSB / benchmark
      "Scan my Azure IaC against MCSB v3.0",
      "Check my infrastructure code against the Microsoft cloud security benchmark",
      // General pre-deployment IaC security
      "Is my Azure IaC secure before deployment?",
      "Static security analysis of my Azure infrastructure code",
      "Scan my infrastructure code for hardcoded secrets before deploy",
      "Check my template for insecure protocols before deploying",
      // MITRE attack paths
      "Generate MITRE ATT&CK attack paths from my IaC security findings",
      // AI-workload IaC
      "Check my Azure OpenAI Bicep for security before deploy",
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
      "What is the best pizza topping?",
      "Help me name my pet cat",
      "Summarize the plot of this movie",
      "Help me with AWS CloudFormation", // Wrong cloud provider, no shared keywords
      // Note: adjacent-Azure prompts such as "Audit my deployed storage account
      // for compliance against Azure Security Benchmark" (runtime compliance ->
      // azure-compliance) and "Will my ARM template deploy successfully?"
      // (deploy-readiness -> azure-validate) intentionally fire this coarse
      // keyword matcher because they share terms (azure/storage/security/scan).
      // That nuanced routing boundary is validated by the real router via the
      // `disallowed` stimuli in evals/azure-iac-security/eval.yaml, matching the
      // documented convention in tests/azure-compute/triggers.test.ts.
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
      const longPrompt = "Scan my Bicep IaC for Azure security ".repeat(100);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe("boolean");
    });

    test("is case insensitive for Azure terms", () => {
      const result1 = triggerMatcher.shouldTrigger("SCAN MY BICEP FOR AZURE SECURITY");
      const result2 = triggerMatcher.shouldTrigger("scan my bicep for azure security");
      expect(result1.triggered).toBe(result2.triggered);
    });
  });
});
