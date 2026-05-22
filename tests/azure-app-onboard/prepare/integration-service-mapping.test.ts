/**
 * Integration Tests — Prepare Catalog (Service Mapping)
 *
 * Tests prepare-phase behaviors against catalog repos:
 * - golang-clean-web-api: Go/Gin + PostgreSQL + Redis + Elasticsearch, Docker Compose
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
  getToolCalls,
} from "../../utils/evaluate";
import { cloneRepo } from "../../utils/git-clone";
import {
  describeAppOnboardWithCleanup,
  SKILL_NAME,
  prepareTestTimeoutMs,
  shouldEarlyTerminateForPlanPresented,
  shouldEarlyTerminateOnScaffoldOrDeploy,
  assertSessionFileCreated,
  assertDockerfileExplored,
  assertDockerComposeDetected,
  assertAgentScannedWorkspace,
  SUBSCRIPTION_PRIMER,
} from "../app-onboard-test-helpers";

describeAppOnboardWithCleanup("Prepare Catalog Tests", (agent) => {
  describe("go-api", () => {
    test("e2e — golang-clean-web-api (Go/Gin + PostgreSQL + Redis + Elasticsearch)", async () => {
      await withTestResult(async () => {
        let workspacePath = "";
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
            await cloneRepo({
              repoUrl: "https://github.com/naeemaei/golang-clean-web-api",
              targetDir: workspace,
              branch: "master",
              depth: 1,
            });
          },
          prompt: "I built a side project and want to get it live on Azure",
          followUp: [
            SUBSCRIPTION_PRIMER,
            "Yes.",
            "Yes.",
            "Yes.",
            "Yes.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateForPlanPresented,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        // Hard: must detect Docker Compose
        assertDockerComposeDetected(agentMetadata);

        // Hard: must detect Go/Gin stack
        const detectsGo =
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "go") ||
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "gin") ||
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "golang");
        if (!detectsGo) {
          agentMetadata.testComments.push("❌ STACK: Did not detect Go/Gin framework");
        }
        expect(detectsGo).toBe(true);

        // Soft: PostgreSQL mapping — early termination can fire before the agent
        // verbalizes all services. yamtrack-django test covers PostgreSQL with a hard assertion.
        const detectsPostgres =
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "postgresql") ||
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "postgres") ||
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "flexible server");
        if (!detectsPostgres) {
          agentMetadata.testComments.push("⚠️ SERVICE MAPPING: PostgreSQL → Azure Database for PostgreSQL not mentioned (flaky — early termination may fire before full plan)");
        }

        // Soft: Redis mapping — manual runs confirm detection but early termination
        // can fire before the agent verbalizes all services. yamtrack-django test
        // also covers Redis mapping with a hard assertion.
        const detectsRedis =
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "redis");
        if (!detectsRedis) {
          agentMetadata.testComments.push("⚠️ SERVICE MAPPING: Redis → Azure Cache for Redis not mentioned (flaky — early termination may fire before full plan)");
        }

        // Soft: should map Elasticsearch to Azure Cognitive Search or Azure Monitor
        const detectsSearch =
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "cognitive search") ||
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "search") ||
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "elasticsearch") ||
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "monitor") ||
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "log analytics");
        if (!detectsSearch) {
          agentMetadata.testComments.push("⚠️ SERVICE MAPPING: Elasticsearch → Azure Cognitive Search/Monitor not mentioned");
        }

        // Must scan workspace
        assertAgentScannedWorkspace(agentMetadata);

        // Session integrity
        if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);
      });
    }, prepareTestTimeoutMs);
  });

  describe("aws-to-cloud-migrate", () => {
    test("e2e — aws-bookstore-demo routes to azure-cloud-migrate after prereq", async () => {
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
            SUBSCRIPTION_PRIMER,
            "Yes.",
            "Yes.",
            "Yes.",
            "Yes.",
            "Yes.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          shouldEarlyTerminate: (meta) => {
            // Stop once azure-cloud-migrate is invoked
            if (isSkillInvoked(meta, "azure-cloud-migrate")) {
              meta.testComments.push("✅ Routed to azure-cloud-migrate via skill invocation");
              return true;
            }
            // Also accept: routeToSkill written to context.json (agent correctly
            // identified migration need but was terminated before skill load)
            const hasRouteToSkill = getToolCalls(meta).some(tc => {
              const toolName = (tc.data.toolName ?? "").toLowerCase();
              if (toolName !== "edit" && toolName !== "create" && toolName !== "create_file" && toolName !== "write_file") return false;
              const args = JSON.stringify(tc.data.arguments ?? "").toLowerCase();
              return args.includes("routetoskill") && args.includes("azure-cloud-migrate");
            });
            if (hasRouteToSkill) {
              meta.testComments.push("✅ Routed to azure-cloud-migrate via routeToSkill in context.json");
              return true;
            }
            // Bail if too many tool calls without routing evidence
            if (isSkillInvoked(meta, SKILL_NAME) && getToolCalls(meta).length > 60) {
              meta.testComments.push("⚠️ Agent stayed in app-onboard after 60+ tool calls — no migration routing evidence");
              return true;
            }
            return false;
          },
        });

        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

        // Soft: agent should detect AWS services (Lambda, DynamoDB) in its analysis
        const detectsAwsServices =
          messages.includes("lambda") || messages.includes("dynamodb") ||
          messages.includes("aws") || messages.includes("cloudformation");
        if (!detectsAwsServices) {
          agentMetadata.testComments.push("⚠️ Did not mention AWS services in analysis");
        }

        // Hard: should route to azure-cloud-migrate — either via skill invocation
        // or by writing routeToSkill to context.json (prereq completed correctly)
        const routedViaSkilInvocation = isSkillInvoked(agentMetadata, "azure-cloud-migrate");
        const routedViaContextJson = getToolCalls(agentMetadata).some(tc => {
          const toolName = (tc.data.toolName ?? "").toLowerCase();
          if (toolName !== "edit" && toolName !== "create" && toolName !== "create_file" && toolName !== "write_file") return false;
          const args = JSON.stringify(tc.data.arguments ?? "").toLowerCase();
          return args.includes("routetoskill") && args.includes("azure-cloud-migrate");
        });
        if (!routedViaSkilInvocation && !routedViaContextJson) {
          softCheckSkill(agentMetadata, "azure-cloud-migrate");
          agentMetadata.testComments.push("❌ No migration routing evidence: neither skill invocation nor routeToSkill in context.json");
        }
        expect(routedViaSkilInvocation || routedViaContextJson).toBe(true);
      });
    }, prepareTestTimeoutMs);
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
            SUBSCRIPTION_PRIMER,
            "Yes.",
            "Yes.",
            "Yes.",
            "Yes.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateForPlanPresented,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        // Hard: must detect Dockerfile
        assertDockerfileExplored(agentMetadata);

        // Soft: should detect docker-compose
        assertDockerComposeDetected(agentMetadata);

        // Session integrity
        if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);

        // Must scan workspace (scans_repo grader)
        assertAgentScannedWorkspace(agentMetadata);
      });
    }, prepareTestTimeoutMs);

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
            SUBSCRIPTION_PRIMER,
            "Yes.",
            "Yes.",
            "Yes.",
            "Yes.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateForPlanPresented,
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

        // Must surface scan-discovered facts
        const surfacesDiscoveredFacts =
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "found") ||
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "detected") ||
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "discovered") ||
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "scan");
        if (!surfacesDiscoveredFacts) {
          agentMetadata.testComments.push("❌ DISCOVERY: Did not surface scan-discovered facts (found/detected/discovered)");
        }
        expect(surfacesDiscoveredFacts).toBe(true);

        // Must scan workspace
        assertAgentScannedWorkspace(agentMetadata);

        // Session integrity
        if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);
      });
    }, prepareTestTimeoutMs);
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
            SUBSCRIPTION_PRIMER,
            "Yes.",
            "Yes.",
            "Yes.",
            "Yes.",
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

        // Must scan workspace
        assertAgentScannedWorkspace(agentMetadata);

        // Session integrity
        if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);
      });
    }, prepareTestTimeoutMs);
  });
});
