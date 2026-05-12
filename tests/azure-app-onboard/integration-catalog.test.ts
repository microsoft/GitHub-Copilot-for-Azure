/**
 * Integration Tests — Catalog-Driven E2E + Monorepo
 *
 * Tests the full AppOnboard workflow against real repos from repo-catalog.json.
 * Includes positive catalog tests and a complex monorepo test.
 */

import {
  isSkillInvoked,
  softCheckSkill,
  doesAssistantOrToolsIncludeKeyword,
  withTestResult,
  getAllAssistantMessages,
  getToolCalls,
} from "../utils/evaluate";
import { cloneRepo } from "../utils/git-clone";
import {
  SKILL_NAME,
  testTimeoutMs,
  shouldEarlyTerminateForPlanPresented,
  assertApprovalGateReached,
  assertSessionFileCreated,
  assertDockerfileExplored,
  assertPackageJsonExplored,
  assertPhaseArtifactsExist,
  assertContextJsonProgression,
  assertAzdDecisionGatePresented,
  assertDatabaseDetected,
  assertAgentScannedWorkspace,
  describeAppOnboardWithCleanup,
} from "./app-onboard-test-helpers";

describeAppOnboardWithCleanup("Catalog Tests", (agent) => {

  describe("catalog-driven", () => {
    test("e2e — bya-simple-web-app", async () => {
      await withTestResult(async () => {
        let workspacePath = "";
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
            await cloneRepo({ repoUrl: "https://github.com/samcdonald-ms/bya-simple-web-app", targetDir: workspace, branch: "main", depth: 1 });
          },
          prompt: "I have an app in GitHub — can you deploy it to Azure for me?",
          followUp: [
            "Just go with defaults.",
            "Can you show me pricing before anything is created?",
            "No, don't deploy. That's all I needed.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateForPlanPresented,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
        assertApprovalGateReached(agentMetadata);

        // Outcome-based behavioral checks (workspace state + tool exploration)
        if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);
        assertDockerfileExplored(agentMetadata);
        assertPackageJsonExplored(agentMetadata);

        expect(doesAssistantOrToolsIncludeKeyword(agentMetadata, "express")).toBe(true);
        expect(
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "cost")
          || doesAssistantOrToolsIncludeKeyword(agentMetadata, "pricing")
          || doesAssistantOrToolsIncludeKeyword(agentMetadata, "$")
        ).toBe(true);
        expect(
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "App Service")
          || doesAssistantOrToolsIncludeKeyword(agentMetadata, "Container Apps")
        ).toBe(true);

        // Must detect database or auth dependencies (detects_db_or_auth grader)
        const detectsDbOrAuth =
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "sqlite") ||
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "database") ||
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "auth") ||
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "bcrypt") ||
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "session") ||
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "login");
        if (!detectsDbOrAuth) {
          agentMetadata.testComments.push("❌ DB/AUTH: Did not detect database or auth dependencies (sqlite, bcrypt, session, login)");
        }
        expect(detectsDbOrAuth).toBe(true);

        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

        // Must explain deployment steps/walkthrough (explains_steps grader)
        // Non-blocking: in nonInteractive mode with shouldEarlyTerminateForPlanPresented,
        // the agent may be terminated after writing a plan file before explaining steps.
        const explainsSteps = /step|first.+then|walk.+through|plan|phase|next/i.test(messages);
        if (!explainsSteps) {
          agentMetadata.testComments.push("⚠️ STEPS: Did not explain deployment steps or walkthrough (may be due to early termination)");
        }

        // Quick probe should read bounded number of files (probe_stays_shallow grader, max 30)
        // Threshold includes both workspace file reads AND skill reference reads (SKILL.md, pipeline-rules.md, etc.)
        const probeToolNames = ["view", "read_file", "glob"];
        const probeCalls = getToolCalls(agentMetadata).filter(tc => probeToolNames.includes(tc.data.toolName));
        if (probeCalls.length > 30) {
          agentMetadata.testComments.push(`❌ PROBE TOO DEEP: ${probeCalls.length} file reads (max 30 for quick probe)`);
        }
        expect(probeCalls.length).toBeLessThanOrEqual(30);

        // Must scan workspace (scans_repo grader)
        assertAgentScannedWorkspace(agentMetadata);

        // Session integrity checks (B26, B27, B29)
        if (workspacePath) {
          assertPhaseArtifactsExist(agentMetadata, workspacePath, ["prereq-output.json"]);
          assertContextJsonProgression(agentMetadata, workspacePath);
        }

        // SQLite data-loss warning (B10) — bya-simple-web-app uses SQLite
        const hasDataLossWarning = /ephemeral|data loss|not persistent|sqlite.*persist|sqlite.*lost|local storage|file-based.*storage/i.test(messages);
        if (!hasDataLossWarning) {
          agentMetadata.testComments.push("⚠️ B10: No SQLite ephemeral data-loss warning — SKILL.md requires ⛔ formatting for data-loss risks");
        }

        // postDeployRecommendations mentioned (prepare-B3)
        const hasPostDeployRecs = messages.includes("recommend") || messages.includes("suggestion") || messages.includes("post-deploy") || messages.includes("after deploy");
        if (!hasPostDeployRecs) {
          agentMetadata.testComments.push("⚠️ prepare-B3: No postDeployRecommendations surfaced");
        }

        // Approval gate exact text (B25)
        const hasExactGateText =
          (messages.includes("yes") && messages.includes("edit plan") && messages.includes("cancel"));
        if (!hasExactGateText) {
          agentMetadata.testComments.push("⚠️ B25: Approval gate did not include exact 'Yes / Edit plan / Cancel' options");
        }
      });
    }, testTimeoutMs);

    test("e2e — microblog-ai-remix (has existing infra)", async () => {
      await withTestResult(async () => {
        let workspacePath = "";
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
            await cloneRepo({ repoUrl: "https://github.com/Azure-Samples/microblog-ai-remix", targetDir: workspace, branch: "main", depth: 1 });
          },
          prompt: "I have a prototype ready — help me get it to production on Azure",
          followUp: [
            "Just go with defaults.",
            "Explain why you're recommending this approach.",
            "No, don't deploy. That's all I needed.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateForPlanPresented,
        });

        // microblog-ai-remix has existing azure.yaml + Bicep — by design, azd-template-routing
        // routes to azure-prepare instead of azure-app-onboard. Accept either as valid routing.
        softCheckSkill(agentMetadata, SKILL_NAME);
        const routedCorrectly = isSkillInvoked(agentMetadata, SKILL_NAME) || isSkillInvoked(agentMetadata, "azure-prepare");
        if (!routedCorrectly) {
          agentMetadata.testComments.push(`⚠️ Neither azure-app-onboard nor azure-prepare invoked — unexpected routing`);
        }
        expect(routedCorrectly).toBe(true);

        // Outcome-based behavioral checks
        if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);
        assertDockerfileExplored(agentMetadata);
        assertPackageJsonExplored(agentMetadata);

        // Must detect existing Azure infrastructure (azure.yaml, Bicep, azd)
        expect(
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "azure.yaml")
          || doesAssistantOrToolsIncludeKeyword(agentMetadata, "bicep")
          || doesAssistantOrToolsIncludeKeyword(agentMetadata, "azd")
          || doesAssistantOrToolsIncludeKeyword(agentMetadata, "existing infra")
        ).toBe(true);

        // IaC overwrite check is owned by scaffold/integration.test.ts (test 2: microblog-ai-remix)

        // Must detect stack components
        expect(doesAssistantOrToolsIncludeKeyword(agentMetadata, "remix")).toBe(true);

        // Session integrity checks (B26, B29)
        if (workspacePath) {
          assertPhaseArtifactsExist(agentMetadata, workspacePath, ["prereq-output.json"]);
        }

        // Azure.yaml decision gate (Gap 5) — must present choice for existing infra
        assertAzdDecisionGatePresented(agentMetadata);
      });
    }, testTimeoutMs);
  });

  describe("catalog-driven — monorepo", () => {
    test("e2e — fullstack-starter (monorepo, 3 languages)", async () => {
      await withTestResult(async () => {
        let workspacePath = "";
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
            await cloneRepo({ repoUrl: "https://github.com/first-fluke/fullstack-starter", targetDir: workspace, branch: "main", depth: 1 });
          },
          prompt: "I'm a startup founder and need to deploy my MVP on Azure",
          followUp: [
            "Just go with defaults.",
            "What other Azure options did you consider?",
            "No, don't deploy. That's all I needed.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateForPlanPresented,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
        assertApprovalGateReached(agentMetadata);

        // Outcome-based behavioral checks
        if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);

        // Must detect monorepo with multiple components (Next.js + FastAPI + Flutter)
        expect(
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "monorepo")
          || doesAssistantOrToolsIncludeKeyword(agentMetadata, "multiple")
          || doesAssistantOrToolsIncludeKeyword(agentMetadata, "component")
        ).toBe(true);

        // Must detect at least 2 of the 3 deployable stacks
        const stackHits =
          (doesAssistantOrToolsIncludeKeyword(agentMetadata, "Next") || doesAssistantOrToolsIncludeKeyword(agentMetadata, "nextjs") ? 1 : 0) +
          (doesAssistantOrToolsIncludeKeyword(agentMetadata, "FastAPI") || doesAssistantOrToolsIncludeKeyword(agentMetadata, "Python") ? 1 : 0) +
          (doesAssistantOrToolsIncludeKeyword(agentMetadata, "Flutter") || doesAssistantOrToolsIncludeKeyword(agentMetadata, "mobile") || doesAssistantOrToolsIncludeKeyword(agentMetadata, "Dart") ? 1 : 0);
        if (stackHits < 2) {
          agentMetadata.testComments.push(`⚠️ Only ${stackHits}/3 stacks detected (Next.js, FastAPI, Flutter) — expected ≥2`);
        }
        expect(stackHits).toBeGreaterThanOrEqual(2);

        // Must recommend multi-container service (Container Apps or similar)
        try {
          expect(
            doesAssistantOrToolsIncludeKeyword(agentMetadata, "Container Apps")
            || doesAssistantOrToolsIncludeKeyword(agentMetadata, "container")
          ).toBe(true);
        } catch { agentMetadata.testComments.push("WARN: expected 'Container Apps' not found — agent may have proposed alternative"); }

        // Must mention cost estimation
        expect(
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "cost")
          || doesAssistantOrToolsIncludeKeyword(agentMetadata, "pricing")
          || doesAssistantOrToolsIncludeKeyword(agentMetadata, "$")
        ).toBe(true);

        // Database detection (Gap 2) — fullstack-starter has PostgreSQL + Redis
        assertDatabaseDetected(agentMetadata, "postgresql");
        assertDatabaseDetected(agentMetadata, "redis");
      });
    }, testTimeoutMs);
  });
});
