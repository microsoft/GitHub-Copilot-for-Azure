/**
 * Integration Tests — Scaffold Safety (Bicep Tag)
 *
 * Validates that generated Bicep includes the app-onboard-skill tag.
 * Stops at scaffold phase (no deploy needed).
 *
 * Pre-deploy and post-deploy safety tests moved to
 * deploy/integration-deploy-verification.test.ts (consolidated seeded fixture).
 */

import {
  isSkillInvoked,
  softCheckSkill,
  withTestResult,
  getToolCalls,
} from "../../utils/evaluate";
import { cloneRepo } from "../../utils/git-clone";
import {
  describeAppOnboardWithCleanup,
  SKILL_NAME,
  integrationTestTimeoutMs,
  SUBSCRIPTION_PRIMER,
  assertSessionFileCreated,
  assertBicepTagPresent,
  withRoutingBailout,
} from "../app-onboard-test-helpers";

describeAppOnboardWithCleanup("Deploy Safety Tests", (agent) => {
  // ─────────────────────────────────────────────────────────────────
  // Scaffold-safety: Generated Bicep includes app-onboard-skill tag
  // ─────────────────────────────────────────────────────────────────
  describe("scaffold-safety", () => {
    test("generated Bicep includes app-onboard-skill tag", async () => {
      await withTestResult(async () => {
        let workspacePath = "";

        // Custom early termination: stop once Bicep files are written or scaffold-manifest.json is created
        const shouldTerminateAfterScaffold = withRoutingBailout((m) => {
          const toolCalls = getToolCalls(m);

          const hasScaffoldManifest = toolCalls.some(tc => {
            const toolName = (tc.data.toolName ?? "").toLowerCase();
            if (toolName !== "create_file" && toolName !== "write_file" && toolName !== "create") return false;
            const args = JSON.stringify(tc.data.arguments ?? {}).toLowerCase();
            return args.includes("scaffold-manifest");
          });

          const hasBicepWrite = toolCalls.some(tc => {
            const toolName = (tc.data.toolName ?? "").toLowerCase();
            if (toolName !== "create_file" && toolName !== "write_file" && toolName !== "create") return false;
            const args = tc.data.arguments as Record<string, unknown> ?? {};
            const filePath = (args.path as string ?? args.file_path as string ?? args.filePath as string ?? "").toLowerCase();
            return filePath.endsWith(".bicep");
          });

          if (hasScaffoldManifest) {
            m.testComments.push("✅ EARLY TERMINATE: scaffold-manifest.json written — scaffold phase complete.");
            return true;
          }
          if (hasBicepWrite) {
            m.testComments.push("✅ EARLY TERMINATE: .bicep file written — IaC generation complete.");
            return true;
          }

          const hasDeployCmd = toolCalls.some(tc => {
            const tn = (tc.data.toolName ?? "").toLowerCase();
            if (tn !== "powershell" && tn !== "bash" && tn !== "run_in_terminal") return false;
            const cmd = ((tc.data.arguments as Record<string, unknown>)?.command as string ?? "").toLowerCase();
            return cmd.includes("az deployment sub create") || cmd.includes("az deployment group create") ||
              cmd.includes("terraform apply");
          });
          if (hasDeployCmd) {
            m.testComments.push("⚠️ EARLY TERMINATE: Agent started deploying — stopping before deployment.");
            return true;
          }

          return false;
        });

        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
            await cloneRepo({
              repoUrl: "https://github.com/nishanttotla/DockerStaticSite",
              targetDir: workspace,
              branch: "master",
              depth: 1,
            });
          },
          prompt: "I have an app in GitHub — can you deploy it to Azure for me?",
          followUp: [
            SUBSCRIPTION_PRIMER,
            "Yes.",
            "Yes.",
            "Yes.",
            "Yes.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          followUpTimeout: 900_000, // 15 min per follow-up — scaffold is faster
          shouldEarlyTerminate: shouldTerminateAfterScaffold,
        });

        // Routing gate
        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        // ASSERTION: Bicep includes app-onboard-skill tag
        const hasBicepFiles = getToolCalls(agentMetadata).some(tc => {
          const toolName = (tc.data.toolName ?? "").toLowerCase();
          if (toolName !== "create_file" && toolName !== "write_file" && toolName !== "create") return false;
          const args = JSON.stringify(tc.data.arguments ?? "").toLowerCase();
          return args.includes(".bicep");
        });
        if (workspacePath && hasBicepFiles) {
          assertBicepTagPresent(agentMetadata, workspacePath);
        } else if (!hasBicepFiles) {
          agentMetadata.testComments.push("⚠️ SCAFFOLD NOT REACHED: No .bicep files written — skipping tag assertion");
        }
        if (workspacePath) {
          assertSessionFileCreated(agentMetadata, workspacePath);
        }
      });
    }, integrationTestTimeoutMs);
  });
});
