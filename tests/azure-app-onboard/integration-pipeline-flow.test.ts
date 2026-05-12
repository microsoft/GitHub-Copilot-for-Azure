/**
 * Integration Tests — Pipeline Flow & Edge Cases
 *
 * Validates end-to-end pipeline behaviors:
 * - Session resumption — pre-seeded context.json, skip completed phases
 * - Intent stall → defaults — vague responses → proceed with assumptions
 *
 * Deploy-specific tests (handoff) moved to deploy/integration-handoff.test.ts
 * Scaffold-specific tests (IaC override) moved to scaffold/integration-override.test.ts
 *
 * Covers: Gap 4, Gap 5, SKILL.md error handling.
 */

import {
  isSkillInvoked,
  softCheckSkill,
  withTestResult,
  getAllAssistantMessages,
} from "../utils/evaluate";
import { cloneRepo } from "../utils/git-clone";
import {
  describeAppOnboardWithCleanup,
  SKILL_NAME,
  testTimeoutMs,
  shouldEarlyTerminateForPlanPresented,
  shouldEarlyTerminateOnRoutingFailure,
  assertSessionFileCreated,
  readSessionArtifact,
} from "./app-onboard-test-helpers";
import * as fs from "fs";
import * as path from "path";

describeAppOnboardWithCleanup("Pipeline Flow Tests", (agent) => {
  describe("session-resumption", () => {
    test("agent resumes from pre-seeded session, skips completed phases", async () => {
      await withTestResult(async () => {
        let workspacePath = "";
        const sessionId = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
            await cloneRepo({
              repoUrl: "https://github.com/samcdonald-ms/bya-simple-web-app",
              targetDir: workspace,
              branch: "main",
              depth: 1,
            });
            // Pre-seed session with completed prereq and prepare phases
            const sessionDir = path.join(workspace, ".copilot-azure", "sessions", sessionId);
            fs.mkdirSync(sessionDir, { recursive: true });
            fs.writeFileSync(path.join(sessionDir, "context.json"), JSON.stringify({
              sessionId,
              currentPhase: "scaffold",
              completedPhases: ["prereq", "prepare"],
              subscription: { id: "00000000-0000-0000-0000-000000000000", name: "Test Sub" },
              components: [{ name: "web", language: "javascript", framework: "express" }],
              quickProbe: { manifestsFound: ["package.json"], filesRead: ["package.json", "Dockerfile"] },
            }, null, 2));
            fs.writeFileSync(path.join(sessionDir, "prereq-output.json"), JSON.stringify({
              overallHealth: "healthy",
              components: [{ name: "web", language: "javascript", framework: "express", runtime: "node" }],
              blockingIssues: [],
            }, null, 2));
            fs.writeFileSync(path.join(sessionDir, "prepare-plan.json"), JSON.stringify({
              services: [
                { type: "App Service", sku: "B1 Linux", estimatedMonthlyUsd: 12.41 },
              ],
              naming: {
                resourceGroupName: "rg-bya-simple-web-app-abc123",
                suffix: "abc123",
                resourcePrefix: "bya",
                resources: [{ type: "App Service Plan", name: "plan-bya-abc123" }, { type: "App Service", name: "app-bya-abc123" }],
              },
              costEstimate: { totalMonthlyUsd: 12.41, assumptions: ["B1 Linux, 730 hrs/mo"] },
              iacFormat: "bicep",
              deploymentVariables: { location: "eastus" },
              postDeployRecommendations: ["Enable Application Insights", "Configure custom domain"],
            }, null, 2));
          },
          prompt: "Continue deploying my app — I already have a plan ready.",
          followUp: [
            "Yes, use the existing plan.",
            "No, don't deploy. Just generate the infrastructure code.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateForPlanPresented,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        // Routing may vary — agent might handle "continue" without invoking the skill
        if (!isSkillInvoked(agentMetadata, SKILL_NAME)) {
          agentMetadata.testComments.push("⚠️ SESSION RESUMPTION: Skill not invoked — agent may have handled continuity differently");
          return;
        }

        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

        // Soft: should detect existing session artifacts
        const detectsSession =
          messages.includes("existing") || messages.includes("previous") ||
          messages.includes("resume") || messages.includes("continue") ||
          messages.includes("session") || messages.includes("plan");
        if (!detectsSession) {
          agentMetadata.testComments.push("⚠️ SESSION RESUMPTION: Agent did not acknowledge existing session/plan");
        }

        // Soft: should NOT re-run prereq scan (already completed)
        const reRunsPrereq =
          messages.includes("scanning your code") ||
          messages.includes("prerequisite scan") ||
          messages.includes("checking readiness");
        if (reRunsPrereq) {
          agentMetadata.testComments.push("⚠️ SESSION RESUMPTION: Agent re-ran prereq scan — should have skipped (completedPhases includes prereq)");
        }

        // Soft: should reference the prepare plan or move to scaffold
        const referencesplanOrScaffold =
          messages.includes("prepare-plan") || messages.includes("scaffold") ||
          messages.includes("bicep") || messages.includes("infrastructure") ||
          messages.includes("b1") || messages.includes("app service");
        if (!referencesplanOrScaffold) {
          agentMetadata.testComments.push("⚠️ SESSION RESUMPTION: Agent did not reference existing plan or move to scaffold");
        }

        if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);
      });
    }, testTimeoutMs);
  });

  describe("intent-stall", () => {
    test("agent proceeds with defaults after vague responses", async () => {
      await withTestResult(async () => {
        const agentMetadata = await agent.run({
          prompt: "I want to do something with Azure",
          followUp: [
            "I don't know, just something.",
            "I'm not sure what I need.",
            "Whatever you think is best.",
          ],
          nonInteractive: true,
          shouldEarlyTerminate: shouldEarlyTerminateOnRoutingFailure,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);

        // Agent may or may not invoke app-onboard for very vague prompts
        // If it does, it should proceed with defaults after 3 vague rounds
        if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
          const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

          // Soft: should flag assumptions
          const flagsAssumptions =
            messages.includes("assum") || messages.includes("default") ||
            messages.includes("recommend") || messages.includes("suggest");
          if (!flagsAssumptions) {
            agentMetadata.testComments.push("⚠️ INTENT STALL: Agent did not flag assumptions after vague intent");
          }

          // Soft: should still present some Azure service recommendation
          const hasServiceRec =
            messages.includes("app service") || messages.includes("container apps") ||
            messages.includes("static web") || messages.includes("function");
          if (!hasServiceRec) {
            agentMetadata.testComments.push("⚠️ INTENT STALL: Agent did not recommend any Azure service after defaulting");
          }
        } else {
          // Acceptable — very vague prompt may not route to app-onboard
          agentMetadata.testComments.push("ℹ️ INTENT STALL: Skill not invoked — vague prompt did not route to app-onboard (acceptable)");
        }
      });
    }, testTimeoutMs);
  });
});
