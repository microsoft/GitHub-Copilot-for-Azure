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
      "AKS egress configuration options",
      
      // Security
      "Configure AKS with workload identity",
      "Set up Azure Policy for AKS",
      "Set up Key Vault CSI driver for AKS",
      "Enable Deployment Safeguards for AKS",
      "How do I secure my AKS cluster?",
      
      // Operations
      "Enable monitoring for my AKS cluster",
      "Configure AKS upgrade strategy",
      "How do I set up AKS autoscaling?",
      "AKS cost analysis",
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

    // Out-of-scope prompts that should route to other skills
    const antiTriggerPrompts: string[] = [
      "Troubleshoot why pods in my AKS cluster are crashlooping"
    ];

    const shouldNotTriggerPrompts = [
      ...genericPrompts,
      ...otherCloudPrompts,
      ...genericInfraPrompts,
      ...antiTriggerPrompts,
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
