/**
 * Integration Tests — Scaffold IaC Format Override
 *
 * Tests that when a user asks to switch to Terraform mid-flow, the agent
 * offers to route them to azure-prepare (which handles standalone Terraform
 * generation) rather than attempting Terraform scaffold within AppOnboard.
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
  SUBSCRIPTION_PRIMER,
} from "../app-onboard-test-helpers";

describeAppOnboardWithCleanup("Scaffold Override Tests", (agent) => {
  describe("user-override", () => {
    test("user asks for Terraform — agent offers azure-prepare route", async () => {
      await withTestResult(async () => {
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
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
          shouldEarlyTerminate: (metadata) => {
            // Bail on routing failure
            if (!isSkillInvoked(metadata, SKILL_NAME) && getToolCalls(metadata).length > 3) return true;
            // Terminate once agent acknowledges the Terraform request
            const messages = getAllAssistantMessages(metadata).toLowerCase();
            return messages.includes("terraform") &&
              (messages.includes("azure-prepare") || messages.includes("azure prepare") ||
               messages.includes("prepare skill") || messages.includes("generate terraform") ||
               // Also accept: agent explains TF isn't supported in scaffold and offers alternative
               messages.includes("not supported") || messages.includes("bicep only") ||
               messages.includes("recommend") || messages.includes("alternative"));
          },
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

        // Hard: must acknowledge the Terraform request
        const acknowledgesTerraform = messages.includes("terraform");
        if (!acknowledgesTerraform) {
          agentMetadata.testComments.push("❌ USER OVERRIDE: Agent did not acknowledge Terraform request");
        }
        expect(acknowledgesTerraform).toBe(true);

        // Hard: must mention azure-prepare as the route for Terraform, OR explain
        // that Terraform is not supported in the current scaffold pipeline
        const offersAlternative =
          messages.includes("azure-prepare") || messages.includes("azure prepare") ||
          messages.includes("prepare skill") ||
          messages.includes("not supported") || messages.includes("bicep only") ||
          // Accept: agent offers to generate Terraform (may route internally)
          (messages.includes("terraform") && (messages.includes("generat") || messages.includes("switch")));
        if (!offersAlternative) {
          agentMetadata.testComments.push("❌ USER OVERRIDE: Agent did not offer azure-prepare or explain Terraform limitation");
        }
        expect(offersAlternative).toBe(true);

        // Hard: must NOT start generating .tf files (AppOnboard scaffold = Bicep only)
        const wroteTerrformFiles = getToolCalls(agentMetadata).some(tc => {
          if (tc.data.toolName !== "create_file" && tc.data.toolName !== "write_file") return false;
          const filePath = ((tc.data.arguments as Record<string, unknown>)?.path as string ?? "").toLowerCase();
          return filePath.endsWith(".tf");
        });
        if (wroteTerrformFiles) {
          agentMetadata.testComments.push("❌ SCAFFOLD VIOLATION: Agent wrote .tf files — AppOnboard scaffold should route to azure-prepare for Terraform");
        }
        expect(wroteTerrformFiles).toBe(false);
      });
    }, testTimeoutMs);
  });
});
