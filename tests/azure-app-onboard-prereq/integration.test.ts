/**
 * Integration Tests for azure-app-onboard-prereq
 *
 * Tests skill invocation with a real Copilot agent session.
 * Includes negative catalog-driven tests for code-readiness gating.
 *
 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 */

import {
  shouldSkipIntegrationTests,
  getIntegrationSkipReason,
  useAgentRunner,
} from "../utils/agent-runner";
import {
  isSkillInvoked,
  softCheckSkill,
  shouldEarlyTerminateForSkillInvocation,
  getAllAssistantMessages,
  getToolCalls,
  withTestResult,
  doesAssistantOrToolsIncludeKeyword,
} from "../utils/evaluate";
import { cloneRepo } from "../utils/git-clone";
import type { AgentMetadata } from "../utils/agent-runner";
import * as fs from "fs";
import * as path from "path";
import {
  assertDoesNotScaffoldOrDeploy,
  assertBlockingIssuesFlagged,
  assertSessionFileCreated,
  assertReEvaluationAfterFix,
  shouldEarlyTerminateOnScaffoldOrDeploy as parentEarlyTerminate,
  assertAgentScannedWorkspace,
  assertDoesNotBlindlyApprove,
} from "../azure-app-onboard/app-onboard-test-helpers";

const SKILL_NAME = "azure-app-onboard-prereq";
const functionalTestTimeoutMs = 900000; // 15 minutes
const negativeTestTimeoutMs = 600000; // 10 minutes — negative tests should flag issues quickly

/** Forbidden commands per SKILL.md absolute prohibition — no package-manager install/build/test. */
const FORBIDDEN_COMMANDS = [
  "npm install", "npm test", "npx jest", "npm run test",
  "pip install", "pytest",
  "dotnet restore", "dotnet test", "dotnet build",
  "cargo build", "go mod download",
];

/**
 * Assert the agent did NOT run any forbidden commands (npm install, npm test, etc.).
 * This is the skill's #1 absolute prohibition — prereq is read-only evaluation.
 *
 * When `allowPostRemediationBuild` is true, npm install/test commands are allowed
 * IF the agent asked for permission first (build-validation gate per remediation-protocol Step 6).
 * Hard-fails if the agent ran commands without asking.
 */
function assertNoForbiddenCommands(agentMetadata: AgentMetadata, allowPostRemediationBuild = false): void {
  const toolCalls = getToolCalls(agentMetadata);
  const violations: string[] = [];

  for (const tc of toolCalls) {
    if (tc.data.toolName !== "powershell" && tc.data.toolName !== "bash" && tc.data.toolName !== "run_command" && tc.data.toolName !== "shell" && tc.data.toolName !== "terminal") continue;
    const cmd = ((tc.data.arguments as Record<string, unknown>)?.command as string ?? "").toLowerCase();
    for (const forbidden of FORBIDDEN_COMMANDS) {
      if (cmd.includes(forbidden)) {
        violations.push(`${tc.data.toolName}: ${forbidden}`);
      }
    }
  }

  if (violations.length > 0) {
    if (allowPostRemediationBuild) {
      // Remediation flow — check if agent asked permission (build-validation gate)
      const messages = getAllAssistantMessages(agentMetadata).toLowerCase();
      const permissionPatterns = [
        /want me to.{0,30}(install|build|run tests)/i,
        /shall i.{0,30}(install|build|run tests)/i,
        /would you like.{0,20}(install|build|run tests)/i,
        /yes\s*\/\s*skip/i,
      ];
      const askedPermission = permissionPatterns.some(p => p.test(messages));
      if (askedPermission) {
        agentMetadata.testComments.push(`✅ BUILD-VALIDATION GATE: Agent asked permission before running: ${violations.join(", ")}`);
      } else {
        agentMetadata.testComments.push(`❌ PROHIBITION VIOLATION: Agent ran commands without asking permission: ${violations.join(", ")}`);
        expect(violations).toHaveLength(0);
      }
    } else {
      agentMetadata.testComments.push(`❌ PROHIBITION VIOLATION: Agent ran forbidden commands: ${violations.join(", ")}`);
      expect(violations).toHaveLength(0);
    }
  }
}

/**
 * Assert prereq-output.json was written to the workspace session directory
 * and contains required fields (components[], overallHealth).
 * Returns the parsed artifact or null if not found (soft on file existence, hard on content).
 */
function assertPrereqArtifactWritten(
  agentMetadata: AgentMetadata,
  workspacePath: string,
  expectedHealth?: "blocked" | "ready" | "warnings",
): Record<string, unknown> | null {
  const sessionDir = path.join(workspacePath, ".copilot-azure", "sessions");
  if (!fs.existsSync(sessionDir)) {
    agentMetadata.testComments.push("⚠️ ARTIFACT NOT FOUND: .copilot-azure/sessions/ does not exist — prereq-output.json not written");
    return null;
  }

  const sessionFolders = fs.readdirSync(sessionDir).filter(f =>
    fs.statSync(path.join(sessionDir, f)).isDirectory());

  let prereqOutput: Record<string, unknown> | null = null;
  for (const folder of sessionFolders) {
    const prereqPath = path.join(sessionDir, folder, "prereq-output.json");
    if (fs.existsSync(prereqPath)) {
      try {
        prereqOutput = JSON.parse(fs.readFileSync(prereqPath, "utf-8")) as Record<string, unknown>;
      } catch {
        agentMetadata.testComments.push("⚠️ ARTIFACT MALFORMED: prereq-output.json exists but is not valid JSON");
      }
      break;
    }
  }

  if (!prereqOutput) {
    // Check if agent wrote it via tool calls but to a different location
    const toolCalls = getToolCalls(agentMetadata);
    const wrotePrereq = toolCalls.some(tc =>
      (tc.data.toolName === "create_file" || tc.data.toolName === "create" || tc.data.toolName === "write_file") &&
      JSON.stringify(tc.data.arguments ?? {}).includes("prereq-output"));
    if (wrotePrereq) {
      agentMetadata.testComments.push("⚠️ ARTIFACT LOCATION: Agent wrote prereq-output.json via tool call but file not found at expected session path");
    } else {
      agentMetadata.testComments.push("⚠️ ARTIFACT MISSING: prereq-output.json was never written");
    }
    return null;
  }

  // Validate required fields
  if (!Array.isArray(prereqOutput.components)) {
    agentMetadata.testComments.push("⚠️ ARTIFACT SCHEMA: prereq-output.json missing components[] array");
  }
  expect(Array.isArray(prereqOutput.components)).toBe(true);
  if (!prereqOutput.overallHealth) {
    agentMetadata.testComments.push("⚠️ ARTIFACT SCHEMA: prereq-output.json missing overallHealth field");
  }
  expect(prereqOutput.overallHealth).toBeTruthy();

  // Validate expected health status if specified
  if (expectedHealth && prereqOutput.overallHealth) {
    const health = String(prereqOutput.overallHealth).toLowerCase();
    if (!health.includes(expectedHealth)) {
      agentMetadata.testComments.push(
        `⚠️ HEALTH MISMATCH: expected overallHealth to include "${expectedHealth}", got "${prereqOutput.overallHealth}"`
      );
    }
  }

  agentMetadata.testComments.push(`✅ prereq-output.json validated: overallHealth=${prereqOutput.overallHealth}, components=${Array.isArray(prereqOutput.components) ? prereqOutput.components.length : "missing"}`);
  return prereqOutput;
}

/**
 * Early terminate for prereq negative tests — wraps the shared helper but also
 * accepts azure-app-onboard-prereq as a valid invoked skill (the orchestrator
 * may delegate to prereq internally).
 */
function shouldEarlyTerminateOnScaffoldOrDeploy(agentMetadata: AgentMetadata): boolean {
  // Accept either prereq or orchestrator invocation
  if (!isSkillInvoked(agentMetadata, SKILL_NAME) && !isSkillInvoked(agentMetadata, "azure-app-onboard")) {
    return false;
  }
  // Delegate to the shared implementation (which checks tool calls for deploy/scaffold actions)
  return parentEarlyTerminate(agentMetadata);
}

const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

describeIntegration(`${SKILL_NAME}_ - Integration Tests`, () => {
  const agent = useAgentRunner();

  describe("skill-invocation", () => {
    test("invokes azure-app-onboard-prereq skill for repo-readiness prompt", async () => {
      try {
        const agentMetadata = await agent.run({
          prompt: "Scan my repo and tell me if my project can be deployed to Azure",
          nonInteractive: true,
          shouldEarlyTerminate: (metadata) =>
            shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME),
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
      } catch (e: unknown) {
        if (
          e instanceof Error &&
          e.message?.includes("Failed to load @github/copilot-sdk")
        ) {
          console.log("⏭️  SDK not loadable, skipping test");
          return;
        }
        throw e;
      }
    });

    test("invokes azure-app-onboard-prereq for session init (no workspace, no repo)", async () => {
      try {
        const agentMetadata = await agent.run({
          prompt: "Can you check if my dependencies are compatible with Azure?",
          nonInteractive: true,
          shouldEarlyTerminate: (metadata) =>
            shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME),
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        // Must mention evaluation phases — agent should outline the prereq workflow
        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();
        const phaseKeywords = ["build", "completeness", "deployability", "readiness", "prerequisites", "prerequisite", "evaluation", "assessment"];
        const phaseCount = phaseKeywords.filter(k => messages.includes(k)).length;
        if (phaseCount < 2) {
          agentMetadata.testComments.push(`❌ SESSION INIT: Only ${phaseCount} evaluation phases mentioned (expected ≥2)`);
        }
        expect(phaseCount).toBeGreaterThanOrEqual(2);
      } catch (e: unknown) {
        if (
          e instanceof Error &&
          e.message?.includes("Failed to load @github/copilot-sdk")
        ) {
          console.log("⏭️  SDK not loadable, skipping test");
          return;
        }
        throw e;
      }
    });
  });

  describe("catalog-driven — functional", () => {
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
            "Yes, scan the code and check for any issues.",
            "That's all I needed, thanks.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateOnScaffoldOrDeploy,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        // Must NOT run forbidden commands on an existing repo
        assertNoForbiddenCommands(agentMetadata);

        // Session file should be created
        if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);

        // Validate prereq-output.json — healthy repo should NOT be "blocked"
        if (workspacePath) {
          const artifact = assertPrereqArtifactWritten(agentMetadata, workspacePath);
          if (artifact?.overallHealth) {
            const health = String(artifact.overallHealth).toLowerCase();
            if (health.includes("blocked")) {
              agentMetadata.testComments.push("❌ FALSE NEGATIVE: healthy repo got overallHealth=blocked — prereq is too aggressive");
            }
          }
        }

        // Stack detection — must identify Express/Node.js (detects_tech_stack grader — hard)
        expect(
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "express")
          || doesAssistantOrToolsIncludeKeyword(agentMetadata, "node")
        ).toBe(true);

        // Must map to Azure services (maps_to_azure_services grader)
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

        // Must assess feasibility (assesses_feasibility grader)
        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();
        const assessesFeasibility = /feasib|viable|deploy|compatible|ready/i.test(messages);
        if (!assessesFeasibility) {
          agentMetadata.testComments.push("❌ FEASIBILITY: Did not assess deployment feasibility");
        }
        expect(assessesFeasibility).toBe(true);

        // Must NOT skip to architecture (does_not_skip_to_architecture grader)
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
        // Must scan workspace (scans_repo grader)
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
          shouldEarlyTerminate: shouldEarlyTerminateOnScaffoldOrDeploy,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        // Must NOT run forbidden commands
        assertNoForbiddenCommands(agentMetadata);

        // Session + artifact checks
        if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);
        if (workspacePath) {
          const artifact = assertPrereqArtifactWritten(agentMetadata, workspacePath);
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
        // Must scan workspace (scans_repo grader)
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
          shouldEarlyTerminate: shouldEarlyTerminateOnScaffoldOrDeploy,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        // PROHIBITION: Must NOT run npm install/test
        assertNoForbiddenCommands(agentMetadata);

        // Must NOT scaffold or deploy — prereq is read-only evaluation
        assertDoesNotScaffoldOrDeploy(agentMetadata);

        // Session + artifact checks
        if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);
        if (workspacePath) {
          const artifact = assertPrereqArtifactWritten(agentMetadata, workspacePath);
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
        // Must evaluate dependencies (checks_dependencies grader)
        const checksDependencies =
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "depend") ||
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "package") ||
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "module") ||
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "npm");
        if (!checksDependencies) {
          agentMetadata.testComments.push("❌ COMPLETENESS: Did not evaluate dependencies (depend, package, module, npm)");
        }
        expect(checksDependencies).toBe(true);

        // Must assess configuration (checks_config grader)
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

        // Must scan workspace (scans_repo grader)
        assertAgentScannedWorkspace(agentMetadata);
      });
    }, functionalTestTimeoutMs);

    test("e2e — fullstack-starter (monorepo: 4 components, Flutter scope boundary)", async () => {
      await withTestResult(async () => {
        let workspacePath = "";
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
            await cloneRepo({ repoUrl: "https://github.com/first-fluke/fullstack-starter", targetDir: workspace, branch: "main", depth: 1 });
          },
          prompt: "Can you scan my repo and tell me if there are any blockers for deployment?",
          followUp: [
            "Yes, scan all components.",
            "That's all I needed, thanks.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateOnScaffoldOrDeploy,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        // PROHIBITION: Must NOT run npm install/test, pip install, etc.
        assertNoForbiddenCommands(agentMetadata);

        // Must NOT scaffold or deploy — prereq is read-only evaluation
        assertDoesNotScaffoldOrDeploy(agentMetadata);

        // Session + artifact checks
        if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);
        if (workspacePath) {
          const artifact = assertPrereqArtifactWritten(agentMetadata, workspacePath);
          if (artifact && Array.isArray(artifact.components)) {
            agentMetadata.testComments.push(`✅ MONOREPO: prereq-output.json has ${artifact.components.length} components`);
          }
        }

        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

        // Must detect monorepo structure
        const detectsMonorepo =
          messages.includes("monorepo") ||
          messages.includes("multiple components") ||
          messages.includes("multi-component") ||
          messages.includes("multiple services") ||
          messages.includes("multi-service");
        if (!detectsMonorepo) {
          agentMetadata.testComments.push("❌ MONOREPO: Did not detect monorepo / multiple components");
        }
        expect(detectsMonorepo).toBe(true);

        // Must flag Flutter as non-deployable to Azure
        const mentionsFlutter = messages.includes("flutter");
        if (!mentionsFlutter) {
          agentMetadata.testComments.push("❌ MONOREPO: Did not mention Flutter component");
        }
        expect(mentionsFlutter).toBe(true);

        const flagsFlutterScope =
          messages.includes("not deployable") || messages.includes("mobile") ||
          messages.includes("scope") || messages.includes("unsupported") ||
          messages.includes("not supported") || messages.includes("cannot deploy") ||
          messages.includes("not applicable") || messages.includes("n/a") ||
          messages.includes("client") || messages.includes("native");
        if (!flagsFlutterScope) {
          agentMetadata.testComments.push("❌ MONOREPO: Mentioned Flutter but did not flag it as non-deployable / out of scope for Azure");
        }
        expect(flagsFlutterScope).toBe(true);

        // Must detect ≥3 deployable components (Next.js, FastAPI, worker)
        const detectsNextjs = messages.includes("next") || messages.includes("nextjs") || messages.includes("next.js");
        const detectsFastapi = messages.includes("fastapi") || messages.includes("fast api");
        const detectsWorker = messages.includes("worker") || messages.includes("background") || messages.includes("task");
        const componentCount = (detectsNextjs ? 1 : 0) + (detectsFastapi ? 1 : 0) + (detectsWorker ? 1 : 0);
        if (componentCount < 3) {
          agentMetadata.testComments.push(
            `❌ MONOREPO: Only ${componentCount}/3 deployable components detected (next=${detectsNextjs}, fastapi=${detectsFastapi}, worker=${detectsWorker})`
          );
        }
        expect(componentCount).toBeGreaterThanOrEqual(3);

        // Must also identify data layer (identifies_key_components grader requires both groups)
        const detectsDataLayer =
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "postgres") ||
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "redis") ||
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "database");
        if (!detectsDataLayer) {
          agentMetadata.testComments.push("❌ MONOREPO: Did not identify data layer (postgres, redis, database)");
        }
        expect(detectsDataLayer).toBe(true);

        // Must scan workspace (scans_repo grader)
        assertAgentScannedWorkspace(agentMetadata);
      });
    }, functionalTestTimeoutMs);
  });

  describe("catalog-driven — negative", () => {
    test("negative — bya-unsupported-web-app (migration)", async () => {
      await withTestResult(async () => {
        let workspacePath = "";
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
            await cloneRepo({ repoUrl: "https://github.com/samcdonald-ms/bya-unsupported-web-app", targetDir: workspace, branch: "main", depth: 1 });
          },
          // Golden prompt — 100% stable routing to azure-app-onboard-prereq per golden-prompt-log.md.
          // "to do" action verb insertion is the proven fix for passive routing failures.
          prompt: "What do I need to do before I can deploy to Azure?",
          followUp: [
            "Yes, scan the code and check for any issues.",
            "No, don't deploy. That's all I needed.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateOnScaffoldOrDeploy,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        // PROHIBITION: Must NOT run npm install, npm test, etc.
        assertNoForbiddenCommands(agentMetadata);

        // Outcome-based behavioral checks
        if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);

        // Validate prereq-output.json artifact — should be "blocked" for unsupported repo
        if (workspacePath) assertPrereqArtifactWritten(agentMetadata, workspacePath, "blocked");

        // Must detect and acknowledge the issues (hard assertion)
        assertBlockingIssuesFlagged(agentMetadata, [
          "unsupported", "end-of-life", "eol", "dynamodb", "upgrade", "migrate", ".net core 2.1", "2.1",
        ]);

        // Soft check: agent should NOT recommend keeping DynamoDB as-is on Azure.
        // The regex is intentionally narrow — the agent will naturally mention "DynamoDB"
        // alongside "deploy"/"provision" when explaining WHY the app is unsupported.
        // Only flag if the agent explicitly says to use DynamoDB on Azure with a SKU.
        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();
        const plansDynamoOnAzure =
          /use.+dynamo.+on azure|dynamo.+sku|provision.+dynamo.+azure/i.test(messages);
        if (plansDynamoOnAzure) {
          agentMetadata.testComments.push("⚠️ NEGATIVE VIOLATION: Agent may have planned to provision DynamoDB on Azure — should recommend Cosmos DB instead");
        }

        // Must suggest Cosmos DB as replacement (suggests_cosmos_db_replacement grader)
        expect(doesAssistantOrToolsIncludeKeyword(agentMetadata, "cosmos")).toBe(true);

        // Must NOT blindly approve (does_not_blindly_approve grader)
        assertDoesNotBlindlyApprove(agentMetadata);

        // Must scan workspace (scans_repo grader)
        assertAgentScannedWorkspace(agentMetadata);

        // Scaffold check is soft for unsupported repos — agent may legitimately propose a migration plan
        // The hard requirement is that it acknowledged the issues above
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
            // Approve remediation — test the fix flow (missing db.js should trigger an offer to fix)
            "Yes, go ahead and fix the issues you found.",
            // After fix, confirm re-evaluation
            "Yes, re-scan to verify the fixes.",
            "No, don't deploy. That's all I needed.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          followUpTimeout: 600_000, // 10 min per follow-up — fixes + re-scan take time
          shouldEarlyTerminate: shouldEarlyTerminateOnScaffoldOrDeploy,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        // PROHIBITION: npm install/test allowed ONLY if agent asked permission after remediation
        // (build-validation gate per remediation-protocol Step 6). Hard-fail if run without asking.
        assertNoForbiddenCommands(agentMetadata, true);

        // Outcome-based behavioral checks
        if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);

        // Must detect and flag the issues
        assertBlockingIssuesFlagged(agentMetadata, [
          "missing", "fail", "broken", "error", "db.js", "not found", "crash",
        ]);

        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();
        const toolCalls = getToolCalls(agentMetadata);

        // --- Remediation flow: detect → present → approve → fix → re-evaluate ---

        // SOFT: Agent should offer to fix blocking issues (batch-then-approve flow)
        const offeredFix =
          messages.includes("fix") && (messages.includes("would you") || messages.includes("shall i") || messages.includes("want me") || messages.includes("go ahead"));
        if (!offeredFix) {
          agentMetadata.testComments.push("⚠️ REMEDIATION: Agent did not offer to fix the blocking issues (expected batch-then-approve flow)");
        }

        // HARD: Agent must create source files to fix the issues.
        // bya-broken-web-app is missing src/db.js and public/css/style.css.
        const createdSourceFiles = toolCalls.filter(tc => {
          const toolName = (tc.data.toolName ?? "").toLowerCase();
          if (toolName !== "create" && toolName !== "create_file" && toolName !== "write_file") return false;
          const filePath = (
            (tc.data.arguments as Record<string, unknown>)?.file_path as string ??
            (tc.data.arguments as Record<string, unknown>)?.path as string ??
            (tc.data.arguments as Record<string, unknown>)?.filePath as string ?? ""
          ).toLowerCase();
          // Source files the agent should create — not IaC, not session artifacts
          return (/\.(js|jsx|ts|tsx|py|java|cs|go|rb|php|css|html|vue|svelte)$/.test(filePath)) &&
            !filePath.includes("infra/") && !filePath.includes(".copilot-azure/");
        });

        if (createdSourceFiles.length === 0) {
          agentMetadata.testComments.push(
            "❌ REMEDIATION: Agent did not create any source files to fix the broken app — expected db.js and/or style.css"
          );
        } else {
          const createdPaths = createdSourceFiles.map(tc =>
            (tc.data.arguments as Record<string, unknown>)?.file_path ??
            (tc.data.arguments as Record<string, unknown>)?.path ??
            (tc.data.arguments as Record<string, unknown>)?.filePath ?? "unknown"
          );
          agentMetadata.testComments.push(
            `✅ REMEDIATION: Agent created ${createdSourceFiles.length} source file(s): ${createdPaths.join(", ")}`
          );
        }
        expect(createdSourceFiles.length).toBeGreaterThan(0);

        // HARD: Agent must re-evaluate after applying fixes (B7 check)
        assertReEvaluationAfterFix(agentMetadata);

        // SOFT: After fix + re-eval, prereq-output.json health should improve.
        if (workspacePath) {
          const artifact = assertPrereqArtifactWritten(agentMetadata, workspacePath);
          if (artifact?.overallHealth) {
            const health = String(artifact.overallHealth).toLowerCase();
            if (health.includes("blocked")) {
              agentMetadata.testComments.push(
                "⚠️ REMEDIATION INCOMPLETE: prereq-output.json still shows overallHealth=blocked after fixes — " +
                "agent may have written the initial assessment but not updated it post-remediation"
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

        // Must NOT blindly approve (does_not_blindly_approve grader)
        assertDoesNotBlindlyApprove(agentMetadata);

        // Must scan workspace (scans_repo grader)
        assertAgentScannedWorkspace(agentMetadata);
      });
    }, functionalTestTimeoutMs); // Bumped from negativeTestTimeoutMs — remediation + re-eval needs more time

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
          shouldEarlyTerminate: shouldEarlyTerminateOnScaffoldOrDeploy,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        // PROHIBITION: Must NOT run any install/build/test commands
        assertNoForbiddenCommands(agentMetadata);

        // Outcome-based behavioral checks
        if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);
        if (workspacePath) assertPrereqArtifactWritten(agentMetadata, workspacePath, "blocked");

        // Must detect security vulnerabilities — this is an automatic FAIL per readiness-gate.md
        // "Intentionally vulnerable applications" is a Critical tier automatic FAIL
        assertBlockingIssuesFlagged(agentMetadata, [
          "vulnerab", "security", "owasp", "intentional", "injection", "xss",
          "dangerous", "insecure", "exploit", "training",
        ]);

        // Agent must strongly refuse or warn against deployment (warns_against_deployment grader — hard)
        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();
        const refusedDeployment =
          messages.includes("should not") || messages.includes("must not") ||
          messages.includes("do not deploy") || messages.includes("not recommended") ||
          messages.includes("refuse") || messages.includes("strongly") ||
          messages.includes("internet-facing") || messages.includes("not suitable");
        if (!refusedDeployment) {
          agentMetadata.testComments.push("❌ SECURITY: Agent did not strongly refuse/warn against deploying a deliberately vulnerable app");
        }
        expect(refusedDeployment).toBe(true);

        // Must NOT blindly approve (does_not_plan_architecture grader)
        assertDoesNotBlindlyApprove(agentMetadata);

        // Must scan workspace (scans_repo grader)
        assertAgentScannedWorkspace(agentMetadata);

        // Must NOT scaffold or deploy — absolute hard assertion for security-vulnerable repos
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
          shouldEarlyTerminate: shouldEarlyTerminateOnScaffoldOrDeploy,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        // PROHIBITION: Must NOT run npm install (especially here — it would fail)
        assertNoForbiddenCommands(agentMetadata);

        // Outcome-based behavioral checks
        if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);
        if (workspacePath) assertPrereqArtifactWritten(agentMetadata, workspacePath, "blocked");

        // Must detect broken/unresolvable dependency
        assertBlockingIssuesFlagged(agentMetadata, [
          "broken", "fail", "dependency", "unresol", "install", "package", "cannot",
        ]);

        // Agent should indicate this requires USER action (cannot auto-fix)
        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();
        const indicatesUserFix =
          messages.includes("you") || messages.includes("manual") ||
          messages.includes("update") || messages.includes("package.json");
        if (!indicatesUserFix) {
          agentMetadata.testComments.push("⚠️ UNFIXABLE: Agent did not indicate the broken dependency requires user action to fix");
        }

        // Must NOT scaffold or deploy
        assertDoesNotScaffoldOrDeploy(agentMetadata);
      });
    }, negativeTestTimeoutMs);

    test("negative — flasky-first-edition (deprecated Python 2.7)", async () => {
      await withTestResult(async () => {
        let workspacePath = "";
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
            await cloneRepo({ repoUrl: "https://github.com/miguelgrinberg/flasky-first-edition", targetDir: workspace, branch: "master", depth: 1 });
          },
          prompt: "What do I need to do before I can deploy this to Azure?",
          followUp: [
            "Yes, scan the code for issues.",
            "No, don't deploy. That's all I needed.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateOnScaffoldOrDeploy,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        // PROHIBITION: Must NOT run pip install, pytest, etc.
        assertNoForbiddenCommands(agentMetadata);

        // Outcome-based behavioral checks
        if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);
        if (workspacePath) assertPrereqArtifactWritten(agentMetadata, workspacePath, "blocked");

        // Must detect Python 2.7 EOL / deprecated frameworks
        assertBlockingIssuesFlagged(agentMetadata, [
          "python 2", "2.7", "end-of-life", "eol", "deprecated", "unsupported",
          "flask-script", "outdated", "upgrade",
        ]);

        // Agent should indicate this requires significant user effort (cannot auto-fix)
        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();
        const indicatesMajorUpgrade =
          messages.includes("python 3") || messages.includes("upgrade") ||
          messages.includes("modernize") || messages.includes("migrate") ||
          messages.includes("rewrite");
        if (!indicatesMajorUpgrade) {
          agentMetadata.testComments.push("⚠️ DEPRECATED: Agent did not suggest Python 3 upgrade or major modernization effort");
        }

        // Must NOT scaffold or deploy
        assertDoesNotScaffoldOrDeploy(agentMetadata);
      });
    }, negativeTestTimeoutMs);
  });

});
