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
  getToolCalls,
} from "../../utils/evaluate";
import { cloneRepo } from "../../utils/git-clone";
import {
  describeAppOnboardWithCleanup,
  SKILL_NAME,
  testTimeoutMs,
  assertSessionFileCreated,
  assertIaCFormat,
  readSessionArtifact,
  SUBSCRIPTION_PRIMER,
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
              repoUrl: "https://github.com/dev-arv13/demo-app",
              targetDir: workspace,
              branch: "main",
              depth: 1,
            });
          },
          prompt: "I built a side project and want to get it live on Azure",
          followUp: [
            SUBSCRIPTION_PRIMER,
            "Yes.",
            "Actually, switch to Terraform instead of Bicep.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          followUpTimeout: 2_700_000,
          shouldEarlyTerminate: (metadata) => {
            // Bail on routing failure
            if (!isSkillInvoked(metadata, SKILL_NAME) && getToolCalls(metadata).length > 3) return true;
            // Gate: don't terminate until agent acknowledges Terraform override
            const messages = getAllAssistantMessages(metadata).toLowerCase();
            if (!messages.includes("terraform")) return false;
            // Terminate once prepare re-runs with Terraform — detect prepare-plan.json
            // written with "terraform" in content (initial write was Bicep, won't match)
            return getToolCalls(metadata).some(tc => {
              const toolName = (tc.data.toolName ?? "").toLowerCase();
              if (!["create_file", "write_file", "create", "edit"].includes(toolName)) return false;
              const args = (tc.data.arguments ?? {}) as Record<string, unknown>;
              const fp = ((args.path ?? args.filePath ?? "") as string).toLowerCase();
              const content = JSON.stringify(args).toLowerCase();
              return fp.includes("prepare-plan") && content.includes("terraform");
            });
          },
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

        // Hard: must acknowledge the override
        const acknowledgesOverride =
          messages.includes("terraform") &&
          (messages.includes("switch") || messages.includes("change") ||
           messages.includes("updat") || messages.includes("noted") ||
           messages.includes("will use terraform") || messages.includes("understood") ||
           messages.includes("got it") || messages.includes("i'll use") ||
           messages.includes("terraform instead"));
        if (!acknowledgesOverride) {
          agentMetadata.testComments.push("❌ USER OVERRIDE: Agent did not acknowledge switch to Terraform");
        }
        expect(acknowledgesOverride).toBe(true);

        // Soft: should write override to context.json
        if (workspacePath) {
          const ctx = readSessionArtifact<{ overrides?: { iacFormat?: string }[] }>(workspacePath, "context.json");
          if (ctx && ctx.overrides) {
            const hasIacOverride = ctx.overrides.some(o => o.iacFormat === "terraform");
            if (hasIacOverride) {
              agentMetadata.testComments.push("✅ USER OVERRIDE: context.json.overrides[] contains iacFormat=terraform");
            } else {
              agentMetadata.testComments.push("⚠️ USER OVERRIDE: context.json.overrides[] missing iacFormat=terraform");
            }
          }

          // Check prepare-plan.json reflects Terraform after user override
          const plan = readSessionArtifact<{ iacFormat: string }>(workspacePath, "prepare-plan.json");
          if (plan && plan.iacFormat !== "terraform") {
            agentMetadata.testComments.push(`⚠️ IAC FORMAT: prepare-plan.json.iacFormat='${plan.iacFormat}' — expected 'terraform' after override`);
          }

          // Verify IaC format on disk
          assertIaCFormat(agentMetadata, workspacePath, "terraform");
        }

        if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);
      });
    }, testTimeoutMs);
  });
});
