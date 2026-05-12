/**
 * Integration Tests — Prepare Phase Depth
 *
 * Validates prepare-plan.json schema compliance, quota validation evidence,
 * naming patterns, IaC format selection, and cost estimation quality.
 *
 * Covers: Gap 2 (prepare-plan schema), Gap 9 (user override / Terraform path),
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
  shouldEarlyTerminateOnRoutingFailure,
  assertSessionFileCreated,
  assertPreparePlanSchema,
  readSessionArtifact,
} from "../app-onboard-test-helpers";

describeAppOnboard("Prepare Depth Tests", (agent) => {
  describe("prepare-plan-schema", () => {
    test("prepare-plan.json has valid schema for simple Express app", async () => {
      await withTestResult(async () => {
        let workspacePath = "";
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
            await cloneRepo({
              repoUrl: "https://github.com/samcdonald-ms/bya-simple-web-app",
              targetDir: workspace,
              branch: "main",
              depth: 1,
            });
          },
          prompt: "I built a side project and want to get it live on Azure",
          followUp: [
            "Just go with defaults.",
            "Show me the full architecture plan before proceeding.",
            "No, don't deploy. That's all I needed.",
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

          // Validate specific fields for bya-simple-web-app
          const plan = readSessionArtifact<{
            services: { type: string; sku: string }[];
            costEstimate: { totalMonthlyUsd: number; assumptions?: string[] };
            naming: { resourceGroupName: string; suffix?: string; resourcePrefix?: string };
            iacFormat: string;
            deploymentVariables?: Record<string, unknown>;
            postDeployRecommendations?: string[];
          }>(workspacePath, "prepare-plan.json");

          if (plan) {
            // Should recommend App Service for simple Express app
            const hasAppService = plan.services.some(s =>
              s.type.toLowerCase().includes("app service"));
            if (!hasAppService) {
              agentMetadata.testComments.push("⚠️ PREPARE: No App Service in services[] — expected for simple Express app");
            }

            // Cost should be in expected range ($0-$15 for bya-simple-web-app)
            if (plan.costEstimate.totalMonthlyUsd !== undefined) {
              if (plan.costEstimate.totalMonthlyUsd > 50) {
                agentMetadata.testComments.push(
                  `⚠️ PREPARE: Cost $${plan.costEstimate.totalMonthlyUsd}/mo exceeds expected range ($0-$15) for simple Express app`,
                );
              }
            }

            // costEstimate.assumptions should be populated (SKILL.md requires it)
            if (!plan.costEstimate.assumptions || plan.costEstimate.assumptions.length === 0) {
              agentMetadata.testComments.push("⚠️ PREPARE: costEstimate.assumptions[] is empty — SKILL.md requires assumptions");
            }

            // deploymentVariables should be populated
            if (!plan.deploymentVariables) {
              agentMetadata.testComments.push("⚠️ PREPARE: deploymentVariables missing from prepare-plan.json");
            }

            // postDeployRecommendations should be populated
            if (!plan.postDeployRecommendations || plan.postDeployRecommendations.length === 0) {
              agentMetadata.testComments.push("⚠️ PREPARE: postDeployRecommendations[] is empty");
            }

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
              repoUrl: "https://github.com/samcdonald-ms/bya-simple-web-app",
              targetDir: workspace,
              branch: "main",
              depth: 1,
            });
          },
          prompt: "I want a one-click way to deploy my app to Azure.",
          followUp: [
            "Check if there's quota available before recommending a region.",
            "What SKU and region did you validate?",
            "No, don't deploy.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateOnRoutingFailure,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

        // Soft: should mention quota/capacity check
        const mentionsQuota =
          messages.includes("quota") || messages.includes("capacity") ||
          messages.includes("available") || messages.includes("usage");
        if (!mentionsQuota) {
          agentMetadata.testComments.push("⚠️ QUOTA: Agent did not mention quota/capacity validation");
        }

        // Soft: should mention a specific region
        const mentionsRegion =
          /\b(eastus|westus|centralus|northeurope|westeurope|eastus2|westus2|southcentralus)\b/i.test(messages);
        if (!mentionsRegion) {
          agentMetadata.testComments.push("⚠️ QUOTA: Agent did not mention a specific Azure region");
        }

        if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);
      });
    }, testTimeoutMs);
  });
});
