/**
 * Integration Tests — Scaffold IaC Format Override
 *
 * Tests that the user can change IaC format mid-flow and the agent
 * acknowledges and updates the plan accordingly.
 *
 * Extracted from integration-pipeline-flow.test.ts — scaffold-phase specific.
 */

import {
  isSkillInvoked,
  softCheckSkill,
  withTestResult,
  getAllAssistantMessages,
} from "../../utils/evaluate";
import { cloneRepo } from "../../utils/git-clone";
import {
  describeAppOnboardWithCleanup,
  SKILL_NAME,
  testTimeoutMs,
  shouldEarlyTerminateOnUserOverride,
  assertSessionFileCreated,
  readSessionArtifact,
} from "../app-onboard-test-helpers";

describeAppOnboardWithCleanup("Scaffold Override Tests", (agent) => {
  describe("user-override", () => {
    test("user changes IaC format mid-flow — agent updates plan", async () => {
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
            "Go with recommended options.",
            "Actually, switch to Terraform instead of Bicep.",
            "No, don't deploy.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateOnUserOverride,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

        // Soft: should acknowledge the override
        const acknowledgesOverride =
          messages.includes("terraform") &&
          (messages.includes("switch") || messages.includes("change") ||
           messages.includes("updat") || messages.includes("noted") ||
           messages.includes("will use terraform"));
        if (!acknowledgesOverride) {
          agentMetadata.testComments.push("⚠️ USER OVERRIDE: Agent did not acknowledge switch to Terraform");
        }

        // Soft: should write override to context.json
        if (workspacePath) {
          const ctx = readSessionArtifact<{ overrides?: { iacFormat?: string }[] }>(workspacePath, "context.json");
          if (ctx && ctx.overrides) {
            const hasIacOverride = ctx.overrides.some(o => o.iacFormat === "terraform");
            if (hasIacOverride) {
              agentMetadata.testComments.push("✅ USER OVERRIDE: context.json.overrides[] contains iacFormat=terraform");
            }
          }

          // Check prepare-plan.json reflects Terraform after user override
          const plan = readSessionArtifact<{ iacFormat: string }>(workspacePath, "prepare-plan.json");
          if (plan && plan.iacFormat !== "terraform") {
            agentMetadata.testComments.push(`⚠️ IAC FORMAT: prepare-plan.json.iacFormat='${plan.iacFormat}' — expected 'terraform' after override`);
          }
        }

        if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);
      });
    }, testTimeoutMs);
  });
});
