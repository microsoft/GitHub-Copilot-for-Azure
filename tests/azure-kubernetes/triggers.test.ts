/**
 * Trigger Tests for azure-kubernetes
 *
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
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
    // Common customer prompts for AKS cluster planning and creation
    const shouldTriggerPrompts: string[] = [
      // Cluster creation
      "Help me create an AKS cluster",
      "I need to set up a new Kubernetes cluster on Azure",
      "Create a production-ready AKS cluster with best practices",
      "How do I provision an AKS cluster for my team?",

      // Day-0 decisions
      "What networking options should I choose for AKS?",
      "AKS Day-0 checklist",
      "Plan AKS configuration for production",
      "Design AKS networking with private API server",

      // SKU selection
      "What's the difference between AKS Automatic and Standard?",
      "Should I use AKS Automatic or Standard SKU?",
      "Help me choose the right AKS cluster SKU",

      // Networking
      "Configure AKS with Azure CNI Overlay",
      "How do I set up private AKS cluster?",
      "Configure AKS cluster egress networking",

      // Security
      "Configure AKS with workload identity",
      "Set up Azure Policy for AKS",
      "Set up AKS security with Key Vault secrets",
      "Enable Deployment Safeguards for AKS",
      "How do I secure my AKS cluster?",

      // Operations
      "Enable monitoring for my AKS cluster",
      "Configure AKS upgrade strategy",
      "How do I configure AKS cluster autoscaling?",
      "Plan AKS cluster cost controls",
      "Configure AKS cluster autoscaling and node pools",
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
    // Generic prompts unrelated to Azure/Kubernetes
    const genericPrompts: string[] = [
      "What is the weather today?",
      "Help me write a poem",
      "Explain quantum computing",
      "Write a Python script to parse JSON",
      "How do I bake a cake?",
    ];

    // Competing cloud providers (without "AKS" or "Azure" keywords)
    const otherCloudPrompts: string[] = [
      "How do I use AWS EKS?",
      "Help me with GCP GKE",
      "Help me with AWS Lambda",
      "How do I use Google Cloud Platform?",
      "Set up EC2 instances",
      "Configure S3 bucket policies",
    ];

    // Generic infrastructure prompts (without Azure keywords)
    const genericInfraPrompts: string[] = [
      "Set up a PostgreSQL database",
      "Configure nginx load balancer",
      "How do I use Docker Compose?",
      "Set up Redis caching",
      "Configure SSL certificates",
    ];

    // AKS-adjacent prompts that should route to other Azure skills
    // Note: prompts with "AKS" + another skill keyword may still match
    // the keyword trigger; the DO NOT USE FOR clause handles LLM routing
    const aksAdjacentPrompts: string[] = [
      // Debugging → azure-diagnostics
      "Debug AKS pod crashloop",
      "My AKS pods are failing health checks",
      "Why is my container image pull failing?",
      // Deploying apps → azure-deploy
      "Deploy my application to AKS",
      "Roll out a new version of my app on AKS",
      // Monitoring/queries → azure-kusto
      "Write a KQL query for AKS container logs",
      "Query AKS cluster metrics in Log Analytics",
      // General tooling
      "Help me write a Helm chart for my app",
    ];

    const shouldNotTriggerPrompts = [
      ...genericPrompts,
      ...otherCloudPrompts,
      ...genericInfraPrompts,
      ...aksAdjacentPrompts,
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
    test("handles mixed case input", () => {
      const result = triggerMatcher.shouldTrigger("CREATE AN AKS CLUSTER");
      expect(result.triggered).toBe(true);
    });

    test("handles partial matches", () => {
      const result = triggerMatcher.shouldTrigger("kubernetes on azure");
      expect(result.triggered).toBe(true);
    });

    test("handles empty prompt", () => {
      const result = triggerMatcher.shouldTrigger("");
      expect(result.triggered).toBe(false);
    });
  });
});
