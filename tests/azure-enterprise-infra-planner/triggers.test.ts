/**
 * Trigger Tests for azure-enterprise-infra-planner
 * 
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 */

import { TriggerMatcher } from "../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-enterprise-infra-planner";

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger", () => {
    const shouldTriggerPrompts: string[] = [
      "Provision a classic 3-tier application consisting of IIS web servers, .NET business logic tier, and SQL Server backend, distribute across availability zones for high availability.",
      "Set up a secure multi-region 3-tier stack with Windows VMs for web and app layers, scale out the web tier with Azure Load Balancer, attach Premium Managed Disks to database tier.",
      "Configure a site recovery plan for disaster failover from East to West Azure region, replicate major VM workloads, and automate DNS failbacks.",
      "Provision a jumpbox VM for secure management, establish NSGs for each tier, and connect tiers using internal Azure Load Balancer.",
      "Spin up Linux VMs for each tier using Terraform, automate patch management via Azure Automation, and log traffic between subnets for compliance.",
      "Deploy three distinct VM scale sets for a legacy app, route incoming HTTP/S via Application Gateway with WAF, and encrypt all data disks.",
      "Set up Azure Backup for critical VM workloads, create a long-term retention policy for compliance, and test backup restores quarterly.",
      "Establish disaster recovery for AKS clusters across two Azure regions, replicate persistent storage, and simulate failover on a quarterly basis.",
      "Deploy disaster recovery for VMware VMs using Azure Site Recovery, configure runbooks for smooth failover, and maintain compliance audit trails.",
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
      "Help me write a poem about clouds",
      "Write a Python script to parse CSV files",
      "Help me with AWS Lambda",
      "How do I use Kubernetes on GCP?",
      "Help me write unit tests for my React app",
      "What is the capital of France?",
      "Explain quantum computing",
      "How do I use Google Cloud Platform?",
    ];

    test.each(shouldNotTriggerPrompts)(
      'does not trigger on: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(false);
      }
    );
  });

  describe("Boundary Cases - azure-prepare territory (keyword overlap expected)", () => {
    // NOTE: These app-first prompts DO trigger the keyword matcher because they
    // contain "Azure", "infrastructure", etc. This is expected behavior — the keyword
    // matcher is intentionally broad. Skill disambiguation is handled by the LLM
    // routing layer, not by the trigger matcher. These tests document that overlap.
    const preparePrompts: string[] = [
      "Deploy a stateless REST API in a container image, auto-scale based on HTTP requests, and persist user uploads in Azure Blob Storage using Azure Container Apps.",
      "Launch a serverless web backend with Azure Container Apps, integrate managed Azure PostgreSQL for database, and set up distributed tracing for monitoring transactions.",
      "Set up a staging and production environment for a Python Flask API on ACA, route traffic via Azure Front Door, and implement rollbacks for failed deployments.",
      "Deploy a microservices-based e-commerce backend with independent catalog, order, and payment services, use AKS with Helm for deployments, and implement service mesh for traffic control.",
    ];

    test.each(preparePrompts)(
      'keyword matcher triggers on app-first prompt (expected overlap): "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        // Keyword matcher WILL trigger — this is expected; LLM routing disambiguates
        expect(result.triggered).toBe(true);
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
      const longPrompt = "Azure infrastructure ".repeat(1000);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe("boolean");
    });

    test("is case insensitive", () => {
      const result1 = triggerMatcher.shouldTrigger("plan azure infrastructure");
      const result2 = triggerMatcher.shouldTrigger("PLAN AZURE INFRASTRUCTURE");
      expect(result1.triggered).toBe(result2.triggered);
    });
  });
});
