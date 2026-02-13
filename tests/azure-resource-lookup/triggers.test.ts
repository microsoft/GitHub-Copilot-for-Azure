/**
 * Trigger Tests for azure-resource-lookup
 * 
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 *
 * Trigger prompts sourced from Azure MCP Server README examples
 * and real-world ARG use cases.
 */

import { TriggerMatcher } from "../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-resource-lookup";

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger", () => {
    const shouldTriggerPrompts: string[] = [
      // Simple resource listing (MCP Server README prompts)
      "List the websites in my subscription",
      "Show me the websites in my resource group",
      "List all virtual machines in my subscription",
      "Show me all VMs in resource group 'my-rg'",
      "List my Azure storage accounts",
      "List all my Azure Container Registries",
      "List the container apps in my subscription",
      "Show me the container apps in my resource group",

      // Generic resource queries
      "What resources do I have across all my subscriptions?",
      "Show me all my Azure resources",
      "List all resources in my subscription",
      "Show me my resources in this resource group",
      "Give me a resource inventory of my Azure environment",

      // Orphaned resource discovery
      "Find orphaned disks in my subscription",
      "List unattached managed disks",
      "Show me orphaned network interfaces",
      "Find orphaned resources I can clean up",

      // Tag and compliance queries
      "Find resources missing required tags",
      "Show me resources without the Environment tag",
      "Tag coverage analysis across my subscription",

      // Cross-subscription / ARG-specific
      "How many resources do I have by type?",
      "Count resources by type across all subscriptions",
      "Show me resources by location across subscriptions",
      "Find all VMs across all my subscriptions",

      // Cross-cutting lookups
      "Find resources with public network access enabled",
      "Find resources in a failed provisioning state",
      "What resources are unhealthy?",

      // Explicit ARG references
      "Query my Azure resources using Resource Graph",
      "Run an Azure Resource Graph query",
      "Search for resources across my Azure environment",
    ];

    test.each(shouldTriggerPrompts)(
      "triggers on: \"%s\"",
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
      }
    );
  });

  describe("Should NOT Trigger", () => {
    const shouldNotTriggerPrompts: string[] = [
      // Non-Azure topics
      "What is the weather today?",
      "Help me write a poem",
      "Explain quantum computing",
      "How do I bake a cake?",

      // Other cloud providers (no Azure keywords)
      "Describe my AWS S3 buckets",
      "Check my AWS Lambda functions",
      "Show my DigitalOcean droplets",

      // Cost optimization (use azure-cost-optimization)
      "Optimize my cloud spending",
      "Reduce my monthly bill",

      // Deployment (use azure-deploy)
      "Deploy this app to production",
      "Provision new infrastructure",

      // Code generation
      "Write a Python sorting algorithm",
      "Fix the null pointer exception",
      "Debug this JavaScript error",

      // Other Azure operations (not listing)
      "Generate a Bicep template",
      "Configure RBAC permissions",
    ];

    test.each(shouldNotTriggerPrompts)(
      "does not trigger on: \"%s\"",
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
      const longPrompt = "Azure resources query ".repeat(100);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe("boolean");
    });

    test("is case insensitive", () => {
      const result1 = triggerMatcher.shouldTrigger("find resources across subscriptions");
      const result2 = triggerMatcher.shouldTrigger("FIND RESOURCES ACROSS SUBSCRIPTIONS");
      expect(result1.triggered).toBe(result2.triggered);
    });
  });
});
