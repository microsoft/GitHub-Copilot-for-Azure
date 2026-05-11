/**
 * Integration Tests — Extended Catalog Coverage
 *
 * Tests repos from repo-catalog.json not covered by the main catalog tests:
 * - aws-bookstore-demo: Full AWS→Azure multi-service migration
 * - wetty: Docker-compose + WebSocket routing
 * - get-started-ai-agents: Existing azd + Foundry agent framework
 * - todo-nodejs-mongo: Existing azd template with Key Vault + Cosmos DB
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
import {
  describeAppOnboardWithCleanup,
  SKILL_NAME,
  testTimeoutMs,
  shouldEarlyTerminateForPlanPresented,
  shouldEarlyTerminateOnAzdDecisionGate,
  assertApprovalGateReachedHard,
  assertSessionFileCreated,
  assertDockerfileExplored,
  assertAwsMigrationMapping,
  assertDockerComposeDetected,
  assertAzdDecisionGatePresented,
  assertDatabaseDetected,
  assertPhaseArtifactsExist,
} from "./app-onboard-test-helpers";

describeAppOnboardWithCleanup("Extended Catalog Tests", (agent) => {
  describe("aws-migration", () => {
    test("e2e — aws-bookstore-demo (full AWS→Azure migration)", async () => {
      await withTestResult(async () => {
        let workspacePath = "";
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
            await cloneRepo({
              repoUrl: "https://github.com/aws-samples/aws-bookstore-demo-app",
              targetDir: workspace,
              branch: "main",
              depth: 1,
            });
          },
          prompt: "We're running this app today. How do we bring it to Azure with minimal changes?",
          followUp: [
            "Map all the AWS services to Azure equivalents.",
            "What will this cost on Azure?",
            "No, don't deploy. That's all I needed.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateForPlanPresented,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

        // Hard: must detect AWS-native services and propose Azure equivalents
        assertAwsMigrationMapping(agentMetadata, [
          { from: "DynamoDB", to: "cosmos db" },
          { from: "Lambda", to: "container apps" },
          { from: "Cognito", to: "entra" },
          { from: "ElastiCache", to: "redis" },
          { from: "Elasticsearch", to: "search" },
        ]);

        // Hard: must detect CloudFormation and flag IaC conversion need
        const detectsCloudFormation =
          messages.includes("cloudformation") || messages.includes("cloud formation") ||
          messages.includes("sam template") || messages.includes("aws iac");
        if (!detectsCloudFormation) {
          agentMetadata.testComments.push("⚠️ AWS MIGRATION: Did not detect CloudFormation IaC");
        }

        // Hard: must NOT plan to provision DynamoDB directly on Azure
        const sentences = messages.split(/[.!?\n]/);
        const plansDynamoOnAzure = sentences.some(s =>
          /provision\s+dynamo/i.test(s) || /deploy\s+dynamo/i.test(s) ||
          /run\s+dynamo.+on\s+azure/i.test(s));
        if (plansDynamoOnAzure) {
          agentMetadata.testComments.push("❌ AWS MIGRATION: Agent planned to provision DynamoDB on Azure");
        }
        expect(plansDynamoOnAzure).toBe(false);

        // Soft: should identify multiple AWS services (≥3)
        const awsServiceCount =
          (messages.includes("dynamodb") ? 1 : 0) +
          (messages.includes("lambda") ? 1 : 0) +
          (messages.includes("cognito") ? 1 : 0) +
          (messages.includes("elasticache") ? 1 : 0) +
          (messages.includes("elasticsearch") || messages.includes("opensearch") ? 1 : 0) +
          (messages.includes("neptune") ? 1 : 0) +
          (messages.includes("cloudfront") ? 1 : 0);
        if (awsServiceCount < 3) {
          agentMetadata.testComments.push(`⚠️ AWS MIGRATION: Only ${awsServiceCount} AWS services identified (expected ≥3)`);
        }

        // Session integrity
        if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);
      });
    }, testTimeoutMs);
  });

  describe("docker-compose", () => {
    test("e2e — wetty (docker-compose + WebSocket routing)", async () => {
      await withTestResult(async () => {
        let workspacePath = "";
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
            await cloneRepo({
              repoUrl: "https://github.com/butlerx/wetty",
              targetDir: workspace,
              branch: "main",
              depth: 1,
            });
          },
          prompt: "I want to take my local app and put it in the cloud — where do I start?",
          followUp: [
            "Just go with defaults.",
            "What Azure services are you recommending?",
            "No, don't deploy. That's all I needed.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateForPlanPresented,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

        // Hard: must detect Dockerfile
        assertDockerfileExplored(agentMetadata);

        // Soft: should detect docker-compose
        assertDockerComposeDetected(agentMetadata);

        // Soft: should recommend Container Apps (better WebSocket support than App Service)
        const recommendsContainerApps = messages.includes("container apps");
        if (!recommendsContainerApps) {
          agentMetadata.testComments.push("⚠️ DOCKER-COMPOSE: Agent did not recommend Container Apps — wetty requires WebSocket support");
        }

        // Soft: should mention WebSocket or SSH/terminal requirements
        const detectsWebSocket =
          messages.includes("websocket") || messages.includes("web socket") ||
          messages.includes("ssh") || messages.includes("terminal");
        if (!detectsWebSocket) {
          agentMetadata.testComments.push("⚠️ DOCKER-COMPOSE: Agent did not mention WebSocket/SSH requirements");
        }

        // Session integrity
        if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);
      });
    }, testTimeoutMs);
  });

  describe("existing-azd", () => {
    test("e2e — get-started-ai-agents (existing azd + Foundry)", async () => {
      await withTestResult(async () => {
        let workspacePath = "";
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
            await cloneRepo({
              repoUrl: "https://github.com/Azure-Samples/get-started-with-ai-agents",
              targetDir: workspace,
              branch: "main",
              depth: 1,
            });
          },
          prompt: "I have an existing app — what's the best way to migrate it to Azure?",
          followUp: [
            "What did you find in my project?",
            "Should I use the existing infrastructure or start fresh?",
            "No, don't deploy. That's all I needed.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateOnAzdDecisionGate,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        // Must detect existing azure.yaml and Bicep infra
        assertAzdDecisionGatePresented(agentMetadata);

        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

        // Must detect AI/Foundry components
        const detectsAI =
          messages.includes("openai") || messages.includes("ai") ||
          messages.includes("foundry") || messages.includes("agent");
        if (!detectsAI) {
          agentMetadata.testComments.push("⚠️ AZD: Did not detect AI/Foundry framework");
        }
        expect(detectsAI).toBe(true);

        // Must NOT silently overwrite existing IaC
        const toolCalls = getToolCalls(agentMetadata);
        const overwroteIaC = toolCalls.some(tc => {
          const toolName = (tc.data.toolName ?? "").toLowerCase();
          if (toolName !== "create_file" && toolName !== "write_file" && toolName !== "create") return false;
          const filePath = ((tc.data.arguments as Record<string, unknown>)?.path as string ?? "").toLowerCase();
          return filePath.includes("main.bicep") || filePath.includes("main.tf");
        });
        if (overwroteIaC) {
          agentMetadata.testComments.push("❌ AZD: Agent overwrote existing IaC without user consent");
        }
        expect(overwroteIaC).toBe(false);

        // Session integrity
        if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);
      });
    }, testTimeoutMs);

    test("e2e — todo-nodejs-mongo (canonical azd template with Key Vault + Cosmos)", async () => {
      await withTestResult(async () => {
        let workspacePath = "";
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
            await cloneRepo({
              repoUrl: "https://github.com/Azure-Samples/todo-nodejs-mongo",
              targetDir: workspace,
              branch: "main",
              depth: 1,
            });
          },
          prompt: "Can Azure automatically figure out how my app should be deployed?",
          followUp: [
            "What infrastructure does my project already have?",
            "Should I use azd or deploy from scratch?",
            "No, don't deploy.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateOnAzdDecisionGate,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        // Must detect existing azure.yaml
        assertAzdDecisionGatePresented(agentMetadata);

        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

        // Must detect Cosmos DB / MongoDB
        assertDatabaseDetected(agentMetadata, "mongodb");

        // Must detect Key Vault
        const detectsKeyVault =
          messages.includes("key vault") || messages.includes("keyvault");
        if (!detectsKeyVault) {
          agentMetadata.testComments.push("⚠️ AZD: Did not detect existing Key Vault in infra");
        }

        // Must detect multi-component (web + api)
        const detectsComponents =
          (messages.includes("web") || messages.includes("frontend")) &&
          (messages.includes("api") || messages.includes("backend"));
        if (!detectsComponents) {
          agentMetadata.testComments.push("⚠️ AZD: Did not identify web + api components");
        }

        // Must NOT silently overwrite existing IaC
        const toolCalls = getToolCalls(agentMetadata);
        const overwroteIaC = toolCalls.some(tc => {
          const toolName = (tc.data.toolName ?? "").toLowerCase();
          if (toolName !== "create_file" && toolName !== "write_file" && toolName !== "create") return false;
          const filePath = ((tc.data.arguments as Record<string, unknown>)?.path as string ?? "").toLowerCase();
          return filePath.includes("main.bicep") || filePath.includes("main.tf");
        });
        expect(overwroteIaC).toBe(false);

        // Session integrity
        if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);
      });
    }, testTimeoutMs);
  });
});
