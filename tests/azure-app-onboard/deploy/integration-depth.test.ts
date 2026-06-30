/**
 * Integration Tests — Deploy Phase Depth
 *
 * Validates deploy-specific behaviors beyond basic deployment:
 * - deploy-audit.log format and incremental writes (Gap 6)
 * - deploy-result.json schema compliance
 * - Healing loop counter + user pause at 3 attempts (Gap 7)
 *
 * Uses bya-simple-web-app (simplest deployable app) to minimize
 * pipeline time before reaching deploy phase.
 */

import {
  isSkillInvoked,
  softCheckSkill,
  withTestResult,
  getAllAssistantMessages,
} from "../../utils/evaluate";
import { cloneRepo } from "../../utils/git-clone";
import * as fs from "fs";
import * as path from "path";
import {
  describeAppOnboardWithCleanup,
  SKILL_NAME,
  testTimeoutMs,
  shouldEarlyTerminateOnDeployResult,
  assertSessionFileCreated,
  assertDeployAuditLog,
  assertDeployResultSchema,
  assertHealingLoopPaused,
  assertPhaseArtifactsExist,
  assertContextJsonProgression,
} from "../app-onboard-test-helpers";

describeAppOnboardWithCleanup("Deploy Depth Tests", (agent) => {
  describe("deploy-artifacts", () => {
    test("deploy writes audit log and deploy-result.json with correct schema", async () => {
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
          prompt: "I'm new to Azure. Can you get my existing app running without me setting up infrastructure?",
          followUp: [
            "Just go with defaults, cheapest option.",
            "Yes, proceed with scaffolding.",
            "Yes, deploy to Azure now.",
            "Yes, confirm the deployment.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          followUpTimeout: 1_800_000, // 30 min per follow-up
          shouldEarlyTerminate: shouldEarlyTerminateOnDeployResult,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        if (workspacePath) {
          // deploy-result.json must exist and have valid schema
          assertDeployResultSchema(agentMetadata, workspacePath);

          // deploy-audit.log should exist with incremental entries
          assertDeployAuditLog(agentMetadata, workspacePath);

          // Session artifacts should show full phase progression
          assertPhaseArtifactsExist(agentMetadata, workspacePath, [
            "context.json",
            "prereq-output.json",
            "prepare-plan.json",
            "scaffold-manifest.json",
            "deploy-result.json",
          ]);
          assertContextJsonProgression(agentMetadata, workspacePath);

          // context.json should have deploy in completedPhases
          assertSessionFileCreated(agentMetadata, workspacePath);
        }

        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

        // Hard: must use az deployment, NOT azd up
        const usedAzd = /azd\s+(up|provision|deploy)/i.test(messages);
        if (usedAzd) {
          agentMetadata.testComments.push("❌ Agent used azd up/provision/deploy — AppOnboard must deploy via az deployment sub create");
        }
        expect(usedAzd).toBe(false);

        // Hard: must NOT generate azure.yaml
        if (workspacePath) {
          const azureYamlPath = path.join(workspacePath, "azure.yaml");
          const generatedAzureYaml = fs.existsSync(azureYamlPath);
          if (generatedAzureYaml) {
            agentMetadata.testComments.push("❌ Agent generated azure.yaml — NEVER generate azure.yaml in AppOnboard pipeline");
          }
          expect(generatedAzureYaml).toBe(false);
        }
      });
    }, 3000000); // 50 min — full e2e deploy
  });

  describe("healing-loop", () => {
    test("healing loop pauses for user after 3 failed attempts", async () => {
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
          prompt: "I just signed up for Azure. What's the fastest way to bring my app over?",
          followUp: [
            "Just go with defaults.",
            "Yes, proceed.",
            "Deployment failed: The subscription does not have enough cores quota for 'Standard B1ms' in region 'eastus'. Required: 1, Available: 0.",
            "Try a different region.",
            "That also failed: Same quota error in westus2.",
            "Try another region.",
            "Still failing: Quota exhausted in centralus too.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          followUpTimeout: 600_000,
          shouldEarlyTerminate: shouldEarlyTerminateOnDeployResult,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

        // Soft: after 3 failures, should ask user for direction
        const asksForDirection =
          messages.includes("would you like") || messages.includes("should i") ||
          messages.includes("what would you") || messages.includes("try that") ||
          messages.includes("suggestion") || messages.includes("alternative");
        if (!asksForDirection) {
          agentMetadata.testComments.push("⚠️ HEALING LOOP: Agent did not ask user for direction after repeated failures");
        }

        // Soft: should present alternative regions or SKUs
        const presentsAlternatives =
          /\b(eastus2|westus|westus2|centralus|northeurope|westeurope)\b/i.test(messages) ||
          /\b(f1|b1|s1|p1)\b/i.test(messages);
        if (!presentsAlternatives) {
          agentMetadata.testComments.push("⚠️ HEALING LOOP: Agent did not present alternative regions or SKUs");
        }

        // Check deploy-result.json healing attempts if available
        if (workspacePath) {
          assertHealingLoopPaused(agentMetadata, workspacePath);
        }
      });
    }, 3000000); // 50 min — multi-turn healing
  });

  describe("deploy-result-always-written", () => {
    test("deploy-result.json written even on deployment failure", async () => {
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
            "Yes, proceed.",
            "Deployment failed with: AuthorizationFailed — The client does not have authorization to perform action 'Microsoft.Resources/subscriptions/resourcegroups/write'.",
            "No, don't deploy. Stop here.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          followUpTimeout: 600_000,
          shouldEarlyTerminate: shouldEarlyTerminateOnDeployResult,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

        // Must identify the authorization error
        const identifiesAuthError =
          messages.includes("authorization") || messages.includes("permission") ||
          messages.includes("rbac") || messages.includes("role");
        if (!identifiesAuthError) {
          agentMetadata.testComments.push("⚠️ DEPLOY FAILURE: Agent did not identify authorization error");
        }

        // Must suggest RBAC fix (per SKILL.md error handling)
        const suggestsRbacFix =
          messages.includes("az role assignment") || messages.includes("contributor") ||
          messages.includes("role assignment") || messages.includes("grant permission");
        if (!suggestsRbacFix) {
          agentMetadata.testComments.push("⚠️ DEPLOY FAILURE: Agent did not suggest RBAC fix — SKILL.md requires 'az role assignment' command");
        }

        // deploy-result.json should still be written (SKILL.md: ALWAYS write deploy-result.json)
        if (workspacePath) {
          assertDeployResultSchema(agentMetadata, workspacePath);
        }
      });
    }, testTimeoutMs);
  });
});
