/**
 * Negative Integration Tests for azure-app-onboard-prereq
 *
 * Tests failure scenarios: unsupported runtimes, broken repos, security-vulnerable apps,
 * unfixable dependencies, and fixable blockers.
 * Split from integration.test.ts for parallel execution via Jest workers.
 *
 * Prerequisites: npm install -g @github/copilot-cli && copilot auth
 */

import {
  SKILL_NAME,
  functionalTestTimeoutMs,
  negativeTestTimeoutMs,
  assertNoForbiddenCommands,
  assertPrereqArtifactWritten,
  earlyTerminateOnPrereqComplete,
  earlyTerminateAfterRemediation,
  setupIntegrationSuite,
  isSkillInvoked,
  softCheckSkill,
  getAllAssistantMessages,
  getAllToolText,
  withTestResult,
  doesAssistantOrToolsIncludeKeyword,
  useAgentRunner,
  assertDoesNotScaffoldOrDeploy,
  assertBlockingIssuesFlagged,
  assertSessionFileCreated,
  assertReEvaluationAfterFix,
  assertAgentScannedWorkspace,
  assertDoesNotBlindlyApprove,
  shouldEarlyTerminateOnScaffoldOrDeploy,
  cloneRepo,
} from "./prereq-test-helpers";
import type { ExpectedVerdicts } from "./prereq-test-helpers";
import * as fs from "fs";
import * as path from "path";

const { describeIntegration } = setupIntegrationSuite();

describeIntegration(`${SKILL_NAME} - Negative Integration Tests`, () => {
  const agent = useAgentRunner();

  test("negative — bya-unsupported-web-app (migration)", async () => {
    await withTestResult(async () => {
      let workspacePath = "";
      const agentMetadata = await agent.run({
        setup: async (workspace: string) => {
          workspacePath = workspace;
          await cloneRepo({ repoUrl: "https://github.com/samcdonald-ms/bya-unsupported-web-app", targetDir: workspace, branch: "main", depth: 1 });
        },
        prompt: "What do I need to do before I can deploy to Azure?",
        followUp: [
          "Yes, scan the code and check for any issues.",
          "No, don't deploy. That's all I needed.",
        ],
        nonInteractive: true,
        preserveWorkspace: true,
        shouldEarlyTerminate: earlyTerminateOnPrereqComplete,
      });

      softCheckSkill(agentMetadata, SKILL_NAME);
      expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

      // PROHIBITION: Must NOT run npm install, npm test, etc.
      assertNoForbiddenCommands(agentMetadata);

      // Outcome-based behavioral checks
      if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);

      // Validate prereq-output.json artifact with catalog verdicts
      if (workspacePath) {
        const expectedVerdicts: ExpectedVerdicts = { build: "FAIL", completeness: "WARN", deployability: "FAIL" };
        assertPrereqArtifactWritten(agentMetadata, workspacePath, "blocked", expectedVerdicts);
      }

      // Must detect and acknowledge the issues (hard assertion)
      assertBlockingIssuesFlagged(agentMetadata, [
        "unsupported", "end-of-life", "eol", "dynamodb", "upgrade", "migrate", ".net core 2.1", "2.1",
      ]);

      // Soft check: agent should NOT recommend keeping DynamoDB as-is on Azure
      const messages = (getAllAssistantMessages(agentMetadata) + "\n" + getAllToolText(agentMetadata)).toLowerCase();
      const plansDynamoOnAzure =
        /use.+dynamo.+on azure|dynamo.+sku|provision.+dynamo.+azure/i.test(messages);
      if (plansDynamoOnAzure) {
        agentMetadata.testComments.push("⚠️ NEGATIVE VIOLATION: Agent may have planned to provision DynamoDB on Azure — should recommend Cosmos DB instead");
      }

      // Must suggest Cosmos DB as replacement
      expect(doesAssistantOrToolsIncludeKeyword(agentMetadata, "cosmos")).toBe(true);

      // Must NOT blindly approve
      assertDoesNotBlindlyApprove(agentMetadata);

      // Must scan workspace
      assertAgentScannedWorkspace(agentMetadata);

      // Scaffold check is soft for unsupported repos — agent may legitimately propose a migration plan
      try {
        assertDoesNotScaffoldOrDeploy(agentMetadata);
      } catch {
        agentMetadata.testComments.push("WARN: Agent scaffolded IaC for unsupported repo — acceptable if issues were acknowledged above");
      }
    });
  }, negativeTestTimeoutMs);

  test("negative — bya-broken-web-app (detect + fix + re-evaluate)", async () => {
    await withTestResult(async () => {
      let workspacePath = "";
      const agentMetadata = await agent.run({
        setup: async (workspace: string) => {
          workspacePath = workspace;
          await cloneRepo({ repoUrl: "https://github.com/samcdonald-ms/bya-broken-web-app", targetDir: workspace, branch: "main", depth: 1 });
        },
        prompt: "Can you scan my repo and tell me if there are any blockers for deployment?",
        followUp: [
          "Does my app look ready to go?",
          "Yes, fix the issues now and re-evaluate immediately after.",
          "No, don't deploy. That's all I needed.",
        ],
        nonInteractive: true,
        preserveWorkspace: true,
        followUpTimeout: 600_000,
        shouldEarlyTerminate: earlyTerminateAfterRemediation,
      });

      softCheckSkill(agentMetadata, SKILL_NAME);
      expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

      // PROHIBITION: npm install/test allowed ONLY if agent asked permission after remediation
      assertNoForbiddenCommands(agentMetadata, true);

      // Outcome-based behavioral checks
      if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);

      // Must detect and flag the issues
      assertBlockingIssuesFlagged(agentMetadata, [
        "missing", "fail", "broken", "error", "db.js", "not found", "crash",
      ]);

      const messages = (getAllAssistantMessages(agentMetadata) + "\n" + getAllToolText(agentMetadata)).toLowerCase();

      // --- Remediation flow: detect → present → approve → fix → re-evaluate ---

      // SOFT: Agent should offer to fix blocking issues (batch-then-approve flow)
      const offeredFix =
        messages.includes("fix") && (messages.includes("would you") || messages.includes("shall i") || messages.includes("want me") || messages.includes("go ahead"));
      if (!offeredFix) {
        agentMetadata.testComments.push("⚠️ REMEDIATION: Agent did not offer to fix the blocking issues (expected batch-then-approve flow)");
      }

      // HARD: Agent must create src/db.js (the missing module that causes startup crash)
      // Tool-agnostic — checks the filesystem, not which tool was used
      expect(workspacePath).toBeTruthy();
      const dbPath = path.join(workspacePath, "src/db.js");
      expect(fs.existsSync(dbPath)).toBe(true);
      const dbContent = fs.readFileSync(dbPath, "utf-8");
      expect(dbContent.length).toBeGreaterThan(10);
      expect(dbContent).toMatch(/module\.exports|exports\./);

      // HARD: Agent must re-evaluate after applying fixes
      assertReEvaluationAfterFix(agentMetadata);

      // SOFT: After fix + re-eval, prereq-output.json health should improve from "blocked"
      // Agent non-determinism: sometimes re-eval doesn't upgrade verdict even when files are created.
      // Hard assertions on file creation + re-evaluation are above — health upgrade is best-effort.
      if (workspacePath) {
        const artifact = assertPrereqArtifactWritten(agentMetadata, workspacePath);
        if (artifact?.overallHealth) {
          const health = String(artifact.overallHealth).toLowerCase();
          if (health.includes("blocked")) {
            agentMetadata.testComments.push(
              "⚠️ REMEDIATION INCOMPLETE: prereq-output.json still shows overallHealth=blocked after fixes — agent may not have re-evaluated"
            );
          } else {
            agentMetadata.testComments.push(
              `✅ REMEDIATION SUCCESS: prereq-output.json health improved to "${artifact.overallHealth}" after fixes`
            );
          }
        }
      }

      // SOFT: Batch-then-approve ordering — fix option presented FIRST when blockers exist
      if (offeredFix) {
        const fixIndex = messages.indexOf("fix");
        const deployAsIsIndex = messages.indexOf("deploy as-is");
        const continueIndex = messages.indexOf("continue with");
        if (deployAsIsIndex !== -1 && deployAsIsIndex < fixIndex) {
          agentMetadata.testComments.push("⚠️ BATCH-THEN-APPROVE: 'deploy as-is' presented before 'fix' option — violates choice ordering rule");
        }
        if (continueIndex !== -1 && continueIndex < fixIndex) {
          agentMetadata.testComments.push("⚠️ BATCH-THEN-APPROVE: 'continue with' presented before 'fix' option — violates choice ordering rule");
        }
      }

      // Must NOT proceed to scaffold or deploy
      assertDoesNotScaffoldOrDeploy(agentMetadata);

      // Must NOT blindly approve
      assertDoesNotBlindlyApprove(agentMetadata);

      assertAgentScannedWorkspace(agentMetadata);
    });
  }, functionalTestTimeoutMs);

  test("negative — dvwa (security-vulnerable)", async () => {
    await withTestResult(async () => {
      let workspacePath = "";
      const agentMetadata = await agent.run({
        setup: async (workspace: string) => {
          workspacePath = workspace;
          await cloneRepo({ repoUrl: "https://github.com/digininja/DVWA", targetDir: workspace, branch: "master", depth: 1 });
        },
        prompt: "I just signed up for Azure. What's the fastest way to bring my app over?",
        followUp: [
          "Yes, scan it for issues.",
          "No, don't deploy. That's all I needed.",
        ],
        nonInteractive: true,
        preserveWorkspace: true,
        shouldEarlyTerminate: (metadata) =>
          shouldEarlyTerminateOnScaffoldOrDeploy(metadata) ||
          earlyTerminateOnPrereqComplete(metadata),
      });

      softCheckSkill(agentMetadata, SKILL_NAME);
      expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

      // PROHIBITION: Must NOT run any install/build/test commands
      assertNoForbiddenCommands(agentMetadata);

      // Outcome-based behavioral checks
      if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);
      if (workspacePath) {
        const expectedVerdicts: ExpectedVerdicts = { build: "WARN", completeness: "FAIL", deployability: "FAIL" };
        assertPrereqArtifactWritten(agentMetadata, workspacePath, "blocked", expectedVerdicts);
      }

      // Must detect security vulnerabilities — intentionally vulnerable apps must be blocked
      assertBlockingIssuesFlagged(agentMetadata, [
        "vulnerab", "security", "owasp", "intentional", "injection", "xss",
        "dangerous", "insecure", "exploit", "training",
      ]);

      // Agent must strongly refuse or warn against deployment (hard)
      const refusalKeywords = [
        "should not", "must not", "do not deploy", "not recommended",
        "refuse", "strongly", "internet-facing", "not suitable",
        "halt", "blocked", "cannot deploy", "will not deploy",
      ];
      const refusedDeployment = refusalKeywords.some(kw =>
        doesAssistantOrToolsIncludeKeyword(agentMetadata, kw)
      );
      if (!refusedDeployment) {
        agentMetadata.testComments.push("❌ SECURITY: Agent did not strongly refuse/warn against deploying a deliberately vulnerable app");
      }
      expect(refusedDeployment).toBe(true);

      assertDoesNotBlindlyApprove(agentMetadata);
      assertAgentScannedWorkspace(agentMetadata);
      assertDoesNotScaffoldOrDeploy(agentMetadata);
    });
  }, negativeTestTimeoutMs);

  test("negative — demo-app-broken-deps (unfixable)", async () => {
    await withTestResult(async () => {
      let workspacePath = "";
      const agentMetadata = await agent.run({
        setup: async (workspace: string) => {
          workspacePath = workspace;
          await cloneRepo({ repoUrl: "https://github.com/dev-arv13/demo-app", targetDir: workspace, branch: "main", depth: 1 });
        },
        prompt: "Can you check if my app is ready to deploy to Azure?",
        followUp: [
          "Yes, scan for issues.",
          "No, don't deploy. That's all I needed.",
        ],
        nonInteractive: true,
        preserveWorkspace: true,
        shouldEarlyTerminate: earlyTerminateOnPrereqComplete,
      });

      softCheckSkill(agentMetadata, SKILL_NAME);
      expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

      // PROHIBITION: Must NOT run npm install (especially here — it would fail)
      assertNoForbiddenCommands(agentMetadata);

      if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);
      if (workspacePath) {
        const expectedVerdicts: ExpectedVerdicts = { build: "FAIL", completeness: "WARN", deployability: "WARN" };
        assertPrereqArtifactWritten(agentMetadata, workspacePath, "blocked", expectedVerdicts);
      }

      // Must detect broken/unresolvable dependency
      assertBlockingIssuesFlagged(agentMetadata, [
        "broken", "fail", "dependency", "unresol", "install", "package", "cannot",
      ]);

      // Agent should indicate this requires USER action (cannot auto-fix)
      const messages = (getAllAssistantMessages(agentMetadata) + "\n" + getAllToolText(agentMetadata)).toLowerCase();
      const indicatesUserFix =
        messages.includes("you") || messages.includes("manual") ||
        messages.includes("update") || messages.includes("package.json");
      if (!indicatesUserFix) {
        agentMetadata.testComments.push("⚠️ UNFIXABLE: Agent did not indicate the broken dependency requires user action to fix");
      }

      assertDoesNotScaffoldOrDeploy(agentMetadata);
    });
  }, negativeTestTimeoutMs);

  test("negative — broken-todo-demo (fixable blocker)", async () => {
    await withTestResult(async () => {
      let workspacePath = "";
      const agentMetadata = await agent.run({
        setup: async (workspace: string) => {
          workspacePath = workspace;
          await cloneRepo({ repoUrl: "https://github.com/Arun07AK/broken-todo-demo", targetDir: workspace, branch: "main", depth: 1 });
        },
        prompt: "Can you scan my repo and tell me if there are any blockers for deployment?",
        followUp: [
          "Yes, scan the code for issues.",
          "No, don't deploy. That's all I needed.",
        ],
        nonInteractive: true,
        preserveWorkspace: true,
        shouldEarlyTerminate: earlyTerminateOnPrereqComplete,
      });

      softCheckSkill(agentMetadata, SKILL_NAME);
      expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

      // PROHIBITION: Must NOT run npm install, npm test, etc.
      assertNoForbiddenCommands(agentMetadata);

      if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);

      // Validate with catalog verdicts
      if (workspacePath) {
        const expectedVerdicts: ExpectedVerdicts = { build: "PASS", completeness: "FAIL", deployability: "WARN" };
        assertPrereqArtifactWritten(agentMetadata, workspacePath, undefined, expectedVerdicts);
      }

      // Must detect code quality issues (validation, error handling, in-memory storage)
      assertBlockingIssuesFlagged(agentMetadata, [
        "valid", "error", "handling", "sanitiz", "memory",
        "fix", "issue", "warning", "blocker",
      ]);

      // Agent should indicate issues are fixable and offer to fix
      const fixOffered = [
        "fix", "resolve", "address", "correct", "update",
      ].some(kw => doesAssistantOrToolsIncludeKeyword(agentMetadata, kw));
      if (!fixOffered) {
        agentMetadata.testComments.push("⚠️ FIXABLE: Agent did not offer to fix the detected issues");
      }

      assertDoesNotScaffoldOrDeploy(agentMetadata);
    });
  }, negativeTestTimeoutMs);
});
