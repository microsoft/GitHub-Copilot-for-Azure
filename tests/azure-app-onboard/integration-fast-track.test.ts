/**
 * Integration Tests — Fast-Track
 *
 * Validates that simple repos (static site + Dockerfile) get fast-tracked
 * to free-tier deployment without unnecessary questions.
 *
 * Microblog-ai-remix no-fast-track test moved to integration-catalog.test.ts
 * (consolidated with existing microblog plan-quality test).
 */

import {
  isSkillInvoked,
  softCheckSkill,
  withTestResult,
  getAllAssistantMessages,
} from "../utils/evaluate";
import { cloneRepo } from "../utils/git-clone";
import {
  SKILL_NAME,
  shouldEarlyTerminateOnDeployComplete,
  assertSessionFileCreated,
  assertDeployResultSchema,
  assertDeployChecklistExists,
  assertPhaseArtifactsExist,
  describeAppOnboardWithCleanup,
  SUBSCRIPTION_PRIMER,
} from "./app-onboard-test-helpers";

describeAppOnboardWithCleanup("Fast-Track Tests", (agent) => {

  describe("fast-track", () => {
    test("e2e — simple HTML site deploys to free tier", async () => {
      await withTestResult(async () => {
        let workspacePath = "";
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
            // Pure HTML static site — no Dockerfile, no framework, f1Viable=true
            await cloneRepo({ repoUrl: "https://github.com/Azure-Samples/app-service-web-html-get-started", targetDir: workspace, branch: "master", depth: 1 });
          },
          prompt: "I have an app in GitHub — can you deploy it to Azure for me?",
          followUp: [
            SUBSCRIPTION_PRIMER,
            "Yes.",
            "Yes.",
            "Yes.",
            "Yes.",
            "Yes.",
            "Yes.",
            "Yes.",
            "Yes.",
            "Yes.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          followUpTimeout: 2_700_000, // 45 min — full pipeline deploy can exceed 30 min
          shouldEarlyTerminate: shouldEarlyTerminateOnDeployComplete,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

        // Should detect static site / HTML
        expect(messages.includes("static") || messages.includes("html")).toBe(true);

        // Should recommend free tier (F1 for App Service, or Static Web Apps free)
        expect(messages.includes("f1") || messages.includes("free") || messages.includes("$0") || messages.includes("static web app")).toBe(true);

        // Should NOT ask about stack/DB/auth (simple static site skips these)
        const asksUnnecessaryQuestions =
          (/what (stack|language|framework|database|auth)/i.test(messages) ||
          /which (database|auth|framework)/i.test(messages)) &&
          messages.includes("?");
        if (asksUnnecessaryQuestions) {
          agentMetadata.testComments.push("⚠️ FAST-TRACK VIOLATION: Agent asked unnecessary questions about stack/DB/auth for a simple static site");
        }
        expect(asksUnnecessaryQuestions).toBe(false);

        // Outcome-based behavioral checks
        if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);

        // ── Deploy assertions (e2e — must actually deploy) ──────────────
        if (workspacePath) {
          assertDeployChecklistExists(agentMetadata, workspacePath);
          assertDeployResultSchema(agentMetadata, workspacePath);
          assertPhaseArtifactsExist(agentMetadata, workspacePath, [
            "context.json",
            "prereq-output.json",
            "prepare-plan.json",
            "scaffold-manifest.json",
            "deploy-result.json",
          ]);
        }

        // Live endpoint
        const hasEndpoint =
          messages.includes("azurewebsites.net") ||
          messages.includes("azurestaticapps.net") ||
          messages.includes("endpoint") ||
          messages.includes("deployed");
        if (!hasEndpoint) {
          agentMetadata.testComments.push("⚠️ No deployed endpoint URL found in agent output");
        }
        expect(hasEndpoint).toBe(true);
      });
    }, 3600000); // 60 min — full e2e deploy including clone + prereq + prepare + scaffold + deploy
  });
});
