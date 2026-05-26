/**
 * Integration Tests — Remediation (Fixable Blocker Repos)
 *
 * Validates that AppOnboard correctly detects blocking issues in fixable repos,
 * suggests remediation, applies fixes with user approval, re-evaluates prereqs,
 * and then continues the full pipeline to deployment.
 *
 * Unlike negative tests (which assert the agent halts), remediation tests assert
 * the agent detects → fixes → continues. The expected outcome is a successful
 * post-fix deployment.
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
import * as fs from "fs";
import * as path from "path";
import {
  SKILL_NAME,
  remediationTestTimeoutMs,
  assertBlockingIssuesFlagged,
  assertSessionFileCreated,
  assertReEvaluationAfterFix,
  assertAgentScannedWorkspace,
  assertApprovalGateReachedHard,
  describeAppOnboardWithCleanup,
  SUBSCRIPTION_PRIMER,
} from "./app-onboard-test-helpers";

describeAppOnboardWithCleanup("Remediation Tests", (agent) => {

  describe("catalog-driven — fixable-blocker", () => {
    test("remediation — bya-broken-web-app (detect → fix → deploy)", async () => {
      await withTestResult(async () => {
        let workspacePath = "";
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
            await cloneRepo({ repoUrl: "https://github.com/samcdonald-ms/bya-broken-web-app", targetDir: workspace, branch: "main", depth: 1 });
          },
          prompt: "Can Azure automatically figure out how my app should be deployed?",
          followUp: [
            SUBSCRIPTION_PRIMER,
            "Yes.",
            "Yes.",
            "Yes.",
            "Yes.",
            "Yes.",
            "Yes.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        // --- Phase 1: Detection — agent must find the blockers BEFORE fixing ---

        // Must detect and flag blocking issues (hard assertion)
        assertBlockingIssuesFlagged(agentMetadata, [
          "missing", "fail", "broken", "error", "db.js", "not found", "crash", "blocked",
        ]);

        // Must scan workspace
        assertAgentScannedWorkspace(agentMetadata);

        // Session file created
        if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);

        // --- Phase 2: Remediation — agent must fix and re-evaluate ---

        // If agent applied a code fix, it MUST re-run the prereq scan (hard assertion)
        assertReEvaluationAfterFix(agentMetadata);

        // Prereq remediation safety — hard violation checks
        const toolCalls = getToolCalls(agentMetadata);
        const shellCalls = toolCalls.filter(tc =>
          tc.data.toolName === "powershell" || tc.data.toolName === "bash");

        // npm test/jest after code fixes is acceptable — the user consented to fixes
        // and post-fix verification is standard engineering practice.
        // The install-consent gate below is the real safety check.
        const hasNpmTest = shellCalls.some(tc => {
          const cmd = ((tc.data.arguments as Record<string, unknown>)?.command as string ?? "").toLowerCase();
          return cmd.includes("npm test") || cmd.includes("npx jest") || cmd.includes("npx mocha");
        });
        if (hasNpmTest) {
          agentMetadata.testComments.push("ℹ️ Agent ran test suite (npm test/jest) — acceptable for post-fix verification");
        }

        // Must get SEPARATE install approval before running install commands (prereq Rule 2)
        // Flow: ask_user("fix?") → fix code → ask_user("npm install?") → npm install
        // The ask_user immediately before npm install must be about the install, not the fix.
        const firstInstallIndex = toolCalls.findIndex(tc => {
          if (tc.data.toolName !== "powershell" && tc.data.toolName !== "bash") return false;
          const cmd = ((tc.data.arguments as Record<string, unknown>)?.command as string ?? "").toLowerCase();
          return cmd.includes("npm install") || cmd.includes("pip install") || cmd.includes("dotnet restore");
        });
        const hasInstallCmd = firstInstallIndex !== -1;
        if (hasInstallCmd) {
          // Find the ask_user call closest BEFORE the install command
          let lastAskBeforeInstall = -1;
          let askContent = "";
          for (let i = firstInstallIndex - 1; i >= 0; i--) {
            if (toolCalls[i].data.toolName === "ask_user") {
              lastAskBeforeInstall = i;
              askContent = JSON.stringify(toolCalls[i].data.arguments ?? {}).toLowerCase();
              break;
            }
          }
          // The ask_user before install must specifically mention install/dependencies/validate
          let isInstallApproval = lastAskBeforeInstall !== -1 &&
            (askContent.includes("install") || askContent.includes("npm") ||
             askContent.includes("dependencies") || askContent.includes("validat") ||
             askContent.includes("verify") || askContent.includes("restore"));

          // Fallback: agent may ask via assistant text instead of ask_user tool
          // (nonInteractive mode answers follow-ups directly — the question appears in conversation text)
          if (!isInstallApproval) {
            const allMessages = getAllAssistantMessages(agentMetadata).toLowerCase();
            const hasTextApproval =
              (allMessages.includes("npm install") || allMessages.includes("npm test")) &&
              (allMessages.includes("want me to") || allMessages.includes("shall i") ||
               allMessages.includes("should i") || allMessages.includes("verify the fix") ||
               allMessages.includes("before moving"));
            if (hasTextApproval) {
              isInstallApproval = true;
              agentMetadata.testComments.push("ℹ️ INSTALL APPROVAL: Agent asked via assistant text (not ask_user tool) — accepted");
            }
          }

          if (!isInstallApproval) {
            agentMetadata.testComments.push(
              lastAskBeforeInstall === -1
                ? `\u274c INSTALL WITHOUT APPROVAL: Agent ran install (tool call #${firstInstallIndex}) with no ask_user before it`
                : `\u274c INSTALL APPROVAL MISMATCH: ask_user at #${lastAskBeforeInstall} was not about install — ` +
                  `it must separately ask to run npm install, not reuse the fix approval`
            );
          }
          expect(isInstallApproval).toBe(true);
        }

        // --- Phase 3: Post-fix pipeline — agent should continue to scaffold + deploy ---

        // Approval gate must be reached post-fix (hard — agent must get past fix into planning)
        assertApprovalGateReachedHard(agentMetadata);

        // Post-fix assertions (hard — catalog specifies exact expected outcomes)
        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

        // Stack detection — must identify Express.js
        expect(doesAssistantOrToolsIncludeKeyword(agentMetadata, "express")).toBe(true);

        // Service recommendation — App Service expected post-fix (catalog: B1 Linux, better-sqlite3 blocks F1)
        expect(
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "App Service")
        ).toBe(true);

        // Cost estimation — catalog: ~$12-15/mo
        expect(
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "cost")
          || doesAssistantOrToolsIncludeKeyword(agentMetadata, "pricing")
          || doesAssistantOrToolsIncludeKeyword(agentMetadata, "$")
        ).toBe(true);

        // IaC generation — must produce Bicep files post-fix (catalog: expectedIacFormat: bicep)
        // Check filesystem, not tool calls — IaC is written by sub-agent dispatches
        // whose tool calls don't appear in the main agent's metadata.
        const hasBicepOnDisk = workspacePath && fs.existsSync(workspacePath) && (() => {
          const infraDir = path.join(workspacePath, "infra");
          if (!fs.existsSync(infraDir)) return false;
          const walk = (dir: string): boolean => {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
              if (entry.isDirectory()) { if (walk(path.join(dir, entry.name))) return true; }
              else if (entry.name.endsWith(".bicep") || entry.name.endsWith(".tf")) return true;
            }
            return false;
          };
          return walk(infraDir);
        })();
        if (!hasBicepOnDisk) {
          agentMetadata.testComments.push("❌ IaC: No .bicep/.tf files found in infra/ — scaffold sub-agent may not have run");
        }
        expect(hasBicepOnDisk).toBe(true);

        // Must suggest remediation steps (hard — even if agent doesn't complete deployment, it must surface fixes)
        const suggestsRemediation = /\b(fix|resolve|install|update|add|create)\b/i.test(messages);
        if (!suggestsRemediation) {
          agentMetadata.testComments.push("❌ REMEDIATION: Agent did not suggest remediation steps (fix/resolve/install/update)");
        }
        expect(suggestsRemediation).toBe(true);
      });
    }, remediationTestTimeoutMs);
  });
});
