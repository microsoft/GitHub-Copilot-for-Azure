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
} from "../../utils/evaluate";
import { cloneRepo } from "../../utils/git-clone";
import {
  describeAppOnboard,
  SKILL_NAME,
  testTimeoutMs,
  shouldEarlyTerminateForPlanPresented,
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
          shouldEarlyTerminate: shouldEarlyTerminateForPlanPresented,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        // Hard: prepare-plan.json must exist and have valid schema
        if (workspacePath) {
          assertPreparePlanSchema(agentMetadata, workspacePath);

          // Validate specific fields for broken-todo-demo
          const plan = readSessionArtifact<{
            services: { type: string; sku: string }[];
            costEstimate: { totalMonthlyUsd: number; assumptions?: string[] };
            naming: { resourceGroupName: string; suffix?: string; resourcePrefix?: string };
            iacFormat: string;
            deploymentVariables?: Record<string, unknown>;
            postDeployRecommendations?: string[];
          }>(workspacePath, "prepare-plan.json");

          if (plan) {
            // Should recommend App Service or Container Apps for Express app
            const hasCompute = plan.services.some(s =>
              s.type?.toLowerCase().includes("app service") || s.type?.toLowerCase().includes("container"));
            if (!hasCompute) {
              agentMetadata.testComments.push("⚠️ PREPARE: No App Service or Container Apps in services[] — expected for Express app");
            }

            // Cost should be reasonable ($0-$50 for simple Express app)
            if (plan.costEstimate.totalMonthlyUsd !== undefined) {
              if (plan.costEstimate.totalMonthlyUsd > 50) {
                agentMetadata.testComments.push(
                  `⚠️ PREPARE: Cost $${plan.costEstimate.totalMonthlyUsd}/mo exceeds expected range ($0-$50) for simple Express app`,
                );
              }
            }

            // costEstimate.assumptions should be populated
            if (!plan.costEstimate.assumptions || plan.costEstimate.assumptions.length === 0) {
              agentMetadata.testComments.push("⚠️ PREPARE: costEstimate.assumptions[] is empty — cost estimate must include assumptions");
            }

            // deploymentVariables should be populated
            if (!plan.deploymentVariables) {
              agentMetadata.testComments.push("⚠️ PREPARE: deploymentVariables missing from prepare-plan.json");
            }

            // postDeployRecommendations should be populated
            if (!plan.postDeployRecommendations || plan.postDeployRecommendations.length === 0) {
              agentMetadata.testComments.push("⚠️ PREPARE: postDeployRecommendations[] is empty");
            }

            // Naming suffix: naming.suffix must exist — 4-char session-ID suffix prevents global DNS collisions
            if (!plan.naming.suffix || plan.naming.suffix.length < 3) {
              agentMetadata.testComments.push(`❌ NAMING SUFFIX: naming.suffix missing or too short ('${plan.naming.suffix ?? "undefined"}') — must be ≥3 chars for collision prevention`);
            }
            expect(plan.naming.suffix).toBeDefined();
            expect(plan.naming.suffix!.length).toBeGreaterThanOrEqual(3);

            // IaC format should be Bicep (default, no existing .tf)
            if (plan.iacFormat !== "bicep") {
              agentMetadata.testComments.push(`⚠️ PREPARE: iacFormat='${plan.iacFormat}' — expected 'bicep' (default)`);
            }
          }
        }

        // Session integrity
        if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);
      });
    }, testTimeoutMs);
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
          shouldEarlyTerminate: shouldEarlyTerminateForPlanPresented,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

        // Hard: must mention quota/capacity check (must validate quota before recommending region)
        const mentionsQuota =
          messages.includes("quota") || messages.includes("capacity") ||
          messages.includes("available") || messages.includes("usage");
        if (!mentionsQuota) {
          agentMetadata.testComments.push("❌ QUOTA: Agent did not mention quota/capacity validation — must check quota before recommending a region");
        }
        expect(mentionsQuota).toBe(true);

        // Hard: must mention a specific region
        const mentionsRegion =
          /\b(eastus|westus|centralus|northeurope|westeurope|eastus2|westus2|southcentralus)\b/i.test(messages);
        if (!mentionsRegion) {
          agentMetadata.testComments.push("❌ QUOTA: Agent did not mention a specific Azure region — must recommend a region after quota validation");
        }
        expect(mentionsRegion).toBe(true);

        if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);
      });
    }, testTimeoutMs);
  });
});
