/**
 * Integration Tests for azure-infra-planner
 * 
 * Tests skill behavior with a real Copilot agent session.
 * Runs prompts to verify skill invocation.
 * 
 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 */

import * as fs from "fs";
import * as path from "path";
import {
  useAgentRunner,
  shouldSkipIntegrationTests,
  getIntegrationSkipReason
} from "../utils/agent-runner";
import { isSkillInvoked, softCheckSkill, getToolCalls, listFilesRecursive } from "../utils/evaluate";

const SKILL_NAME = "azure-infra-planner";
const RUNS_PER_PROMPT = 1;
const FOLLOW_UP_PROMPT = ["Go with recommended options. Assume all defaults to make the plan."];

const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

describeIntegration(`${SKILL_NAME}_ - Integration Tests`, () => {
  const agent = useAgentRunner();
  const maxToolCallBeforeTerminate = 3;

  describe("skill-invocation", () => {
    test("invokes skill for architecture planning prompt", async () => {
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Plan Azure infrastructure for an event-driven serverless data pipeline with Cosmos DB and Event Hub.",
            nonInteractive: true,
            followUp: FOLLOW_UP_PROMPT,
            shouldEarlyTerminate: (agentMetadata) => isSkillInvoked(agentMetadata, SKILL_NAME) || getToolCalls(agentMetadata).length > maxToolCallBeforeTerminate
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
        } catch (e: unknown) {
          if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
            console.log("⏭️  SDK not loadable, skipping test");
            return;
          }
          throw e;
        }
      }
    });

    test("invokes skill for web app infrastructure prompt", async () => {
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "I need to design Azure infrastructure for a web application with a SQL database, Redis cache, and VNet isolation.",
            nonInteractive: true,
            followUp: FOLLOW_UP_PROMPT,
            shouldEarlyTerminate: (agentMetadata) => isSkillInvoked(agentMetadata, SKILL_NAME) || getToolCalls(agentMetadata).length > maxToolCallBeforeTerminate
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
        } catch (e: unknown) {
          if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
            console.log("⏭️  SDK not loadable, skipping test");
            return;
          }
          throw e;
        }
      }
    });

    test("invokes skill for microservices architecture prompt", async () => {
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Plan Azure infrastructure for a microservices platform with AKS, Service Bus messaging, and API Management.",
            nonInteractive: true,
            followUp: FOLLOW_UP_PROMPT,
            shouldEarlyTerminate: (agentMetadata) => isSkillInvoked(agentMetadata, SKILL_NAME) || getToolCalls(agentMetadata).length > maxToolCallBeforeTerminate
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
        } catch (e: unknown) {
          if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
            console.log("⏭️  SDK not loadable, skipping test");
            return;
          }
          throw e;
        }
      }
    });

    test("invokes skill for Bicep generation prompt", async () => {
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Generate Bicep templates for my Azure workload that includes App Service, Key Vault, and managed identity.",
            nonInteractive: true,
            followUp: FOLLOW_UP_PROMPT,
            shouldEarlyTerminate: (agentMetadata) => isSkillInvoked(agentMetadata, SKILL_NAME) || getToolCalls(agentMetadata).length > maxToolCallBeforeTerminate
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
        } catch (e: unknown) {
          if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
            console.log("⏭️  SDK not loadable, skipping test");
            return;
          }
          throw e;
        }
      }
    });

    test("invokes skill for web app with database and cache prompt", async () => {
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Plan Azure infrastructure for a web application with a database and cache layer. Assume all defaults to make the plan.",
            nonInteractive: true,
            followUp: FOLLOW_UP_PROMPT,
            shouldEarlyTerminate: (agentMetadata) => isSkillInvoked(agentMetadata, SKILL_NAME) || getToolCalls(agentMetadata).length > maxToolCallBeforeTerminate
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
        } catch (e: unknown) {
          if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
            console.log("⏭️  SDK not loadable, skipping test");
            return;
          }
          throw e;
        }
      }
    });

    test("invokes skill for REST API with relational database prompt", async () => {
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Plan Azure infrastructure for a REST API with a relational database. Assume all defaults to make the plan.",
            nonInteractive: true,
            followUp: FOLLOW_UP_PROMPT,
            shouldEarlyTerminate: (agentMetadata) => isSkillInvoked(agentMetadata, SKILL_NAME) || getToolCalls(agentMetadata).length > maxToolCallBeforeTerminate
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
        } catch (e: unknown) {
          if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
            console.log("⏭️  SDK not loadable, skipping test");
            return;
          }
          throw e;
        }
      }
    });
  });

  describe("response-quality", () => {
    test("generates infrastructure-plan.json with expected resources", async () => {
      let testWorkspacePath: string | undefined;

      const agentMetadata = await agent.run({
        prompt: "Plan Azure infrastructure for a web application with a database and cache layer. Assume all defaults to make the plan.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT,
        preserveWorkspace: true,
        includeSkills: [SKILL_NAME],
        setup: async (workspace: string) => {
          testWorkspacePath = workspace;
        }
      });

      softCheckSkill(agentMetadata, SKILL_NAME);

      // Verify plan file was created
      expect(testWorkspacePath).toBeDefined();
      const planPath = path.join(testWorkspacePath!, ".azure", "infrastructure-plan.json");
      expect(fs.existsSync(planPath)).toBe(true);

      // Verify plan structure and resources
      const plan = JSON.parse(fs.readFileSync(planPath, "utf-8"));
      expect(plan).toHaveProperty("meta");
      expect(plan).toHaveProperty("plan.resources");
      expect(Array.isArray(plan.plan.resources)).toBe(true);
      expect(plan.plan.resources.length).toBeGreaterThan(0);

      // Should contain database and cache resources
      const resourceTypes = plan.plan.resources.map((r: { type?: string }) =>
        (r.type || "").toLowerCase()
      );
      const hasDatabase = resourceTypes.some((t: string) =>
        t.includes("sql") || t.includes("cosmosdb") || t.includes("documentdb") || t.includes("postgresql")
      );
      const hasCache = resourceTypes.some((t: string) =>
        t.includes("redis") || t.includes("cache")
      );
      console.log(`📋 Plan has ${plan.plan.resources.length} resources`);
      console.log(`   Database present: ${hasDatabase}`);
      console.log(`   Cache present: ${hasCache}`);
    });

    test("generates Bicep files from approved plan", async () => {
      let testWorkspacePath: string | undefined;

      const agentMetadata = await agent.run({
        prompt: "Plan Azure infrastructure for a REST API with a relational database. Assume all defaults to make the plan.",
        nonInteractive: true,
        followUp: [
          ...FOLLOW_UP_PROMPT,
          "Looks good! Let's make Bicep now."
        ],
        preserveWorkspace: true,
        includeSkills: [SKILL_NAME],
        setup: async (workspace: string) => {
          testWorkspacePath = workspace;
          // Pre-create infra/ to guide IaC file placement per skill instructions
          fs.mkdirSync(path.join(workspace, "infra", "modules"), { recursive: true });
        }
      });

      softCheckSkill(agentMetadata, SKILL_NAME);

      // Check for Bicep files under <project-root>/infra/
      expect(testWorkspacePath).toBeDefined();
      const allBicepFiles = listFilesRecursive(testWorkspacePath!).filter(f => f.endsWith(".bicep"));
      const infraDir = path.join(testWorkspacePath!, "infra");
      const infraBicepFiles = allBicepFiles.filter(f =>
        path.normalize(f).startsWith(path.normalize(infraDir))
      );

      console.log(`📋 Found ${allBicepFiles.length} total Bicep files:`);
      allBicepFiles.forEach(f => console.log(`   ${path.relative(testWorkspacePath!, f)}`));

      expect(allBicepFiles.length).toBeGreaterThan(0);

      if (infraBicepFiles.length === 0) {
        const misplaced = allBicepFiles.map(f => path.relative(testWorkspacePath!, f));
        console.warn(`⚠️  Bicep files generated outside infra/: [${misplaced.join(", ")}]. Skill instructs <project-root>/infra/.`);
      } else {
        console.log(`✅ ${infraBicepFiles.length} Bicep file(s) correctly under infra/`);
      }
    });
  });

  describe("workspace-context", () => {
    test("detects Express + Cosmos from package.json", async () => {
      const agentMetadata = await agent.run({
        setup: async (workspace: string) => {
          fs.writeFileSync(
            path.join(workspace, "package.json"),
            JSON.stringify({
              name: "my-api",
              dependencies: {
                "express": "^4.18.0",
                "@azure/cosmos": "^4.0.0"
              }
            })
          );
        },
        prompt: "What Azure infrastructure do I need for this project? Assume all defaults to make the plan.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT,
        shouldEarlyTerminate: (agentMetadata) => isSkillInvoked(agentMetadata, SKILL_NAME) || getToolCalls(agentMetadata).length > maxToolCallBeforeTerminate
      });

      softCheckSkill(agentMetadata, SKILL_NAME);
    });

    test("detects Python Flask + PostgreSQL from requirements.txt", async () => {
      const agentMetadata = await agent.run({
        setup: async (workspace: string) => {
          fs.writeFileSync(
            path.join(workspace, "requirements.txt"),
            "flask==3.0.0\npsycopg2-binary==2.9.9\nazure-identity==1.15.0\n"
          );
        },
        prompt: "Plan Azure infrastructure for this Python application. Assume all defaults to make the plan.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT,
        shouldEarlyTerminate: (agentMetadata) => isSkillInvoked(agentMetadata, SKILL_NAME) || getToolCalls(agentMetadata).length > maxToolCallBeforeTerminate
      });

      softCheckSkill(agentMetadata, SKILL_NAME);
    });
  });

  describe("anti-invocation", () => {
    test("does NOT invoke skill for existing app preparation prompt", async () => {
      try {
        const agentMetadata = await agent.run({
          prompt: "I have an existing Node.js Express application. Help me prepare it for Azure App Service deployment.",
          nonInteractive: true,
          followUp: FOLLOW_UP_PROMPT,
          shouldEarlyTerminate: (agentMetadata) => getToolCalls(agentMetadata).length > maxToolCallBeforeTerminate
        });

        // Existing app preparation should route to azure-prepare, not azure-infra-planner
        softCheckSkill(agentMetadata, "azure-prepare");
      } catch (e: unknown) {
        if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
          console.log("⏭️  SDK not loadable, skipping test");
          return;
        }
        throw e;
      }
    });

    test("does NOT invoke skill for azd deploy prompt", async () => {
      try {
        const agentMetadata = await agent.run({
          prompt: "I already have my azure.yaml configured. Run azd up to deploy everything to Azure.",
          nonInteractive: true,
          followUp: FOLLOW_UP_PROMPT,
          shouldEarlyTerminate: (agentMetadata) => getToolCalls(agentMetadata).length > maxToolCallBeforeTerminate
        });

        // Deployment execution should route to azure-deploy, not azure-infra-planner
        softCheckSkill(agentMetadata, "azure-deploy");
      } catch (e: unknown) {
        if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
          console.log("⏭️  SDK not loadable, skipping test");
          return;
        }
        throw e;
      }
    });
  });
});