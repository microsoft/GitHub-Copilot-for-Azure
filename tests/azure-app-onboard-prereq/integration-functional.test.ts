/**
 * Functional Integration Tests for azure-app-onboard-prereq
 *
 * Tests happy-path scenarios: healthy repos, static sites, monorepos, EOL detection.
 * Split from integration.test.ts for parallel execution via Jest workers.
 *
 * Prerequisites: npm install -g @github/copilot-cli && copilot auth
 */

import {
  SKILL_NAME,
  functionalTestTimeoutMs,
  assertNoForbiddenCommands,
  assertPrereqArtifactWritten,
  earlyTerminateOnPrereqComplete,
  setupIntegrationSuite,
  // Re-exported from shared helpers
  isSkillInvoked,
  softCheckSkill,
  getAllAssistantMessages,
  getAllToolText,
  getToolCalls,
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

describeIntegration(`${SKILL_NAME}_functional - Integration Tests`, () => {
  const agent = useAgentRunner();

  test("e2e — bya-simple-web-app (happy path)", async () => {
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

      // Must NOT run forbidden commands on an existing repo
      assertNoForbiddenCommands(agentMetadata);

      // Session file should be created
      if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);

      // Validate prereq-output.json with catalog-driven verdict comparison
      if (workspacePath) {
        const expectedVerdicts: ExpectedVerdicts = { build: "PASS", completeness: "WARN", deployability: "WARN" };
        const artifact = assertPrereqArtifactWritten(agentMetadata, workspacePath, undefined, expectedVerdicts);
        if (artifact?.overallHealth) {
          const health = String(artifact.overallHealth).toLowerCase();
          if (health.includes("blocked")) {
            agentMetadata.testComments.push("❌ FALSE NEGATIVE: healthy repo got overallHealth=blocked — prereq is too aggressive");
          }
        }
      }

      // Stack detection — must identify Express/Node.js
      expect(
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "express")
        || doesAssistantOrToolsIncludeKeyword(agentMetadata, "node")
      ).toBe(true);

      // Must map to Azure services
      const mapsToAzure =
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "app service") ||
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "container") ||
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "function") ||
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "web app") ||
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "hosting");
      if (!mapsToAzure) {
        agentMetadata.testComments.push("❌ DEPLOYABILITY: Did not map to any Azure service");
      }
      expect(mapsToAzure).toBe(true);

      // Must assess feasibility — word-boundary regex to avoid false matches
      const messages = (getAllAssistantMessages(agentMetadata) + "\n" + getAllToolText(agentMetadata)).toLowerCase();
      const assessesFeasibility = /\bfeasib|\bviable|\breadiness\b|\bready\b.*\bdeploy/i.test(messages);
      if (!assessesFeasibility) {
        agentMetadata.testComments.push("❌ FEASIBILITY: Did not assess deployment feasibility");
      }
      expect(assessesFeasibility).toBe(true);

      // Must NOT skip to architecture
      assertDoesNotBlindlyApprove(agentMetadata);

      // Should NOT flag critical blockers on a healthy repo
      const hasCriticalBlocker =
        messages.includes("cannot proceed") ||
        messages.includes("blocked") ||
        (messages.includes("critical") && messages.includes("fail"));
      if (hasCriticalBlocker) {
        agentMetadata.testComments.push("⚠️ FALSE NEGATIVE: Agent reported critical blockers on a healthy Express app");
      }

      // Should NOT scaffold or deploy — prereq is evaluation only
      assertDoesNotScaffoldOrDeploy(agentMetadata);
      // Must scan workspace
      assertAgentScannedWorkspace(agentMetadata);
    });
  }, functionalTestTimeoutMs);

  test("e2e — docker-static-site (Dockerfile + static)", async () => {
    await withTestResult(async () => {
      let workspacePath = "";
      const agentMetadata = await agent.run({
        setup: async (workspace: string) => {
          workspacePath = workspace;
          await cloneRepo({ repoUrl: "https://github.com/nishanttotla/DockerStaticSite", targetDir: workspace, branch: "master", depth: 1 });
        },
        prompt: "Is my app ready to deploy to Azure? Scan for any issues.",
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

      // Must NOT run forbidden commands
      assertNoForbiddenCommands(agentMetadata);

      // Session + artifact checks with catalog verdicts
      if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);
      if (workspacePath) {
        const expectedVerdicts: ExpectedVerdicts = { build: "WARN", completeness: "PASS", deployability: "PASS" };
        const artifact = assertPrereqArtifactWritten(agentMetadata, workspacePath, undefined, expectedVerdicts);
        if (artifact?.overallHealth) {
          const health = String(artifact.overallHealth).toLowerCase();
          if (health.includes("blocked")) {
            agentMetadata.testComments.push("❌ FALSE NEGATIVE: static site with Dockerfile got overallHealth=blocked");
          }
        }
      }

      // Should detect Dockerfile (soft — logs warning if not explored)
      try {
        expect(
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "dockerfile")
          || doesAssistantOrToolsIncludeKeyword(agentMetadata, "docker")
        ).toBe(true);
      } catch {
        agentMetadata.testComments.push("WARN: Agent did not mention Dockerfile — should detect existing Dockerfile");
      }

      // Should detect static site / HTML
      try {
        expect(
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "static")
          || doesAssistantOrToolsIncludeKeyword(agentMetadata, "html")
          || doesAssistantOrToolsIncludeKeyword(agentMetadata, "nginx")
        ).toBe(true);
      } catch {
        agentMetadata.testComments.push("WARN: Agent did not detect static/HTML/nginx stack");
      }

      // Should NOT scaffold or deploy
      assertDoesNotScaffoldOrDeploy(agentMetadata);
      assertAgentScannedWorkspace(agentMetadata);
    });
  }, functionalTestTimeoutMs);

  test("e2e — wetty (completeness check: entry points, deps, config)", async () => {
    await withTestResult(async () => {
      let workspacePath = "";
      const agentMetadata = await agent.run({
        setup: async (workspace: string) => {
          workspacePath = workspace;
          await cloneRepo({ repoUrl: "https://github.com/butlerx/wetty", targetDir: workspace, branch: "main", depth: 1 });
        },
        prompt: "What do I need before I can deploy to Azure?",
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

      // PROHIBITION: Must NOT run npm install/test
      assertNoForbiddenCommands(agentMetadata);

      // Must NOT scaffold or deploy — prereq is read-only evaluation
      assertDoesNotScaffoldOrDeploy(agentMetadata);

      // Session + artifact checks with catalog verdicts
      if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);
      if (workspacePath) {
        const expectedVerdicts: ExpectedVerdicts = { build: "PASS", completeness: "PASS", deployability: "PASS" };
        const artifact = assertPrereqArtifactWritten(agentMetadata, workspacePath, undefined, expectedVerdicts);
        if (artifact?.overallHealth) {
          const health = String(artifact.overallHealth).toLowerCase();
          if (health.includes("blocked")) {
            agentMetadata.testComments.push("❌ FALSE NEGATIVE: wetty (healthy repo with Dockerfile) got overallHealth=blocked");
          }
        }
      }

      // Must detect entry points (package.json, start script)
      const detectsEntryPoints =
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "package.json") ||
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "start") ||
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "main") ||
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "index");
      if (!detectsEntryPoints) {
        agentMetadata.testComments.push("❌ COMPLETENESS: Did not detect entry points (package.json, start, main, index)");
      }
      expect(detectsEntryPoints).toBe(true);

      // Must detect Dockerfile
      const detectsDocker =
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "docker") ||
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "dockerfile") ||
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "container");
      if (!detectsDocker) {
        agentMetadata.testComments.push("❌ COMPLETENESS: Did not detect Dockerfile / Docker");
      }
      expect(detectsDocker).toBe(true);

      // Must detect WebSocket / SSH / terminal nature of the app
      const detectsWebSocket =
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "websocket") ||
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "ssh") ||
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "terminal") ||
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "wetty");
      if (!detectsWebSocket) {
        agentMetadata.testComments.push("❌ COMPLETENESS: Did not detect WebSocket/SSH/terminal nature of the app");
      }
      expect(detectsWebSocket).toBe(true);

      // Must evaluate dependencies
      const checksDependencies =
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "depend") ||
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "package") ||
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "module") ||
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "npm");
      if (!checksDependencies) {
        agentMetadata.testComments.push("❌ COMPLETENESS: Did not evaluate dependencies (depend, package, module, npm)");
      }
      expect(checksDependencies).toBe(true);

      // Must assess configuration
      const checksConfig =
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "config") ||
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "environment") ||
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "env") ||
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "port") ||
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "setting");
      if (!checksConfig) {
        agentMetadata.testComments.push("❌ COMPLETENESS: Did not assess configuration (config, environment, env, port)");
      }
      expect(checksConfig).toBe(true);

      assertAgentScannedWorkspace(agentMetadata);
    });
  }, functionalTestTimeoutMs);

  test("e2e — full-stack-fastapi-template (multi-component: React frontend + FastAPI backend)", async () => {
    await withTestResult(async () => {
      let workspacePath = "";
      const agentMetadata = await agent.run({
        setup: async (workspace: string) => {
          workspacePath = workspace;
          await cloneRepo({ repoUrl: "https://github.com/fastapi/full-stack-fastapi-template", targetDir: workspace, branch: "master", depth: 1 });
        },
        prompt: "Can you scan my repo and tell me if there are any blockers for deployment?",
        followUp: [
          "Yes, scan all components.",
          "That's all I needed, thanks.",
        ],
        nonInteractive: true,
        preserveWorkspace: true,
        shouldEarlyTerminate: earlyTerminateOnPrereqComplete,
      });

      softCheckSkill(agentMetadata, SKILL_NAME);
      expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

      // PROHIBITION: Must NOT run npm install/test, pip install, etc.
      assertNoForbiddenCommands(agentMetadata);

      // Must NOT scaffold or deploy — prereq is read-only evaluation
      assertDoesNotScaffoldOrDeploy(agentMetadata);

      // Session + artifact checks with catalog verdicts
      if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);
      if (workspacePath) {
        const expectedVerdicts: ExpectedVerdicts = { build: "PASS", completeness: "PASS", deployability: "PASS" };
        const artifact = assertPrereqArtifactWritten(agentMetadata, workspacePath, "ready", expectedVerdicts);
        if (artifact && Array.isArray(artifact.components)) {
          agentMetadata.testComments.push(`✅ MULTI-COMPONENT: prereq-output.json has ${artifact.components.length} components`);

          // Should detect at least 2 components (frontend + backend)
          expect(artifact.components.length).toBeGreaterThanOrEqual(2);
        }
      }

      const messages = (getAllAssistantMessages(agentMetadata) + "\n" + getAllToolText(agentMetadata)).toLowerCase();

      // Must detect multi-component structure
      const detectsMultiComponent =
        messages.includes("multiple components") ||
        messages.includes("multi-component") ||
        messages.includes("frontend") ||
        messages.includes("backend") ||
        messages.includes("2 components") ||
        messages.includes("two components") ||
        /\d+\s*(deployable\s+)?components/.test(messages);
      if (!detectsMultiComponent) {
        agentMetadata.testComments.push("❌ MULTI-COMPONENT: Did not detect multiple components");
      }
      expect(detectsMultiComponent).toBe(true);

      // Must detect FastAPI backend
      const detectsFastapi = messages.includes("fastapi") || messages.includes("fast api") || messages.includes("python");
      if (!detectsFastapi) {
        agentMetadata.testComments.push("❌ MULTI-COMPONENT: Did not detect FastAPI/Python backend");
      }
      expect(detectsFastapi).toBe(true);

      // Must detect React frontend
      const detectsReact = messages.includes("react") || messages.includes("typescript") || messages.includes("vite");
      if (!detectsReact) {
        agentMetadata.testComments.push("❌ MULTI-COMPONENT: Did not detect React/TypeScript frontend");
      }
      expect(detectsReact).toBe(true);

      // Must identify PostgreSQL data layer
      const detectsDataLayer =
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "postgres") ||
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "database") ||
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "sqlmodel");
      if (!detectsDataLayer) {
        agentMetadata.testComments.push("❌ MULTI-COMPONENT: Did not identify data layer (postgres, database, sqlmodel)");
      }
      expect(detectsDataLayer).toBe(true);

      assertAgentScannedWorkspace(agentMetadata);
    });
  }, functionalTestTimeoutMs);

  test("e2e — flasky-first-edition (Python 2 EOL + archived repo)", async () => {
    await withTestResult(async () => {
      let workspacePath = "";
      const agentMetadata = await agent.run({
        setup: async (workspace: string) => {
          workspacePath = workspace;
          await cloneRepo({ repoUrl: "https://github.com/miguelgrinberg/flasky-first-edition", targetDir: workspace, branch: "master", depth: 1 });
        },
        prompt: "Check what happens if my app uses something Azure doesn't support?",
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

      // PROHIBITION: Must NOT run pip install, pytest, etc.
      assertNoForbiddenCommands(agentMetadata);

      // Session + artifact checks with catalog verdicts
      if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);
      if (workspacePath) {
        const expectedVerdicts: ExpectedVerdicts = { build: "FAIL", completeness: "WARN", deployability: "FAIL" };
        assertPrereqArtifactWritten(agentMetadata, workspacePath, "blocked", expectedVerdicts);
      }

      const messages = (getAllAssistantMessages(agentMetadata) + "\n" + getAllToolText(agentMetadata)).toLowerCase();

      // Must detect Python 2.7 EOL runtime (hard)
      const detectsPython2Eol =
        (messages.includes("python 2") || messages.includes("python2")) &&
        (messages.includes("eol") || messages.includes("end-of-life") || messages.includes("end of life") ||
         messages.includes("unsupported") || messages.includes("deprecated"));
      if (!detectsPython2Eol) {
        agentMetadata.testComments.push("❌ EOL: Did not detect Python 2.7 as end-of-life / unsupported");
      }
      expect(detectsPython2Eol).toBe(true);

      // Must detect deprecated Flask version (hard)
      const detectsFlaskDeprecated =
        messages.includes("flask") &&
        (messages.includes("deprecated") || messages.includes("old") || messages.includes("0.12") ||
         messages.includes("outdated") || messages.includes("eol") || messages.includes("upgrade"));
      if (!detectsFlaskDeprecated) {
        agentMetadata.testComments.push("❌ EOL: Did not detect deprecated Flask 0.12 / Flask-Script");
      }
      expect(detectsFlaskDeprecated).toBe(true);

      // Must detect archived repo status (hard)
      const detectsArchived =
        messages.includes("archived") || messages.includes("read-only") ||
        messages.includes("unmaintained") || messages.includes("no longer maintained");
      if (!detectsArchived) {
        agentMetadata.testComments.push("⚠️ EOL: Did not detect archived/read-only repo status");
      }
      // Soft — archived detection depends on GitHub API availability
      if (!detectsArchived) {
        agentMetadata.testComments.push("WARN: Archived status detection is best-effort (requires GitHub API)");
      }

      // Must flag as blocking — not approve for deployment
      assertBlockingIssuesFlagged(agentMetadata, [
        "python 2", "eol", "end-of-life", "deprecated", "flask", "unsupported",
      ]);

      // Must NOT blindly approve
      assertDoesNotBlindlyApprove(agentMetadata);

      // Must NOT scaffold or deploy
      assertDoesNotScaffoldOrDeploy(agentMetadata);

      assertAgentScannedWorkspace(agentMetadata);
    });
  }, functionalTestTimeoutMs);
});
