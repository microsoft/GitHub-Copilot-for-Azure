/**
 * Integration Tests — Fast-Track
 *
 * Validates that simple repos (static site + Dockerfile) get fast-tracked
 * and complex repos (multi-component) do NOT get fast-tracked.
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
  testTimeoutMs,
  shouldEarlyTerminateOnRoutingFailure,
  assertApprovalGateReached,
  assertSessionFileCreated,
  assertDockerfileExplored,
  describeAppOnboardWithCleanup,
} from "./app-onboard-test-helpers";

describeAppOnboardWithCleanup("Fast-Track Tests", (agent) => {

  describe("fast-track", () => {
    test("fast-track — simple HTML site (no Dockerfile) gets free tier", async () => {
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
            "Cheapest option, just get it live.",
            "How much will this deployment cost me each month?",
            "No, don't deploy. That's all I needed.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateOnRoutingFailure,
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
      });
    }, testTimeoutMs);

    test("no-fast-track — microblog-ai-remix must NOT be fast-tracked", async () => {
      await withTestResult(async () => {
        let workspacePath = "";
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
            await cloneRepo({ repoUrl: "https://github.com/Azure-Samples/microblog-ai-remix", targetDir: workspace, branch: "main", depth: 1 });
          },
          prompt: "I'm a startup founder and need to deploy my MVP on Azure",
          followUp: [
            "Just go with defaults.",
            "Why did you choose this architecture?",
            "No, don't deploy. That's all I needed.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          followUpTimeout: 600_000, // 10 min per follow-up — microblog-ai-remix is one of the heaviest workspaces (88 files, Remix+OpenAI+existing Bicep infra), agent needs processing time
          shouldEarlyTerminate: shouldEarlyTerminateOnRoutingFailure,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

        // Must detect it's NOT a simple static site — has Remix + Functions + OpenAI
        expect(messages.includes("remix") || messages.includes("function") || messages.includes("openai")).toBe(true);

        // Must ask at least one question or present multi-component analysis (not fast-track)
        const hasQuestion = messages.includes("?");
        const hasMultiComponentAnalysis = messages.includes("component") || messages.includes("frontend") || messages.includes("backend");
        if (!hasQuestion && !hasMultiComponentAnalysis) {
          agentMetadata.testComments.push("❌ FAST-TRACK VIOLATION: Agent fast-tracked a complex multi-component app (Remix + Functions + OpenAI) without asking questions or analyzing components");
        }
        expect(hasQuestion || hasMultiComponentAnalysis).toBe(true);

        // Must present full approval gate (not collapsed one-liner)
        assertApprovalGateReached(agentMetadata);

        // Must mention multiple services (not just one free-tier suggestion)
        const mentionsMultipleServices =
          (messages.includes("container apps") ? 1 : 0) +
          (messages.includes("openai") || messages.includes("azure openai") ? 1 : 0) +
          (messages.includes("registry") || messages.includes("acr") ? 1 : 0) +
          (messages.includes("static web") ? 1 : 0);
        if (mentionsMultipleServices < 2) {
          agentMetadata.testComments.push("⚠️ Expected multi-service architecture plan for complex app, but found fewer than 2 distinct Azure services mentioned");
        }
        expect(mentionsMultipleServices).toBeGreaterThanOrEqual(2);

        // Outcome-based behavioral checks
        if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);
        assertDockerfileExplored(agentMetadata);
      });
    }, testTimeoutMs);
  });
});
