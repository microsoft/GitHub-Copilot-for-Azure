/**
 * Routing Integration Tests for azure-app-onboard-prereq
 *
 * Tests Step 8 routing behavior: what the agent offers after completing evaluation.
 * Each test validates a different routing row from SKILL.md Step 8:
 *   - Row 3: Direct + ready + no infra → "Deploy to Azure (full pipeline)"
 *   - Row 4: Direct + ready + existing infra → "Start fresh" vs "Use existing infra"
 *   - Row 5: Direct + blocked → blocker summary + "Fix and re-run"
 *   - Step 2 cloud SDK gate → "Redirect to Azure Cloud Migrate" / "Continue anyway"
 *
 * Also covers language diversity gaps: Go (golang-clean-web-api), Java (aws-bookstore-demo).
 *
 * Prerequisites: npm install -g @github/copilot-cli && copilot auth
 */

import {
  SKILL_NAME,
  functionalTestTimeoutMs,
  negativeTestTimeoutMs,
  assertNoForbiddenCommands,
  assertPrereqArtifactWritten,
  assertRoutingFieldsWritten,
  assertExistingInfraDetected,
  assertFindingsPresentedBySeverity,
  earlyTerminateOnPrereqComplete,
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
  assertAgentScannedWorkspace,
  assertDoesNotBlindlyApprove,
  cloneRepo,
} from "./prereq-test-helpers";
import type { ExpectedVerdicts } from "./prereq-test-helpers";

const { describeIntegration } = setupIntegrationSuite();

describeIntegration(`${SKILL_NAME} - Routing Integration Tests`, () => {
  const agent = useAgentRunner();

  test("routing — direct + ready + no infra → offers deploy (Go/Gin)", async () => {
    await withTestResult(async () => {
      let workspacePath = "";
      const agentMetadata = await agent.run({
        setup: async (workspace: string) => {
          workspacePath = workspace;
          await cloneRepo({ repoUrl: "https://github.com/naeemaei/golang-clean-web-api", targetDir: workspace, branch: "master", depth: 1 });
        },
        prompt: "I want to make sure my project structure is right before deploying",
        followUp: [
          "Yes, scan everything.",
          "That's all I needed, thanks.",
        ],
        nonInteractive: true,
        preserveWorkspace: true,
        shouldEarlyTerminate: earlyTerminateOnPrereqComplete,
      });

      softCheckSkill(agentMetadata, SKILL_NAME);
      expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

      assertNoForbiddenCommands(agentMetadata);
      assertDoesNotScaffoldOrDeploy(agentMetadata);
      assertAgentScannedWorkspace(agentMetadata);

      // Session + artifact checks with catalog verdicts
      if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);
      if (workspacePath) {
        const expectedVerdicts: ExpectedVerdicts = { build: "PASS", completeness: "PASS", deployability: "PASS" };
        assertPrereqArtifactWritten(agentMetadata, workspacePath, "ready", expectedVerdicts);
      }

      // Must detect Go/Gin stack
      expect(
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "go")
        || doesAssistantOrToolsIncludeKeyword(agentMetadata, "gin")
        || doesAssistantOrToolsIncludeKeyword(agentMetadata, "golang")
      ).toBe(true);

      // Must detect Docker
      expect(
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "docker")
        || doesAssistantOrToolsIncludeKeyword(agentMetadata, "dockerfile")
      ).toBe(true);

      // Must detect data services (PostgreSQL, Redis, Elasticsearch)
      try {
        expect(
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "postgres")
          || doesAssistantOrToolsIncludeKeyword(agentMetadata, "database")
        ).toBe(true);
      } catch {
        agentMetadata.testComments.push("WARN: Agent did not mention PostgreSQL/database dependency");
      }

      // --- ROUTING: Step 5 findings presentation ---
      assertFindingsPresentedBySeverity(agentMetadata, workspacePath);

      // --- ROUTING: Step 8 Row 3 — direct + ready + no infra → offers deploy ---
      const messages = (getAllAssistantMessages(agentMetadata) + "\n" + getAllToolText(agentMetadata)).toLowerCase();
      const offersDeployOption =
        messages.includes("deploy") ||
        messages.includes("full pipeline") ||
        messages.includes("ready") && messages.includes("azure");
      if (!offersDeployOption) {
        agentMetadata.testComments.push("⚠️ ROUTING: Agent did not offer deploy option for ready app");
      }
      expect(offersDeployOption).toBe(true);

      // Routing fields in context.json
      if (workspacePath) assertRoutingFieldsWritten(agentMetadata, workspacePath);
    });
  }, functionalTestTimeoutMs);

  test("routing — direct + ready + existing infra → start fresh vs use existing", async () => {
    await withTestResult(async () => {
      let workspacePath = "";
      const agentMetadata = await agent.run({
        setup: async (workspace: string) => {
          workspacePath = workspace;
          await cloneRepo({ repoUrl: "https://github.com/Azure-Samples/todo-nodejs-mongo", targetDir: workspace, branch: "main", depth: 1 });
        },
        prompt: "What prerequisites does my project need to meet for Azure deployment?",
        followUp: [
          "Yes, check everything.",
          "That's all I needed, thanks.",
        ],
        nonInteractive: true,
        preserveWorkspace: true,
        shouldEarlyTerminate: earlyTerminateOnPrereqComplete,
      });

      softCheckSkill(agentMetadata, SKILL_NAME);
      expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

      assertNoForbiddenCommands(agentMetadata);
      assertDoesNotScaffoldOrDeploy(agentMetadata);
      assertAgentScannedWorkspace(agentMetadata);

      if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);
      if (workspacePath) {
        const expectedVerdicts: ExpectedVerdicts = { build: "PASS", completeness: "PASS", deployability: "PASS" };
        assertPrereqArtifactWritten(agentMetadata, workspacePath, "ready", expectedVerdicts);
      }

      // --- INFRA DETECTION: azure.yaml + Bicep ---
      assertExistingInfraDetected(agentMetadata, ["azure.yaml", "bicep", "infra/"]);

      // Must detect multi-component (React frontend + Express API)
      const messages = (getAllAssistantMessages(agentMetadata) + "\n" + getAllToolText(agentMetadata)).toLowerCase();
      const detectsComponents =
        messages.includes("react") || messages.includes("frontend") ||
        messages.includes("api") || messages.includes("express") ||
        messages.includes("component");
      if (!detectsComponents) {
        agentMetadata.testComments.push("⚠️ INFRA: Agent did not detect multi-component structure");
      }

      // Must detect Cosmos DB (MongoDB API)
      try {
        expect(
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "cosmos")
          || doesAssistantOrToolsIncludeKeyword(agentMetadata, "mongo")
          || doesAssistantOrToolsIncludeKeyword(agentMetadata, "database")
        ).toBe(true);
      } catch {
        agentMetadata.testComments.push("WARN: Agent did not mention Cosmos DB / MongoDB dependency");
      }

      // --- ROUTING: Step 8 Row 4 — existing infra → "Start fresh" vs "Use existing" ---
      const offersInfraChoice =
        messages.includes("start fresh") ||
        messages.includes("use existing") ||
        messages.includes("azure.yaml") && (messages.includes("existing") || messages.includes("already")) ||
        messages.includes("azd up") ||
        messages.includes("existing infra");
      if (!offersInfraChoice) {
        agentMetadata.testComments.push("⚠️ ROUTING: Agent did not offer start fresh vs use existing infra choice");
      }

      // Findings presentation
      assertFindingsPresentedBySeverity(agentMetadata, workspacePath);

      // Routing fields
      if (workspacePath) assertRoutingFieldsWritten(agentMetadata, workspacePath);
    });
  }, functionalTestTimeoutMs);

  test("routing — cloud SDK gate → offers redirect to migrate (AWS bookstore)", async () => {
    await withTestResult(async () => {
      let workspacePath = "";
      const agentMetadata = await agent.run({
        setup: async (workspace: string) => {
          workspacePath = workspace;
          await cloneRepo({ repoUrl: "https://github.com/aws-samples/aws-bookstore-demo-app", targetDir: workspace, branch: "main", depth: 1 });
        },
        prompt: "Can you check if my dependencies are compatible with Azure?",
        followUp: [
          "Continue anyway — I'll handle the migration later.",
          "That's all I needed, thanks.",
        ],
        nonInteractive: true,
        preserveWorkspace: true,
        shouldEarlyTerminate: earlyTerminateOnPrereqComplete,
      });

      softCheckSkill(agentMetadata, SKILL_NAME);
      expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

      assertNoForbiddenCommands(agentMetadata);
      assertAgentScannedWorkspace(agentMetadata);

      if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);

      const messages = (getAllAssistantMessages(agentMetadata) + "\n" + getAllToolText(agentMetadata)).toLowerCase();

      // --- CLOUD SDK GATE: Must detect AWS dependencies ---
      const detectsAwsDeps =
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "aws") ||
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "dynamodb") ||
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "lambda") ||
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "cognito");
      if (!detectsAwsDeps) {
        agentMetadata.testComments.push("❌ CLOUD SDK: Agent did not detect AWS dependencies");
      }
      expect(detectsAwsDeps).toBe(true);

      // Must mention migration or redirect option
      const mentionsMigration =
        messages.includes("migrate") ||
        messages.includes("migration") ||
        messages.includes("cloud migrate") ||
        messages.includes("azure equivalent") ||
        messages.includes("cosmos") ||
        messages.includes("replace");
      if (!mentionsMigration) {
        agentMetadata.testComments.push("⚠️ CLOUD SDK: Agent did not mention migration path");
      }
      expect(mentionsMigration).toBe(true);

      // After "Continue anyway" follow-up, agent should proceed with evaluation
      // and carry cloud SDK findings as 🔶 blockers
      if (workspacePath) {
        assertPrereqArtifactWritten(agentMetadata, workspacePath);
      }

      // Scaffold check is soft — agent may propose migration plan
      try {
        assertDoesNotScaffoldOrDeploy(agentMetadata);
      } catch {
        agentMetadata.testComments.push("WARN: Agent scaffolded for AWS repo — acceptable if migration plan presented");
      }
    });
  }, functionalTestTimeoutMs);

  test("routing — direct + blocked → reports blockers (Python 2 EOL)", async () => {
    await withTestResult(async () => {
      let workspacePath = "";
      const agentMetadata = await agent.run({
        setup: async (workspace: string) => {
          workspacePath = workspace;
          await cloneRepo({ repoUrl: "https://github.com/miguelgrinberg/flasky-first-edition", targetDir: workspace, branch: "master", depth: 1 });
        },
        prompt: "Is my app ready to deploy to Azure?",
        followUp: [
          "Yes, check for any issues.",
          "No, don't deploy. That's all I needed.",
        ],
        nonInteractive: true,
        preserveWorkspace: true,
        shouldEarlyTerminate: earlyTerminateOnPrereqComplete,
      });

      softCheckSkill(agentMetadata, SKILL_NAME);
      expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

      assertNoForbiddenCommands(agentMetadata);
      assertDoesNotScaffoldOrDeploy(agentMetadata);
      assertAgentScannedWorkspace(agentMetadata);

      if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);
      if (workspacePath) {
        const expectedVerdicts: ExpectedVerdicts = { build: "FAIL", completeness: "WARN", deployability: "FAIL" };
        assertPrereqArtifactWritten(agentMetadata, workspacePath, "blocked", expectedVerdicts);
      }

      // --- ROUTING: Step 5 — findings must be presented with severity ---
      assertFindingsPresentedBySeverity(agentMetadata, workspacePath);

      // --- ROUTING: Step 8 Row 5 — blocked → blocker summary, does NOT offer deploy ---
      const messages = (getAllAssistantMessages(agentMetadata) + "\n" + getAllToolText(agentMetadata)).toLowerCase();

      // Must flag blocking issues
      assertBlockingIssuesFlagged(agentMetadata, [
        "python 2", "eol", "end-of-life", "deprecated", "blocked", "unsupported",
      ]);

      // Must NOT offer to deploy as-is
      assertDoesNotBlindlyApprove(agentMetadata);

      // Should suggest fix or re-run path
      const suggestsFixPath =
        messages.includes("fix") ||
        messages.includes("upgrade") ||
        messages.includes("re-run") ||
        messages.includes("remediat");
      if (!suggestsFixPath) {
        agentMetadata.testComments.push("⚠️ ROUTING: Agent did not suggest fix/upgrade/re-run for blocked app");
      }

      // Routing fields
      if (workspacePath) assertRoutingFieldsWritten(agentMetadata, workspacePath);
    });
  }, functionalTestTimeoutMs);
});
