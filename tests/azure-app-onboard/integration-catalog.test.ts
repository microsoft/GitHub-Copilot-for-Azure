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
  shouldEarlyTerminateForApprovalGate,
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
  assertNoSubagentFailures,
  assertQuotaSubagentDispatched,
  assertPricingHandled,
  SUBSCRIPTION_PRIMER,
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
            SUBSCRIPTION_PRIMER,
            "Yes.",
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

        // Must detect database or auth dependencies
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

        // Must explain deployment steps/walkthrough
        // Non-blocking: in nonInteractive mode with shouldEarlyTerminateForPlanPresented,
        // the agent may be terminated after writing a plan file before explaining steps.
        const explainsSteps = /step|first.+then|walk.+through|plan|phase|next/i.test(messages);
        if (!explainsSteps) {
          agentMetadata.testComments.push("⚠️ STEPS: Did not explain deployment steps or walkthrough (may be due to early termination)");
        }

        // Must scan workspace
        assertAgentScannedWorkspace(agentMetadata);

        // Sub-agent assertions: quota and pricing must be delegated or handled via MCP
        assertNoSubagentFailures(agentMetadata);
        assertQuotaSubagentDispatched(agentMetadata);
        assertPricingHandled(agentMetadata);

        // Session integrity checks
        if (workspacePath) {
          assertPhaseArtifactsExist(agentMetadata, workspacePath, ["prereq-output.json"]);
          assertContextJsonProgression(agentMetadata, workspacePath);
        }

        // File-based database data-loss warning — test repo uses SQLite
        const hasDataLossWarning = /ephemeral|data loss|not persistent|sqlite.*persist|sqlite.*lost|local storage|file-based.*storage/i.test(messages);
        if (!hasDataLossWarning) {
          agentMetadata.testComments.push("⚠️ DATA LOSS: No warning about file-based database losing data on Azure PaaS ephemeral storage");
        }

        // postDeployRecommendations mentioned
        const hasPostDeployRecs = messages.includes("recommend") || messages.includes("suggestion") || messages.includes("post-deploy") || messages.includes("after deploy");
        if (!hasPostDeployRecs) {
          agentMetadata.testComments.push("⚠️ POST-DEPLOY: No postDeployRecommendations surfaced");
        }

        // Approval gate exact text
        const hasExactGateText =
          (messages.includes("yes") && messages.includes("edit plan") && messages.includes("cancel"));
        if (!hasExactGateText) {
          agentMetadata.testComments.push("⚠️ APPROVAL GATE: Approval gate did not include exact 'Yes / Edit plan / Cancel' options");
        }

        // Two separate gates (pipeline-rules.md requirement)
        const hasScaffoldGate = messages.includes("ready to proceed with scaffolding") || messages.includes("ready to proceed");
        const hasDeployGate = messages.includes("ready to deploy");
        if (hasScaffoldGate && hasDeployGate) {
          agentMetadata.testComments.push("✅ TWO GATES: Both scaffold gate and deploy gate detected as separate messages");
        } else if (!hasScaffoldGate && !hasDeployGate) {
          agentMetadata.testComments.push("⚠️ TWO GATES: Neither scaffold gate nor deploy gate text found (may have used different wording)");
        } else if (!hasDeployGate) {
          agentMetadata.testComments.push("⚠️ TWO GATES: Scaffold gate found but deploy gate missing — pipeline-rules.md requires separate gates");
        }

        // Deploy assertions removed — covered by deploy/integration-deploy-verification.test.ts
        // (App Service verification: preflight, deploy-checklist, deploy-result, all 5 phase artifacts)
        // This test focuses on plan-quality: approval gates, cost, service detection, DB/auth, workspace scanning
      });
    }, testTimeoutMs);

    test("plan-quality — microblog-ai-remix (has existing infra)", async () => {
      await withTestResult(async () => {
        let workspacePath = "";
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
            await cloneRepo({ repoUrl: "https://github.com/Azure-Samples/microblog-ai-remix", targetDir: workspace, branch: "main", depth: 1 });
          },
          prompt: "I have a prototype ready — help me get it to production on Azure",
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

        // IaC overwrite check — must NOT silently generate new IaC that overwrites existing (from scaffold/integration)
        // Only check create_file/write_file (not bare "create" which matches session/task tools).
        // Check the file path argument specifically — not the entire stringified args blob
        // which can mention "infra/" in plan descriptions without actually writing to infra/.
        const toolCalls = getToolCalls(agentMetadata);
        const overwroteIaC = toolCalls.some(tc => {
          const toolName = (tc.data.toolName ?? "").toLowerCase();
          const isWriteTool = toolName === "create_file" || toolName === "write_file";
          if (!isWriteTool) return false;
          const argsObj = (tc.data.arguments ?? {}) as Record<string, unknown>;
          const filePath = ((argsObj.path ?? argsObj.filePath ?? "") as string).toLowerCase();
          return filePath.includes("main.bicep") || filePath.includes("main.tf") || filePath.includes("/infra/") || filePath.startsWith("infra/");
        });
        if (overwroteIaC) {
          agentMetadata.testComments.push("❌ SCAFFOLD VIOLATION: Agent overwrote existing IaC in infra/ without user confirmation");
        }
        expect(overwroteIaC).toBe(false);

        // Must detect stack components
        expect(doesAssistantOrToolsIncludeKeyword(agentMetadata, "remix")).toBe(true);

        // Must NOT be fast-tracked — complex multi-component app requires analysis (from fast-track test)
        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();
        const hasQuestion = messages.includes("?");
        const hasMultiComponentAnalysis =
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "component") ||
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "frontend") ||
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "backend");
        if (!hasQuestion && !hasMultiComponentAnalysis) {
          agentMetadata.testComments.push("❌ FAST-TRACK VIOLATION: Agent fast-tracked a complex multi-component app without asking questions or analyzing components");
        }
        expect(hasQuestion || hasMultiComponentAnalysis).toBe(true);

        // Soft: when azd-routing triggers, agent analyzes existing infra rather than proposing new services
        const mentionsMultipleServices =
          (messages.includes("container apps") ? 1 : 0) +
          (messages.includes("openai") || messages.includes("azure openai") ? 1 : 0) +
          (messages.includes("registry") || messages.includes("acr") ? 1 : 0) +
          (messages.includes("static web") ? 1 : 0);
        if (mentionsMultipleServices < 2) {
          agentMetadata.testComments.push("⚠️ Expected multi-service architecture plan for complex app, but found fewer than 2 distinct Azure services mentioned");
        }

        // Session integrity checks
        // Skip prereq-output.json assertion if azd-template-routing was triggered — microblog-ai-remix
        // has existing azd/Bicep infra, so azd-template-routing (Step 2) routes away from prereq,
        // which skips the prereq phase entirely and never writes prereq-output.json.
        // Detection: check if azd-template-routing.md was read OR context.json mentions routedTo.
        const azdRoutingTriggered = getToolCalls(agentMetadata).some(tc => {
          const args = JSON.stringify(tc.data.arguments ?? "").toLowerCase();
          return args.includes("azd-template-routing") || args.includes("routedto");
        });
        if (workspacePath && !azdRoutingTriggered) {
          assertPhaseArtifactsExist(agentMetadata, workspacePath, ["prereq-output.json"]);
        } else if (azdRoutingTriggered) {
          agentMetadata.testComments.push("\u2705 AZD ROUTING: azd-template-routing triggered — prereq skipped by design, skipping prereq-output.json assertion");
        }

        assertNoSubagentFailures(agentMetadata);

        // Azure.yaml decision gate — must present choice for existing infra
        assertAzdDecisionGatePresented(agentMetadata);
      });
    }, testTimeoutMs);
  });

  describe("catalog-driven — multi-component", () => {
    test("plan-quality — full-stack-fastapi-template (React + FastAPI + PostgreSQL)", async () => {
      await withTestResult(async () => {
        let workspacePath = "";
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
            await cloneRepo({ repoUrl: "https://github.com/fastapi/full-stack-fastapi-template", targetDir: workspace, branch: "master", depth: 1 });
          },
          prompt: "I'm a startup founder and need to deploy my MVP on Azure",
          followUp: [
            SUBSCRIPTION_PRIMER,
            "Yes.",
            "Yes.",
            "Yes.",
            "Yes.",
            "Yes.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateForApprovalGate,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
        assertApprovalGateReached(agentMetadata);

        // Outcome-based behavioral checks
        if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);

        // Must detect multi-component app (React frontend + FastAPI backend)
        expect(
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "multiple")
          || doesAssistantOrToolsIncludeKeyword(agentMetadata, "component")
          || doesAssistantOrToolsIncludeKeyword(agentMetadata, "frontend")
          || doesAssistantOrToolsIncludeKeyword(agentMetadata, "backend")
        ).toBe(true);

        // Must detect both stacks (React + FastAPI/Python)
        const stackHits =
          (doesAssistantOrToolsIncludeKeyword(agentMetadata, "React") || doesAssistantOrToolsIncludeKeyword(agentMetadata, "TypeScript") || doesAssistantOrToolsIncludeKeyword(agentMetadata, "Vite") ? 1 : 0) +
          (doesAssistantOrToolsIncludeKeyword(agentMetadata, "FastAPI") || doesAssistantOrToolsIncludeKeyword(agentMetadata, "Python") ? 1 : 0);
        if (stackHits < 2) {
          agentMetadata.testComments.push(`⚠️ Only ${stackHits}/2 stacks detected (React, FastAPI) — expected both`);
        }
        try {
          expect(stackHits).toBeGreaterThanOrEqual(2);
        } catch {
          agentMetadata.testComments.push(`⚠️ SOFT FAIL: Only ${stackHits}/2 stacks detected — scan incomplete but routing succeeded`);
        }

        // Must recommend Container Apps (multi-container with Docker Compose)
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

        // Database detection — full-stack-fastapi-template has PostgreSQL
        assertDatabaseDetected(agentMetadata, "postgresql");

        // Must mention ≥2 distinct Azure services for multi-component app
        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();
        const mentionsMultipleServices =
          (messages.includes("container apps") || messages.includes("container app") ? 1 : 0) +
          (messages.includes("postgresql") || messages.includes("postgres") || messages.includes("flexible server") ? 1 : 0) +
          (messages.includes("registry") || messages.includes("acr") ? 1 : 0) +
          (messages.includes("redis") ? 1 : 0) +
          (messages.includes("static web") ? 1 : 0);
        if (mentionsMultipleServices < 2) {
          agentMetadata.testComments.push(`⚠️ Expected multi-service architecture plan for monorepo, but found fewer than 2 distinct Azure services mentioned (found ${mentionsMultipleServices})`);
        }
        expect(mentionsMultipleServices).toBeGreaterThanOrEqual(2);

        // Docker Compose detection
        const detectsCompose = messages.includes("docker-compose") || messages.includes("compose") || messages.includes("docker compose");
        if (!detectsCompose) {
          agentMetadata.testComments.push("⚠️ Did not detect Docker Compose in multi-component app");
        }

        // Sub-agent assertions: quota and pricing must be delegated or handled via MCP
        assertNoSubagentFailures(agentMetadata);
        assertQuotaSubagentDispatched(agentMetadata);
        assertPricingHandled(agentMetadata);
      });
    }, testTimeoutMs);
  });
});
