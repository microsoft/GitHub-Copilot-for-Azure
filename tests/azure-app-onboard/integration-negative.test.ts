/**
 * Integration Tests — Negative (Broken/Unsupported Repos)
 *
 * Validates that AppOnboard correctly flags blocking issues and refuses to
 * scaffold/deploy repos that are broken or use unsupported stacks.
 */

import {
  isSkillInvoked,
  softCheckSkill,
  withTestResult,
  getAllAssistantMessages,
  getToolCalls,
} from "../utils/evaluate";
import { cloneRepo } from "../utils/git-clone";
import {
  SKILL_NAME,
  negativeTestTimeoutMs,
  shouldEarlyTerminateOnScaffoldOrDeploy,
  assertDoesNotScaffoldOrDeploy,
  assertBlockingIssuesFlagged,
  assertSessionFileCreated,
  assertReEvaluationAfterFix,
  describeAppOnboardWithCleanup,
} from "./app-onboard-test-helpers";

describeAppOnboardWithCleanup("Negative Tests", (agent) => {

  describe("catalog-driven — negative", () => {
    test("negative — bya-unsupported-web-app (migration)", async () => {
      await withTestResult(async () => {
        let workspacePath = "";
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
            await cloneRepo({ repoUrl: "https://github.com/samcdonald-ms/bya-unsupported-web-app", targetDir: workspace, branch: "main", depth: 1 });
          },
          prompt: "We're running this app today. How do we bring it to Azure with minimal changes?",
          followUp: [
            "What issues did you find with this app?",
            "Is this app ready for Azure as-is?",
            "No, don't deploy. That's all I needed.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateOnScaffoldOrDeploy,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        // Outcome-based behavioral checks
        if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);

        // Must detect and acknowledge the issues (hard assertion)
        assertBlockingIssuesFlagged(agentMetadata, [
          "unsupported", "end-of-life", "eol", "dynamodb", "upgrade", "migrate", ".net core 2.1", "2.1",
        ]);

        // Must NOT recommend provisioning DynamoDB on Azure (it's AWS-only)
        // Use sentence-level matching to avoid false positives from diagnostic text
        // like "use AWSSDK.DynamoDBv2... won't work on Azure" spanning across sentences
        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();
        const sentences = messages.split(/[.!?\n]/);
        const plansDynamoOnAzure = sentences.some(s =>
          /provision\s+dynamo/i.test(s) ||
          /deploy\s+dynamo/i.test(s) ||
          /dynamo.+sku/i.test(s) ||
          /run\s+dynamo.+on\s+azure/i.test(s) ||
          /dynamo.+azure\s+(service|resource|instance)/i.test(s)
        );
        if (plansDynamoOnAzure) {
          agentMetadata.testComments.push("❌ NEGATIVE VIOLATION: Agent planned to provision DynamoDB on Azure — should recommend Cosmos DB instead");
        }
        expect(plansDynamoOnAzure).toBe(false);

        // Must NOT scaffold or deploy for unsupported repos (hard assertion)
        assertDoesNotScaffoldOrDeploy(agentMetadata);
      });
    }, negativeTestTimeoutMs);

    test("negative — bya-broken-web-app", async () => {
      await withTestResult(async () => {
        let workspacePath = "";
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
            await cloneRepo({ repoUrl: "https://github.com/samcdonald-ms/bya-broken-web-app", targetDir: workspace, branch: "main", depth: 1 });
          },
          prompt: "I want to take my local app and put it in the cloud — where do I start?",
          followUp: [
            "Yes, scan the code and check if it's ready for deployment.",
            "Does my app look ready to go?",
            "No, don't deploy. That's all I needed.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateOnScaffoldOrDeploy,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        // Outcome-based behavioral checks
        if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);

        // Must detect and flag the issues
        assertBlockingIssuesFlagged(agentMetadata, [
          "missing", "fail", "broken", "error", "db.js", "not found", "crash",
        ]);

        // Must NOT proceed to scaffold or deploy
        assertDoesNotScaffoldOrDeploy(agentMetadata);

        // B7: If agent applied a code fix, it MUST re-run the prereq scan (hard assertion)
        assertReEvaluationAfterFix(agentMetadata);

        // Prereq remediation safety (B36, prereq-B18/B19)
        const toolCalls = getToolCalls(agentMetadata);
        const shellCalls = toolCalls.filter(tc =>
          tc.data.toolName === "powershell" || tc.data.toolName === "bash");
        const hasNpmTest = shellCalls.some(tc => {
          const cmd = ((tc.data.arguments as Record<string, unknown>)?.command as string ?? "").toLowerCase();
          return cmd.includes("npm test") || cmd.includes("npx jest") || cmd.includes("npx mocha");
        });
        if (hasNpmTest) {
          agentMetadata.testComments.push("\u26a0\ufe0f prereq-B18: Agent ran test suite (npm test/jest) — prereq Rule 10 says 'Do NOT run test suites'");
        }
        const hasInstallWithoutAsk = shellCalls.some(tc => {
          const cmd = ((tc.data.arguments as Record<string, unknown>)?.command as string ?? "").toLowerCase();
          return cmd.includes("npm install") || cmd.includes("pip install") || cmd.includes("dotnet restore");
        });
        const hasAskUser = toolCalls.some(tc => tc.data.toolName === "ask_user");
        if (hasInstallWithoutAsk && !hasAskUser) {
          agentMetadata.testComments.push("\u26a0\ufe0f B36: Agent ran install command without ask_user — prereq Rule 2 requires approval");
        }
      });
    }, negativeTestTimeoutMs);

    test("prereq halt — pipeline stops on NOT_READY", async () => {
      await withTestResult(async () => {
        let workspacePath = "";
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
            await cloneRepo({ repoUrl: "https://github.com/samcdonald-ms/bya-broken-web-app", targetDir: workspace, branch: "main", depth: 1 });
          },
          prompt: "Analyze my project and deploy it to Azure",
          followUp: [
            "What did the scan find?",
            "Is this ready to deploy?",
            "No, don't deploy.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          shouldEarlyTerminate: (metadata) => {
            // Terminate when agent detects blocking issues (NOT_READY verdict)
            // or when it attempts scaffold/deploy (violation)
            const msgs = getAllAssistantMessages(metadata).toLowerCase();
            return shouldEarlyTerminateOnScaffoldOrDeploy(metadata) ||
              /not ready|fix issues|cannot proceed|blocked|missing.*module|not.*deploy/i.test(msgs);
          },
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        // Outcome-based behavioral checks
        if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);

        // Must detect blocking issues and halt (hard assertion)
        assertBlockingIssuesFlagged(agentMetadata, [
          "missing", "fail", "broken", "error", "db.js", "not found", "crash", "blocked",
        ]);

        // Must NOT proceed to prepare phase — no SKU/pricing/architecture planning
        // Exclude preliminary/quick-probe mentions: agent may mention "B1 Basic SKU ~$13/mo" in
        // the gather-intent phase (Step 2) which is informational, not prepare-phase (Step 5).
        // Only flag if SKU appears outside of preliminary context.
        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();
        const hasPreparePhaseSignals = /\b(pricing tier|architecture plan|prepare-plan|service mapping|prepare-plan\.json)\b/i.test(messages);
        const hasSkuInPrepareContext = /\bsku\b/i.test(messages) && !/preliminary|quick probe|initial|recommended/i.test(messages);
        const hasPrepareSignal = hasPreparePhaseSignals || hasSkuInPrepareContext;
        const isQualifiedByRemediation = /before|after fix|once.*resolved|if you fix|after resolving/i.test(messages);
        if (hasPrepareSignal && !isQualifiedByRemediation) {
          agentMetadata.testComments.push("❌ PIPELINE VIOLATION: Agent proceeded to prepare phase (SKU/pricing/architecture) on broken repo without qualifying it as post-fix");
        }
        expect(hasPrepareSignal && !isQualifiedByRemediation).toBe(false);

        // Must NOT scaffold or deploy
        assertDoesNotScaffoldOrDeploy(agentMetadata);

        // Soft: should suggest remediation
        const suggestsRemediation = /\b(fix|resolve|install|update|add|create)\b/i.test(messages);
        if (!suggestsRemediation) {
          agentMetadata.testComments.push("⚠️ Agent halted but did not suggest remediation steps (fix/resolve/install/update)");
        }

        // Soft: check for SKILL.md exact gate phrasing
        const usesSkillGateText = messages.includes("fix issues first") || messages.includes("continue with known risks");
        if (!usesSkillGateText) {
          agentMetadata.testComments.push("⚠️ Agent did not use SKILL.md gate phrasing ('Fix issues first / Continue with known risks') — may have paraphrased");
        }
      });
    }, negativeTestTimeoutMs);
  });
});
