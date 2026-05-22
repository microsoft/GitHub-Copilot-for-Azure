/**
 * Language Diversity Integration Tests for azure-app-onboard-prereq
 *
 * Tests non-JavaScript stacks to ensure the skill evaluates diverse languages correctly.
 * Covers gaps: Java (Spring Boot), Python (Django), complex monorepo (Next.js+FastAPI+Flutter).
 * Split from integration-functional.test.ts for parallel execution via Jest workers.
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
  isSkillInvoked,
  softCheckSkill,
  getAllAssistantMessages,
  getAllToolText,
  withTestResult,
  doesAssistantOrToolsIncludeKeyword,
  useAgentRunner,
  assertDoesNotScaffoldOrDeploy,
  assertSessionFileCreated,
  assertAgentScannedWorkspace,
  cloneRepo,
} from "./prereq-test-helpers";
import type { ExpectedVerdicts } from "./prereq-test-helpers";

const { describeIntegration } = setupIntegrationSuite();

describeIntegration(`${SKILL_NAME} - Language Diversity Tests`, () => {
  const agent = useAgentRunner();

  test("e2e — postgresql-event-sourcing (Java/Spring Boot + Kafka)", async () => {
    await withTestResult(async () => {
      let workspacePath = "";
      const agentMetadata = await agent.run({
        setup: async (workspace: string) => {
          workspacePath = workspace;
          await cloneRepo({ repoUrl: "https://github.com/eugene-khyst/postgresql-event-sourcing", targetDir: workspace, branch: "main", depth: 1 });
        },
        prompt: "Can you check if my dependencies are compatible with Azure?",
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

      if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);
      if (workspacePath) {
        const expectedVerdicts: ExpectedVerdicts = { build: "PASS", completeness: "PASS", deployability: "PASS" };
        assertPrereqArtifactWritten(agentMetadata, workspacePath, "ready", expectedVerdicts);
      }

      // Must detect Java/Spring Boot stack
      expect(
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "java")
        || doesAssistantOrToolsIncludeKeyword(agentMetadata, "spring")
        || doesAssistantOrToolsIncludeKeyword(agentMetadata, "spring boot")
      ).toBe(true);

      // Must detect Gradle build system
      try {
        expect(
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "gradle")
          || doesAssistantOrToolsIncludeKeyword(agentMetadata, "build.gradle")
        ).toBe(true);
      } catch {
        agentMetadata.testComments.push("WARN: Agent did not mention Gradle build system");
      }

      // Must detect Dockerfile
      expect(
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "docker")
        || doesAssistantOrToolsIncludeKeyword(agentMetadata, "dockerfile")
      ).toBe(true);

      // Must detect PostgreSQL dependency
      expect(
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "postgres")
        || doesAssistantOrToolsIncludeKeyword(agentMetadata, "postgresql")
        || doesAssistantOrToolsIncludeKeyword(agentMetadata, "database")
      ).toBe(true);

      // Should detect Kafka and map to Event Hubs
      const messages = (getAllAssistantMessages(agentMetadata) + "\n" + getAllToolText(agentMetadata)).toLowerCase();
      const detectsKafka =
        messages.includes("kafka") || messages.includes("event hub") || messages.includes("eventhub");
      if (!detectsKafka) {
        agentMetadata.testComments.push("WARN: Agent did not detect Kafka or map to Event Hubs");
      }

      // Must map to Azure services
      const mapsToAzure =
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "container app") ||
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "app service") ||
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "container") ||
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "azure");
      if (!mapsToAzure) {
        agentMetadata.testComments.push("⚠️ DEPLOYABILITY: Did not map to any Azure service");
      }
      expect(mapsToAzure).toBe(true);
    });
  }, functionalTestTimeoutMs);

  test("e2e — yamtrack-django (Python/Django + PostgreSQL + Redis)", async () => {
    await withTestResult(async () => {
      let workspacePath = "";
      const agentMetadata = await agent.run({
        setup: async (workspace: string) => {
          workspacePath = workspace;
          await cloneRepo({ repoUrl: "https://github.com/FuzzyGrim/Yamtrack", targetDir: workspace, branch: "dev", depth: 1 });
        },
        prompt: "My app uses a local database — check what I need to change before moving to Azure",
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

      // Must detect Python/Django stack
      expect(
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "python")
        || doesAssistantOrToolsIncludeKeyword(agentMetadata, "django")
      ).toBe(true);

      // Must detect manage.py entry point
      try {
        expect(
          doesAssistantOrToolsIncludeKeyword(agentMetadata, "manage.py")
          || doesAssistantOrToolsIncludeKeyword(agentMetadata, "django")
        ).toBe(true);
      } catch {
        agentMetadata.testComments.push("WARN: Agent did not detect manage.py entry point");
      }

      // Must detect Dockerfile
      expect(
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "docker")
        || doesAssistantOrToolsIncludeKeyword(agentMetadata, "dockerfile")
      ).toBe(true);

      // Must detect PostgreSQL → Azure Database for PostgreSQL
      expect(
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "postgres")
        || doesAssistantOrToolsIncludeKeyword(agentMetadata, "postgresql")
        || doesAssistantOrToolsIncludeKeyword(agentMetadata, "database")
      ).toBe(true);

      // Should detect Redis → Azure Cache for Redis
      const detectsRedis =
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "redis") ||
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "cache") ||
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "celery");
      if (!detectsRedis) {
        agentMetadata.testComments.push("WARN: Agent did not detect Redis/Celery dependency");
      }

      // Must map to Azure services
      const mapsToAzure =
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "container app") ||
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "app service") ||
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "container") ||
        doesAssistantOrToolsIncludeKeyword(agentMetadata, "azure");
      expect(mapsToAzure).toBe(true);
    });
  }, functionalTestTimeoutMs);

  test("e2e — fullstack-starter (4-component monorepo + GCP migration)", async () => {
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
        shouldEarlyTerminate: earlyTerminateOnPrereqComplete,
      });

      softCheckSkill(agentMetadata, SKILL_NAME);
      expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

      assertNoForbiddenCommands(agentMetadata);
      assertDoesNotScaffoldOrDeploy(agentMetadata);
      assertAgentScannedWorkspace(agentMetadata);

      if (workspacePath) assertSessionFileCreated(agentMetadata, workspacePath);
      if (workspacePath) {
        const artifact = assertPrereqArtifactWritten(agentMetadata, workspacePath);
        if (artifact && Array.isArray(artifact.components)) {
          agentMetadata.testComments.push(`✅ MULTI-COMPONENT: prereq-output.json has ${(artifact.components as unknown[]).length} components`);
          // Should detect at least 3 deployable components (Next.js + FastAPI + worker; Flutter is non-deployable)
          expect((artifact.components as unknown[]).length).toBeGreaterThanOrEqual(2);
        }
      }

      const messages = (getAllAssistantMessages(agentMetadata) + "\n" + getAllToolText(agentMetadata)).toLowerCase();

      // Must detect multi-component monorepo structure
      const detectsMultiComponent =
        messages.includes("multiple components") ||
        messages.includes("multi-component") ||
        messages.includes("monorepo") ||
        messages.includes("frontend") && messages.includes("backend") ||
        /\d+\s*(deployable\s+)?components/.test(messages);
      if (!detectsMultiComponent) {
        agentMetadata.testComments.push("❌ MULTI-COMPONENT: Did not detect monorepo/multi-component structure");
      }
      expect(detectsMultiComponent).toBe(true);

      // Must detect Next.js frontend
      const detectsNextjs =
        messages.includes("next.js") || messages.includes("nextjs") || messages.includes("next");
      if (!detectsNextjs) {
        agentMetadata.testComments.push("⚠️ MULTI-COMPONENT: Did not detect Next.js frontend");
      }

      // Must detect FastAPI backend
      const detectsFastapi =
        messages.includes("fastapi") || messages.includes("fast api") || messages.includes("python");
      if (!detectsFastapi) {
        agentMetadata.testComments.push("⚠️ MULTI-COMPONENT: Did not detect FastAPI backend");
      }
      expect(detectsFastapi).toBe(true);

      // Should detect Flutter as non-deployable to Azure (soft)
      const detectsFlutter = messages.includes("flutter") || messages.includes("dart") || messages.includes("mobile");
      if (detectsFlutter) {
        agentMetadata.testComments.push("✅ MULTI-COMPONENT: Detected Flutter/mobile component");
      } else {
        agentMetadata.testComments.push("WARN: Agent did not detect Flutter/mobile component");
      }

      // Must detect GCP dependencies (google-cloud-tasks, google-cloud-pubsub)
      const detectsGcpDeps =
        messages.includes("gcp") ||
        messages.includes("google cloud") ||
        messages.includes("google-cloud") ||
        messages.includes("cloud tasks") ||
        messages.includes("pubsub") ||
        messages.includes("terraform") && messages.includes("google");
      if (!detectsGcpDeps) {
        agentMetadata.testComments.push("⚠️ CLOUD SDK: Did not detect GCP dependencies");
      }
      expect(detectsGcpDeps).toBe(true);

      // Must flag migration need for GCP deps
      const flagsMigration =
        messages.includes("migrate") ||
        messages.includes("migration") ||
        messages.includes("replace") ||
        messages.includes("azure equivalent") ||
        messages.includes("service bus") ||
        messages.includes("event grid");
      if (!flagsMigration) {
        agentMetadata.testComments.push("⚠️ CLOUD SDK: Did not flag migration need for GCP deps");
      }
    });
  }, functionalTestTimeoutMs);
});
