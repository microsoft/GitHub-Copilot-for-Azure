/**
 * Integration Tests — Prepare Phase Depth
 *
 * Validates prepare-plan.json schema compliance, quota validation evidence,
 * naming patterns, IaC format selection, and cost estimation quality.
 *
 * Covers: prepare-plan schema validation, user override / Terraform path,
 * and additional prepare-phase regression scenarios.
 */

import {
  isSkillInvoked,
  softCheckSkill,
  withTestResult,
  getAllAssistantMessages,
  doesAssistantOrToolsIncludeKeyword,
} from "../../utils/evaluate";
import { cloneRepo } from "../../utils/git-clone";
import {
  describeAppOnboard,
  SKILL_NAME,
  prepareTestTimeoutMs,
  shouldEarlyTerminateForApprovalGate,
  assertSessionFileCreated,
  assertPreparePlanSchema,
  readSessionArtifact,
  SUBSCRIPTION_PRIMER,
} from "../app-onboard-test-helpers";

describeAppOnboard("Prepare Depth Tests", (agent) => {
  describe("prepare-plan-schema", () => {
    test("prepare-plan.json has valid schema for broken-todo-demo Express app", async () => {
      await withTestResult(async () => {
        let workspacePath = "";
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
            await cloneRepo({
              repoUrl: "https://github.com/Arun07AK/broken-todo-demo",
              targetDir: workspace,
              branch: "main",
              depth: 1,
            });
          },
          prompt: "I built a side project and want to get it live on Azure",
          followUp: [
            SUBSCRIPTION_PRIMER,
            "Yes.",
            "Yes.",
            "Yes.",
            "Yes.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateForApprovalGate,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        // Hard: prepare-plan.json must exist and have valid schema
        if (workspacePath) {
          assertPreparePlanSchema(agentMetadata, workspacePath);

          // Validate specific fields for broken-todo-demo
          const plan = readSessionArtifact<{
            services: { type: string; sku: string; name: string }[];
            costEstimate: { totalMonthlyUsd?: number; monthlyUsd?: number; assumptions?: string[] };
            naming: { resourcePrefix: string; pattern?: string; resources?: { type: string; name: string }[] };
            iacFormat: string;
            deploymentVariables?: Record<string, unknown>;
            postDeployRecommendations?: string[];
          }>(workspacePath, "prepare-plan.json");

          // Hard: prepare-plan.json must exist — if null, agent didn't reach prepare phase
          if (!plan) {
            agentMetadata.testComments.push("❌ PREPARE PLAN: prepare-plan.json not written — agent likely terminated before prepare phase completed");
          }
          expect(plan).not.toBeNull();

          if (plan) {
            // Should recommend App Service or Container Apps for Express app
            // Agent writes service name in `name` field (not `type`) per PreparePlan schema
            const hasCompute = plan.services.some(s => {
              const svcName = (s.name ?? s.type ?? "").toLowerCase();
              return svcName.includes("app service") || svcName.includes("container");
            });
            if (!hasCompute) {
              agentMetadata.testComments.push("⚠️ PREPARE: No App Service or Container Apps in services[] — expected for Express app");
            }

            // Cost should be reasonable ($0-$50 for simple Express app)
            // Agent may use `monthlyUsd` (actual) or `totalMonthlyUsd` (legacy)
            const costUsd = plan.costEstimate.totalMonthlyUsd ?? plan.costEstimate.monthlyUsd;
            if (costUsd !== undefined) {
              if (costUsd > 50) {
                agentMetadata.testComments.push(
                  `⚠️ PREPARE: Cost $${costUsd}/mo exceeds expected range ($0-$50) for simple Express app`,
                );
              }
            }

            // Naming: resourcePrefix must exist and contain a collision-prevention suffix (≥4 chars from session UUID)
            // Schema: NamingConfig has { pattern, resourcePrefix, resources[] } — no separate "suffix" field.
            // The suffix is embedded in resourcePrefix, e.g. "broken-dev-d2c1" where "d2c1" is from session UUID.
            if (!plan.naming.resourcePrefix || plan.naming.resourcePrefix.length < 5) {
              agentMetadata.testComments.push(`❌ NAMING: resourcePrefix missing or too short ('${plan.naming.resourcePrefix ?? "undefined"}') — must contain project + suffix for DNS collision prevention`);
            }
            expect(plan.naming.resourcePrefix).toBeDefined();
            expect(plan.naming.resourcePrefix!.length).toBeGreaterThanOrEqual(5);

            // IaC format should be Bicep (default, no existing .tf)
            if (plan.iacFormat !== "bicep") {
              agentMetadata.testComments.push(`⚠️ PREPARE: iacFormat='${plan.iacFormat}' — expected 'bicep' (default)`);
            }
          }
        }

        // Session integrity
        if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);
      });
    }, prepareTestTimeoutMs);
  });

  describe("quota-validation", () => {
    test("agent validates quota before recommending region", async () => {
      await withTestResult(async () => {
        let workspacePath = "";
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
            await cloneRepo({
              repoUrl: "https://github.com/rwieruch/node-express-server-rest-api",
              targetDir: workspace,
              branch: "master",
              depth: 1,
            });
          },
          prompt: "I want a one-click way to deploy my app to Azure.",
          followUp: [
            SUBSCRIPTION_PRIMER,
            "Yes.",
            "Yes.",
            "Yes.",
            "Yes.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateForApprovalGate,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        // Hard: prepare-plan.json must exist — proves prepare phase actually ran
        if (workspacePath) {
          const plan = readSessionArtifact(workspacePath, "prepare-plan.json");
          if (!plan) {
            agentMetadata.testComments.push("❌ PREPARE PLAN: prepare-plan.json not written — agent likely terminated before prepare phase completed");
          }
          expect(plan).not.toBeNull();
        }

        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

        // Hard: must mention quota/capacity check (must validate quota before recommending region)
        // Check both assistant messages AND tool call content — agent may validate quota
        // via MCP tools (mcp_azure_quota) without echoing results in assistant text.
        // Note: "available" excluded — too generic, matches non-quota contexts.
        const mentionsQuota =
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "quota") ||
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "capacity") ||
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "usage");
        if (!mentionsQuota) {
          agentMetadata.testComments.push("❌ QUOTA: Agent did not mention quota/capacity validation in messages or tool calls — must check quota before recommending a region");
        }
        expect(mentionsQuota).toBe(true);

        // Hard: must mention a specific region
        const mentionsRegion =
          /\b(eastus|westus|centralus|northeurope|westeurope|eastus2|westus2|southcentralus)\b/i.test(messages) ||
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "eastus") ||
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "westus") ||
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "eastus2");
        if (!mentionsRegion) {
          agentMetadata.testComments.push("❌ QUOTA: Agent did not mention a specific Azure region — must recommend a region after quota validation");
        }
        expect(mentionsRegion).toBe(true);

        if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);
      });
    }, prepareTestTimeoutMs);
  });
});
