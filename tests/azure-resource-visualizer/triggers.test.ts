/**
 * Trigger Tests for azure-resource-visualizer
 * 
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 * 
 * Uses snapshot testing + parameterized tests for comprehensive coverage.
 */

import { TriggerMatcher } from "../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-resource-visualizer";

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger", () => {
    // Parameterized tests - prompts that SHOULD trigger this skill
    const shouldTriggerPrompts: string[] = [
      // Architecture diagram requests
      "Create an architecture diagram for my Azure resource group",
      "Generate a Mermaid diagram of my resource group",
      
      // Visualization requests
      "Visualize my Azure resources",
      "Visualize the architecture of my Azure resources",
      "Architecture visualization for my Azure infrastructure",
      
      // Relationship mapping
      "Show me the relationships between my Azure resources",
      "Show resource relationships",
      "How are my Azure resources connected?",
      
      // Resource group analysis
      "Analyze my resource group",
      "Analyze resource group architecture",
      
      // Diagram generation
      "Diagram my Azure resources",
      "Generate Mermaid diagram",
      "Create a diagram showing my resources",
      
      // Topology and infrastructure mapping
      "Show the resource topology",
      "Map my Azure infrastructure",
      "Map Azure resources",
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
    // Parameterized tests - prompts that should NOT trigger this skill
    const shouldNotTriggerPrompts: string[] = [
      // Non-Azure topics
      "What is the weather today?",
      "Help me write a poem",
      "Explain quantum computing",
      
      // Resource creation/modification (use azure-deploy)
      "Create a web app",
      "Deploy my application",
      "Provision new infrastructure",
      
      // Cost analysis (use azure-cost-estimation)
      "What will my costs be?",
      "Analyze my spending",
      "How much does this cost?",
      
      // Security scanning (use azure-security)
      "Scan for security vulnerabilities",
      "Audit my security posture",
      "Check for security issues",
      
      // Performance troubleshooting (use azure-diagnostics)
      "Why is my app slow?",
      "Diagnose performance problems",
      "Troubleshoot my application",
      
      // Code generation (use service-specific skills)
      "Write a Python function",
      "Implement a REST API",
      "Create a REST API handler",
      
      // Non-Azure cloud providers
      "Help me with AWS CloudFormation",
      "Design GCP infrastructure",
      "Create Kubernetes deployment",
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
      // This snapshot helps detect unintended changes to trigger behavior
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
      const longPrompt = "Azure architecture diagram ".repeat(100);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      // Should not throw, may or may not trigger
      expect(typeof result.triggered).toBe("boolean");
    });

    test("is case insensitive", () => {
      const lowerCase = triggerMatcher.shouldTrigger("create architecture diagram for azure");
      const upperCase = triggerMatcher.shouldTrigger("CREATE ARCHITECTURE DIAGRAM FOR AZURE");
      // Both should trigger or both should not trigger
      expect(lowerCase.triggered).toBe(upperCase.triggered);
    });
  });
});
