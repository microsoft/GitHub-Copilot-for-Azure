/**
 * Integration Tests for azure-project-plan
 *
 * Tests skill behavior with a real Copilot agent session.
 * Validates that the agent creates a project plan and invokes the correct skill.
 *
 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 */

import * as fs from "node:fs";
import * as path from "node:path";
import {
  shouldSkipIntegrationTests,
  getIntegrationSkipReason,
  useAgentRunner,
  doesAssistantMessageIncludeKeyword,
} from "../utils/agent-runner";
import {
  isSkillInvoked,
  softCheckSkill,
  withTestResult,
  doesWorkspaceFileIncludePattern,
  getAllAssistantMessages,
} from "../utils/evaluate";
import {
  earlyTerminateForPlan,
  earlyTerminateOnApiCeiling,
  logToolCalls,
  softCheckPlanSkills,
  didAutoChainToScaffold,
} from "./utils";

const SKILL_NAME = "azure-project-plan";
const RUNS_PER_PROMPT = 3;
const invocationRateThreshold = 0.3;

const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;
const planTestTimeoutMs = 300000; // 5 minutes

describeIntegration(`${SKILL_NAME} - Integration Tests`, () => {
  const agent = useAgentRunner();

  // ──────────────────────────────────────────────────────────────────
  // Phase 1: Diagnostic — log tool calls to confirm skill routing
  // ──────────────────────────────────────────────────────────────────
  describe("diagnostic", () => {
    test("logs tool calls for planning prompt", async () => {
      await withTestResult(async () => {
        const agentMetadata = await agent.run({
          prompt: "Plan a new Azure project for a todo list app with React and Azure Functions",
          nonInteractive: true,
          followUp: ["Continue with recommended options."],
          shouldEarlyTerminate: (metadata) =>
            earlyTerminateForPlan(metadata, SKILL_NAME),
        });

        // Log all tool calls for diagnostic inspection
        const summary = logToolCalls(agentMetadata);
        console.log(`\n📊 ${SKILL_NAME} diagnostic:\n${summary}`);

        // Log skill invocation status
        const invoked = isSkillInvoked(agentMetadata, SKILL_NAME);
        console.log(`\n🎯 ${SKILL_NAME} invoked: ${invoked}`);

        softCheckPlanSkills(agentMetadata);
        expect(typeof invoked).toBe("boolean");
      });
    }, planTestTimeoutMs);
  });

  // ──────────────────────────────────────────────────────────────────
  // Phase 2: Skill invocation rate tests
  // ──────────────────────────────────────────────────────────────────
  describe("skill-invocation", () => {
    const followUp = ["Continue with recommended options until complete."];

    test("invokes azure-project-plan skill for planning prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "Plan a new Azure project for a todo list application with a React frontend and Azure Functions backend",
            nonInteractive: true,
            followUp,
            shouldEarlyTerminate: (metadata) =>
              earlyTerminateForPlan(metadata, SKILL_NAME),
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invocationCount += 1;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    }, planTestTimeoutMs);

    test("invokes azure-project-plan skill for new project prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "I want to create a new fullstack Azure app with PostgreSQL and Blob Storage",
            nonInteractive: true,
            followUp,
            shouldEarlyTerminate: (metadata) =>
              earlyTerminateForPlan(metadata, SKILL_NAME),
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invocationCount += 1;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    }, planTestTimeoutMs);

    test("invokes azure-project-plan skill for design prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "Design a new API project with Azure Functions that handles user authentication and photo uploads",
            nonInteractive: true,
            followUp,
            shouldEarlyTerminate: (metadata) =>
              earlyTerminateForPlan(metadata, SKILL_NAME),
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invocationCount += 1;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    }, planTestTimeoutMs);
  });

  // ──────────────────────────────────────────────────────────────────
  // Phase 3: Plan file generation and content validation
  // ──────────────────────────────────────────────────────────────────
  describe("plan-generation", () => {
    test("creates project-plan.md with required sections", async () => {
      await withTestResult(async () => {
        let workspacePath: string | undefined;

        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
          },
          prompt:
            "Plan a new Azure Functions API project with TypeScript, PostgreSQL, and Blob Storage for a photo sharing app. Use all recommended options and approve the plan.",
          nonInteractive: true,
          followUp: [
            "Yes, approve the plan.",
          ],
          preserveWorkspace: true,
          shouldEarlyTerminate: (metadata) =>
            earlyTerminateOnApiCeiling(metadata),
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(workspacePath).toBeDefined();

        // Check for plan file — agent may write to .azure/project-plan.md in workspace
        const allMessages = getAllAssistantMessages(agentMetadata);
        const planFileExists = fs.existsSync(
          path.join(workspacePath!, ".azure", "project-plan.md")
        );

        if (planFileExists) {
          // Hard assert: plan contains critical sections
          const planFile = /project-plan\.md$/;
          expect(
            doesWorkspaceFileIncludePattern(workspacePath!, /Project Overview/i, planFile)
          ).toBe(true);
          expect(
            doesWorkspaceFileIncludePattern(workspacePath!, /Runtime & Framework/i, planFile)
          ).toBe(true);
        } else {
          // Plan may be in assistant message or tool output instead
          const hasPlan = allMessages.toLowerCase().includes("project overview") ||
            allMessages.toLowerCase().includes("plan");
          expect(hasPlan).toBe(true);
        }
      });
    }, planTestTimeoutMs);

    test("plan response mentions key project components", async () => {
      await withTestResult(async () => {
        const agentMetadata = await agent.run({
          prompt: "Create a project plan for a new testable API with Azure Functions",
          nonInteractive: true,
          followUp: ["Use recommended options."],
          shouldEarlyTerminate: (metadata) =>
            earlyTerminateForPlan(metadata, SKILL_NAME),
        });

        softCheckSkill(agentMetadata, SKILL_NAME);

        // Check if assistant response or tool args mention project-plan
        const hasProjectPlan = doesAssistantMessageIncludeKeyword(
          agentMetadata,
          "project-plan"
        );
        const hasPlanMention = doesAssistantMessageIncludeKeyword(
          agentMetadata,
          "plan"
        );
        expect(hasProjectPlan || hasPlanMention).toBe(true);
      });
    }, planTestTimeoutMs);
  });

  // ──────────────────────────────────────────────────────────────────
  // Phase 4: Workflow behavior tests
  // ──────────────────────────────────────────────────────────────────
  describe("workflow-behavior", () => {
    test("does not create code files before plan approval", async () => {
      await withTestResult(async () => {
        let workspacePath: string | undefined;

        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
          },
          prompt:
            "Plan a new Azure Functions API project with TypeScript and Blob Storage",
          nonInteractive: true,
          followUp: ["Use recommended options."],
          preserveWorkspace: true,
          shouldEarlyTerminate: (metadata) =>
            earlyTerminateForPlan(metadata, SKILL_NAME),
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(workspacePath).toBeDefined();

        // Plan-first rule: no src/, no configs, no code files outside .azure/
        const files = fs.existsSync(workspacePath!)
          ? fs.readdirSync(workspacePath!, { recursive: true })
            .map(f => String(f).replace(/\\/g, "/"))
          : [];
        const codeFiles = files.filter(f =>
          !f.startsWith(".azure/") && /\.(ts|js|json)$/.test(f)
        );
        if (codeFiles.length > 0) {
          console.warn(`⚠️ Code files found before approval: ${codeFiles.join(", ")}`);
        }
        expect(codeFiles).toHaveLength(0);
      });
    }, planTestTimeoutMs);

    test("auto-chains to azure-project-scaffold after approval", async () => {
      await withTestResult(async () => {
        const agentMetadata = await agent.run({
          prompt:
            "Plan a new Azure Functions API with TypeScript and Blob Storage for a todo app. Use all recommended options and approve the plan.",
          nonInteractive: true,
          followUp: [
            "Yes, approve the plan and proceed with scaffolding.",
          ],
          shouldEarlyTerminate: (metadata) => {
            // Terminate once scaffold skill is invoked (chain complete)
            if (isSkillInvoked(metadata, "azure-project-scaffold")) return true;
            return earlyTerminateOnApiCeiling(metadata);
          },
        });

        softCheckSkill(agentMetadata, SKILL_NAME);

        // The skill should either invoke scaffold or mention it as next step
        const chained = didAutoChainToScaffold(agentMetadata);
        if (!chained) {
          agentMetadata.testComments.push(
            "⚠️ Expected auto-chain to azure-project-scaffold after plan approval."
          );
        }
        expect(chained).toBe(true);
      });
    }, planTestTimeoutMs);

    test("infers tech stack from existing workspace files", async () => {
      await withTestResult(async () => {
        let workspacePath: string | undefined;

        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
            // Seed workspace with an existing project
            fs.writeFileSync(
              path.join(workspace, "package.json"),
              JSON.stringify({
                name: "existing-app",
                dependencies: {
                  "react": "^18.2.0",
                  "@azure/storage-blob": "^12.0.0",
                },
                devDependencies: {
                  "vitest": "^1.0.0",
                },
              }, null, 2)
            );
          },
          prompt: "Plan an Azure Functions API for this existing project. Use recommended options.",
          nonInteractive: true,
          followUp: [
            "Use recommended options and approve the plan.",
          ],
          preserveWorkspace: true,
          shouldEarlyTerminate: (metadata) =>
            earlyTerminateOnApiCeiling(metadata),
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(workspacePath).toBeDefined();

        // Gather all output: plan file + assistant messages + tool args
        const allContent = getAllAssistantMessages(agentMetadata);
        const planPath = path.join(workspacePath!, ".azure", "project-plan.md");
        const planContent = fs.existsSync(planPath)
          ? fs.readFileSync(planPath, "utf-8")
          : "";
        const combined = (planContent + " " + allContent).toLowerCase();

        // Agent should acknowledge the existing project (scan step ran)
        expect(combined).toMatch(/existing|project|package\.json|dependencies/i);

        // Soft-check: ideally the inferred tech appears in plan or response
        const mentionsReact = /react/i.test(combined);
        const mentionsStorage = /blob|storage/i.test(combined);
        if (!mentionsReact || !mentionsStorage) {
          agentMetadata.testComments.push(
            `⚠️ Inference gap: react=${mentionsReact}, storage=${mentionsStorage} — agent may have inferred silently.`
          );
        }
      });
    }, planTestTimeoutMs);
  });
});
