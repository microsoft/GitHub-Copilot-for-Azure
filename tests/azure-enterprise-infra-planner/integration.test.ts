/**
 * Integration Tests for azure-enterprise-infra-planner
 * 
 * Tests skill behavior with a real Copilot agent session.
 * Runs prompts to verify skill invocation.
 * 
 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 */

import * as fs from "fs";
import * as path from "path";
import {
  useAgentRunner,
  shouldSkipIntegrationTests,
  getIntegrationSkipReason
} from "../utils/agent-runner";
import { isSkillInvoked, softCheckSkill, getToolCalls, listFilesRecursive } from "../utils/evaluate";

const SKILL_NAME = "azure-enterprise-infra-planner";
const RUNS_PER_PROMPT = 1;
const FOLLOW_UP_PROMPT = ["Go with recommended options. Assume all defaults to make the plan."];

const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

describeIntegration(`${SKILL_NAME}_ - Integration Tests`, () => {
  const agent = useAgentRunner();
  const maxToolCallBeforeTerminate = 3;

  describe("skill-invocation", () => {
    test("invokes skill for hardened 3-tier VM infrastructure prompt", async () => {
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Deploy 3-tier architecture with hardened OS images, VM backups scheduled daily, and application-level redundancy for the business logic tier.",
            nonInteractive: true,
            followUp: FOLLOW_UP_PROMPT,
            shouldEarlyTerminate: (agentMetadata) => isSkillInvoked(agentMetadata, SKILL_NAME) || getToolCalls(agentMetadata).length > maxToolCallBeforeTerminate
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
        } catch (e: unknown) {
          if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
            console.log("⏭️  SDK not loadable, skipping test");
            return;
          }
          throw e;
        }
      }
    });

    test("invokes skill for multi-region DR topology prompt", async () => {
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Configure a site recovery plan for disaster failover from East to West Azure region, replicate major VM workloads, and automate DNS failbacks.",
            nonInteractive: true,
            followUp: FOLLOW_UP_PROMPT,
            shouldEarlyTerminate: (agentMetadata) => isSkillInvoked(agentMetadata, SKILL_NAME) || getToolCalls(agentMetadata).length > maxToolCallBeforeTerminate
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
        } catch (e: unknown) {
          if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
            console.log("⏭️  SDK not loadable, skipping test");
            return;
          }
          throw e;
        }
      }
    });

    test("invokes skill for Terraform IaC generation prompt", async () => {
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Spin up Linux VMs for each tier using Terraform, automate patch management via Azure Automation, and log traffic between subnets for compliance.",
            nonInteractive: true,
            followUp: FOLLOW_UP_PROMPT,
            shouldEarlyTerminate: (agentMetadata) => isSkillInvoked(agentMetadata, SKILL_NAME) || getToolCalls(agentMetadata).length > maxToolCallBeforeTerminate
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
        } catch (e: unknown) {
          if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
            console.log("⏭️  SDK not loadable, skipping test");
            return;
          }
          throw e;
        }
      }
    });

    test("invokes skill for VMSS with WAF and encryption prompt", async () => {
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Deploy three distinct VM scale sets for a legacy app, route incoming HTTP/S via Application Gateway with WAF, and encrypt all data disks.",
            nonInteractive: true,
            followUp: FOLLOW_UP_PROMPT,
            shouldEarlyTerminate: (agentMetadata) => isSkillInvoked(agentMetadata, SKILL_NAME) || getToolCalls(agentMetadata).length > maxToolCallBeforeTerminate
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
        } catch (e: unknown) {
          if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
            console.log("⏭️  SDK not loadable, skipping test");
            return;
          }
          throw e;
        }
      }
    });

    test("invokes skill for backup and compliance prompt", async () => {
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Set up Azure Backup for critical VM workloads, create a long-term retention policy for compliance, and test backup restores quarterly.",
            nonInteractive: true,
            followUp: FOLLOW_UP_PROMPT,
            shouldEarlyTerminate: (agentMetadata) => isSkillInvoked(agentMetadata, SKILL_NAME) || getToolCalls(agentMetadata).length > maxToolCallBeforeTerminate
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
        } catch (e: unknown) {
          if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
            console.log("⏭️  SDK not loadable, skipping test");
            return;
          }
          throw e;
        }
      }
    });

    test("invokes skill for secure multi-region 3-tier prompt", async () => {
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Set up a secure multi-region 3-tier stack with Windows VMs for web and app layers, scale out the web tier with Azure Load Balancer, attach Premium Managed Disks to database tier.",
            nonInteractive: true,
            followUp: FOLLOW_UP_PROMPT,
            shouldEarlyTerminate: (agentMetadata) => isSkillInvoked(agentMetadata, SKILL_NAME) || getToolCalls(agentMetadata).length > maxToolCallBeforeTerminate
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
        } catch (e: unknown) {
          if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
            console.log("⏭️  SDK not loadable, skipping test");
            return;
          }
          throw e;
        }
      }
    });
  });

  describe("response-quality", () => {
    test("generates infrastructure-plan.json with expected resources", async () => {
      let testWorkspacePath: string | undefined;

      const agentMetadata = await agent.run({
        prompt: "Provision a jumpbox VM for secure management, establish NSGs for each tier, and connect tiers using internal Azure Load Balancer. Assume all defaults to make the plan.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT,
        preserveWorkspace: true,
        includeSkills: [SKILL_NAME],
        setup: async (workspace: string) => {
          testWorkspacePath = workspace;
        }
      });

      softCheckSkill(agentMetadata, SKILL_NAME);

      // Verify plan file was created
      expect(testWorkspacePath).toBeDefined();
      const planPath = path.join(testWorkspacePath!, ".azure", "infrastructure-plan.json");
      expect(fs.existsSync(planPath)).toBe(true);

      // Verify plan structure and resources
      const plan = JSON.parse(fs.readFileSync(planPath, "utf-8"));
      expect(plan).toHaveProperty("meta");
      expect(plan).toHaveProperty("plan.resources");
      expect(Array.isArray(plan.plan.resources)).toBe(true);
      expect(plan.plan.resources.length).toBeGreaterThan(0);

      // Should contain networking and compute resources
      const resourceTypes = plan.plan.resources.map((r: { type?: string }) =>
        (r.type || "").toLowerCase()
      );
      const hasNetworking = resourceTypes.some((t: string) =>
        t.includes("virtualnetwork") || t.includes("networksecuritygroup") || t.includes("loadbalancer")
      );
      const hasCompute = resourceTypes.some((t: string) =>
        t.includes("virtualmachine") || t.includes("compute")
      );
      console.log(`📋 Plan has ${plan.plan.resources.length} resources`);
      console.log(`   Networking present: ${hasNetworking}`);
      console.log(`   Compute present: ${hasCompute}`);
    });

    test("generates Bicep files from approved plan", async () => {
      let testWorkspacePath: string | undefined;

      const agentMetadata = await agent.run({
        prompt: "Spin up a policy-driven backup for SAP workloads, ensure encrypted and compressed backups, and provide audit logs for all recovery tests. Assume all defaults to make the plan.",
        nonInteractive: true,
        followUp: [
          ...FOLLOW_UP_PROMPT,
          "Looks good! Let's make Bicep now."
        ],
        preserveWorkspace: true,
        includeSkills: [SKILL_NAME],
        setup: async (workspace: string) => {
          testWorkspacePath = workspace;
          // Pre-create infra/ to guide IaC file placement per skill instructions
          fs.mkdirSync(path.join(workspace, "infra", "modules"), { recursive: true });
        }
      });

      softCheckSkill(agentMetadata, SKILL_NAME);

      // Check for Bicep files under <project-root>/infra/
      expect(testWorkspacePath).toBeDefined();
      const allBicepFiles = listFilesRecursive(testWorkspacePath!).filter(f => f.endsWith(".bicep"));
      const infraDir = path.join(testWorkspacePath!, "infra");
      const infraBicepFiles = allBicepFiles.filter(f =>
        path.normalize(f).startsWith(path.normalize(infraDir))
      );

      console.log(`📋 Found ${allBicepFiles.length} total Bicep files:`);
      allBicepFiles.forEach(f => console.log(`   ${path.relative(testWorkspacePath!, f)}`));

      expect(allBicepFiles.length).toBeGreaterThan(0);

      if (infraBicepFiles.length === 0) {
        const misplaced = allBicepFiles.map(f => path.relative(testWorkspacePath!, f));
        console.warn(`⚠️  Bicep files generated outside infra/: [${misplaced.join(", ")}]. Skill instructs <project-root>/infra/.`);
      } else {
        console.log(`✅ ${infraBicepFiles.length} Bicep file(s) correctly under infra/`);
      }
    });
  });
});
