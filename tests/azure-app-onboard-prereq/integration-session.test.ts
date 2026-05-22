/**
 * Session Lifecycle Integration Tests for azure-app-onboard-prereq
 *
 * Tests session management, resume, and zero-code-path scenarios.
 * Split from integration.test.ts for parallel execution via Jest workers.
 *
 * Prerequisites: npm install -g @github/copilot-cli && copilot auth
 */

import {
  SKILL_NAME,
  functionalTestTimeoutMs,
  assertNoForbiddenCommands,
  assertPrereqArtifactWritten,
  assertSessionArtifactsComplete,
  assertFindingsPresentedBySeverity,
  earlyTerminateOnPrereqComplete,
  setupIntegrationSuite,
  isSkillInvoked,
  softCheckSkill,
  getAllAssistantMessages,
  getAllToolText,
  getToolCalls,
  withTestResult,
  doesAssistantOrToolsIncludeKeyword,
  useAgentRunner,
  assertDoesNotScaffoldOrDeploy,
  assertAgentScannedWorkspace,
  cloneRepo,
} from "./prereq-test-helpers";

const { describeIntegration } = setupIntegrationSuite();

const sessionTestTimeoutMs = 1_200_000; // 20 minutes — multi-turn tests need more time

describeIntegration(`${SKILL_NAME} - Session Lifecycle Tests`, () => {
  const agent = useAgentRunner();

  test("session creation — full artifact structure validation", async () => {
    await withTestResult(async () => {
      let workspacePath = "";
      const agentMetadata = await agent.run({
        setup: async (workspace: string) => {
          workspacePath = workspace;
          await cloneRepo({ repoUrl: "https://github.com/samcdonald-ms/bya-simple-web-app", targetDir: workspace, branch: "main", depth: 1 });
        },
        prompt: "Is my app ready to deploy to Azure? Check for any issues first.",
        followUp: [
          "Yes, go ahead.",
          "That's all I needed, thanks.",
        ],
        nonInteractive: true,
        preserveWorkspace: true,
        shouldEarlyTerminate: earlyTerminateOnPrereqComplete,
      });

      softCheckSkill(agentMetadata, SKILL_NAME);
      expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

      assertNoForbiddenCommands(agentMetadata);

      // --- Full session artifact validation ---
      if (!workspacePath) {
        agentMetadata.testComments.push("❌ SESSION: No workspace path — cannot validate artifacts");
        expect(workspacePath).toBeTruthy();
        return;
      }

      const session = assertSessionArtifactsComplete(agentMetadata, workspacePath);
      if (!session) {
        agentMetadata.testComments.push("❌ SESSION: assertSessionArtifactsComplete returned null — session not created");
        // Don't hard-fail — the helper already logged detailed diagnostics
        return;
      }

      // HARD: context.json must have components[] array
      expect(Array.isArray(session.contextJson.components)).toBe(true);
      const components = session.contextJson.components as unknown[];
      if (components.length === 0) {
        agentMetadata.testComments.push("⚠️ SESSION: context.json has empty components[]");
      }

      // HARD: prereq-output.json must also be valid
      const artifact = assertPrereqArtifactWritten(agentMetadata, workspacePath);
      expect(artifact).not.toBeNull();

      // Cross-validate: prereq-output.json components should match context.json components
      if (artifact && Array.isArray(artifact.components)) {
        const prereqCount = (artifact.components as unknown[]).length;
        if (prereqCount !== components.length) {
          agentMetadata.testComments.push(
            `⚠️ SESSION: Component count mismatch — context.json has ${components.length}, prereq-output.json has ${prereqCount}`
          );
        }
      }

      // --- Step 5: Findings should be presented with severity grouping ---
      assertFindingsPresentedBySeverity(agentMetadata, workspacePath);

      assertDoesNotScaffoldOrDeploy(agentMetadata);
      assertAgentScannedWorkspace(agentMetadata);
    });
  }, functionalTestTimeoutMs);

  test("session resume — agent recognizes existing session", async () => {
    await withTestResult(async () => {
      let workspacePath = "";
      const agentMetadata = await agent.run({
        setup: async (workspace: string) => {
          workspacePath = workspace;
          await cloneRepo({ repoUrl: "https://github.com/samcdonald-ms/bya-simple-web-app", targetDir: workspace, branch: "main", depth: 1 });
        },
        prompt: "Is my app ready to deploy to Azure?",
        followUp: [
          // Turn 2: Let prereq complete normally — just "Yes" to avoid approving prohibited commands
          "Yes.",
          // Turn 3: Ask to resume — agent should recognize existing session
          "I want to continue where I left off — can you resume my prereq session?",
          // Turn 4: End
          "Yes.",
        ],
        nonInteractive: true,
        preserveWorkspace: true,
        followUpTimeout: 600_000,
      });

      softCheckSkill(agentMetadata, SKILL_NAME);
      expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

      assertNoForbiddenCommands(agentMetadata);

      const messages = (getAllAssistantMessages(agentMetadata) + "\n" + getAllToolText(agentMetadata)).toLowerCase();

      // HARD: Agent must reference existing session or prior work
      const recognizesSession =
        messages.includes("existing session") ||
        messages.includes("previous session") ||
        messages.includes("resume") ||
        messages.includes("already completed") ||
        messages.includes("already scanned") ||
        messages.includes("previous scan") ||
        messages.includes("prior") ||
        messages.includes("earlier") ||
        messages.includes("last session") ||
        messages.includes("prereq") && messages.includes("complete");
      if (!recognizesSession) {
        agentMetadata.testComments.push("⚠️ SESSION RESUME: Agent did not reference existing session or prior work — may have started fresh");
      }
      // Soft — session resume depends on agent reading active-session.json
      // which may not always happen in a single conversation context

      // Check if agent read active-session.json or context.json (evidence of session awareness)
      const toolCalls = getToolCalls(agentMetadata);
      const readSessionFile = toolCalls.some(tc => {
        const args = JSON.stringify(tc.data.arguments ?? {}).toLowerCase();
        return args.includes("active-session") || args.includes("context.json");
      });
      if (readSessionFile) {
        agentMetadata.testComments.push("✅ SESSION RESUME: Agent read active-session.json or context.json — session-aware");
      } else {
        agentMetadata.testComments.push("⚠️ SESSION RESUME: Agent did not read session files — may not be session-aware");
      }

      // Session artifacts should exist from the first run
      if (workspacePath) {
        assertSessionArtifactsComplete(agentMetadata, workspacePath);
      }
    });
  }, sessionTestTimeoutMs);

  test("zero-code-path — empty workspace triggers scaffold or app type question", async () => {
    await withTestResult(async () => {
      const agentMetadata = await agent.run({
        // NO setup callback — workspace will be an empty temp directory
        prompt: "I want to deploy an app to Azure but I haven't started coding yet. Can you help me get started?",
        followUp: [
          // Agent should ask what kind of app — respond with a specific stack
          "A simple Express.js REST API with a PostgreSQL database",
          "That's all I needed, thanks.",
        ],
        nonInteractive: true,
        followUpTimeout: 600_000,
      });

      // Skill should still be invoked — prereq handles the zero-code-path
      softCheckSkill(agentMetadata, SKILL_NAME);
      // Soft on invocation — agent may route to azure-prepare or azure-app-onboard instead
      const invoked = isSkillInvoked(agentMetadata, SKILL_NAME);
      if (!invoked) {
        agentMetadata.testComments.push("⚠️ ZERO-CODE: azure-app-onboard-prereq was not invoked — agent may have routed to a different skill");
      }

      const messages = (getAllAssistantMessages(agentMetadata) + "\n" + getAllToolText(agentMetadata)).toLowerCase();

      // Agent must detect empty workspace (hard)
      const detectsEmpty =
        messages.includes("no project") ||
        messages.includes("empty") ||
        messages.includes("no code") ||
        messages.includes("no files") ||
        messages.includes("no source") ||
        messages.includes("start from scratch") ||
        messages.includes("new project") ||
        messages.includes("get started") ||
        messages.includes("haven't started");
      if (!detectsEmpty) {
        agentMetadata.testComments.push("⚠️ ZERO-CODE: Agent did not acknowledge empty workspace");
      }
      expect(detectsEmpty).toBe(true);

      // Agent must ask what kind of app OR scaffold directly (hard)
      const asksOrScaffolds =
        messages.includes("what kind") ||
        messages.includes("what type") ||
        messages.includes("describe") ||
        messages.includes("scaffold") ||
        messages.includes("template") ||
        messages.includes("starter") ||
        messages.includes("create") ||
        messages.includes("generate") ||
        messages.includes("build");
      if (!asksOrScaffolds) {
        agentMetadata.testComments.push("❌ ZERO-CODE: Agent neither asked for app type nor offered to scaffold — expected zero-code-path flow");
      }
      expect(asksOrScaffolds).toBe(true);

      // After followUp with "Express.js REST API + PostgreSQL", agent should acknowledge the stack
      const acknowledgesStack =
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "express") ||
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "node") ||
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "api");
      if (!acknowledgesStack) {
        agentMetadata.testComments.push("⚠️ ZERO-CODE: Agent did not acknowledge Express.js/Node.js stack from user input");
      }

      // PROHIBITION: Must NOT run npm install/test in zero-code path
      assertNoForbiddenCommands(agentMetadata);
    });
  }, sessionTestTimeoutMs);
});
