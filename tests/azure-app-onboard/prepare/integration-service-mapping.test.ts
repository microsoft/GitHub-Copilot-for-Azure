/**
 * Integration Tests — Prepare Catalog (Service Mapping + Migration)
 *
 * Tests prepare-phase behaviors against catalog repos:
 * - aws-bookstore-demo: Full AWS→Azure multi-service migration
 * - wetty: Docker-compose + WebSocket routing
 * - yamtrack-django: Docker-compose + PostgreSQL + Redis PaaS mapping
 * - postgresql-event-sourcing: Kafka → Event Hubs + Gradle/Spring Boot
 *
 * Extracted from integration-catalog-extended.test.ts — these focus on
 * service mapping, cost estimation, and migration planning (prepare domain).
 */

import {
  isSkillInvoked,
  softCheckSkill,
  doesAssistantOrToolsIncludeKeyword,
  withTestResult,
  getAllAssistantMessages,
} from "../../utils/evaluate";
import { cloneRepo } from "../../utils/git-clone";
import {
  describeAppOnboardWithCleanup,
  SKILL_NAME,
  testTimeoutMs,
  shouldEarlyTerminateForPlanPresented,
  shouldEarlyTerminateOnScaffoldOrDeploy,
  assertSessionFileCreated,
  assertDockerfileExplored,
  assertAwsMigrationMapping,
  assertDockerComposeDetected,
  assertAgentScannedWorkspace,
} from "../app-onboard-test-helpers";

describeAppOnboardWithCleanup("Prepare Catalog Tests", (agent) => {
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
          prompt: "We're running this app today. Help me move it to Azure — what services do I need?",
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

        // Must scan workspace (scans_repo grader)
        assertAgentScannedWorkspace(agentMetadata);
      });
    }, testTimeoutMs);

    test("e2e — yamtrack-django (docker-compose + PostgreSQL + Redis PaaS mapping)", async () => {
      await withTestResult(async () => {
        let workspacePath = "";
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
            await cloneRepo({
              repoUrl: "https://github.com/FuzzyGrim/Yamtrack",
              targetDir: workspace,
              branch: "dev", // Yamtrack uses 'dev' as its default branch
              depth: 1,
            });
          },
          prompt: "Can you analyze my app and tell me which Azure service I should use?",
          followUp: [
            "Map each service in my Docker Compose to an Azure equivalent.",
            "What will this cost on Azure?",
            "No, don't deploy. That's all I needed.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateOnScaffoldOrDeploy,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        // Must detect docker-compose
        assertDockerComposeDetected(agentMetadata);

        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

        // Must map PostgreSQL to Azure Database for PostgreSQL
        const mapsPostgres =
          messages.includes("azure database for postgresql") ||
          messages.includes("flexible server") ||
          (messages.includes("postgresql") && messages.includes("azure"));
        if (!mapsPostgres) {
          agentMetadata.testComments.push("❌ DOCKER-COMPOSE PaaS: Did not map PostgreSQL to Azure Database for PostgreSQL");
        }
        expect(mapsPostgres).toBe(true);

        // Must map Redis to Azure Cache for Redis
        const mapsRedis =
          messages.includes("azure cache for redis") ||
          (messages.includes("redis") && messages.includes("azure"));
        if (!mapsRedis) {
          agentMetadata.testComments.push("❌ DOCKER-COMPOSE PaaS: Did not map Redis to Azure Cache for Redis");
        }
        expect(mapsRedis).toBe(true);

        // Must surface scan-discovered facts (surfaces_scan_discovered_facts grader)
        const surfacesDiscoveredFacts =
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "found") ||
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "detected") ||
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "discovered") ||
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "scan");
        if (!surfacesDiscoveredFacts) {
          agentMetadata.testComments.push("❌ DISCOVERY: Did not surface scan-discovered facts (found/detected/discovered)");
        }
        expect(surfacesDiscoveredFacts).toBe(true);

        // Must scan workspace (scans_repo grader)
        assertAgentScannedWorkspace(agentMetadata);

        // Session integrity
        if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);
      });
    }, testTimeoutMs);
  });

  describe("kafka-migration", () => {
    test("e2e — postgresql-event-sourcing (Kafka → Event Hubs + Gradle/Spring Boot)", async () => {
      await withTestResult(async () => {
        let workspacePath = "";
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
            await cloneRepo({
              repoUrl: "https://github.com/eugene-khyst/postgresql-event-sourcing",
              targetDir: workspace,
              branch: "main",
              depth: 1,
            });
          },
          prompt: "I just signed up for Azure. What's the fastest way to bring my app over?",
          followUp: [
            "Map all the middleware and database dependencies to Azure.",
            "What will this cost?",
            "No, don't deploy. That's all I needed.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateForPlanPresented,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

        // Must detect Gradle/Java/Spring Boot build system
        const detectsJavaBuild =
          messages.includes("gradle") || messages.includes("build.gradle") ||
          messages.includes("spring boot") || messages.includes("spring") ||
          messages.includes("java");
        if (!detectsJavaBuild) {
          agentMetadata.testComments.push("❌ KAFKA MIGRATION: Did not detect Gradle/Java/Spring Boot build system");
        }
        expect(detectsJavaBuild).toBe(true);

        // Must map Kafka to Azure Event Hubs
        const mapsKafkaToEventHubs =
          messages.includes("event hubs") || messages.includes("eventhubs") ||
          (messages.includes("kafka") && messages.includes("protocol")) ||
          messages.includes("kafka-compatible");
        if (!mapsKafkaToEventHubs) {
          agentMetadata.testComments.push("❌ KAFKA MIGRATION: Did not map Kafka to Azure Event Hubs");
        }
        expect(mapsKafkaToEventHubs).toBe(true);

        // Must detect PostgreSQL dependency
        const detectsPostgres =
          messages.includes("postgres") || messages.includes("postgresql");
        if (!detectsPostgres) {
          agentMetadata.testComments.push("❌ KAFKA MIGRATION: Did not detect PostgreSQL dependency");
        }
        expect(detectsPostgres).toBe(true);

        // Must detect Docker Compose services
        assertDockerComposeDetected(agentMetadata);

        // Must scan workspace (scans_repo grader)
        assertAgentScannedWorkspace(agentMetadata);

        // Session integrity
        if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);
      });
    }, testTimeoutMs);
  });
});
