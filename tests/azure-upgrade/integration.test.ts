/**
 * Integration Tests for azure-upgrade
 *
 * Tests skill invocation with migration-related prompts.
 * 
 * NOTE: End-to-end migration test is NOT included due to test environment limitations.
 * 
 * The azure-upgrade skill's core command requires an existing source Consumption function app:
 *   az functionapp flex-migration start \
 *     --source-name <SOURCE_APP_NAME> \
 *     --source-resource-group <SOURCE_RESOURCE_GROUP> \
 *     --name <NEW_APP_NAME> \
 *     --resource-group <RESOURCE_GROUP>
 * 
 * Challenge: Creating a valid Consumption function app in test environments is blocked by:
 * - Azure Policy requirements (no shared key access on storage accounts)
 * - Complex identity-based storage configuration (RBAC, managed identity setup)
 * - Deployment failures when using standard `az functionapp create` commands

 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 */

import * as fs from "fs";
import * as path from "path";

import {
  shouldSkipIntegrationTests,
  getIntegrationSkipReason,
  useAgentRunner,
} from "../utils/agent-runner";
import {
  isSkillInvoked,
  shouldEarlyTerminateForSkillInvocation,
  softCheckSkill,
  withTestResult,
} from "../utils/evaluate";

const SKILL_NAME = "azure-upgrade";

// Java SDK migration is a real, multi-phase workflow (precheck → plan →
// execute → summarize) that may run for several minutes. Use the same
// generous timeout as other migration integration tests.
const javaMigrationTimeoutMs = 2700000;
const FOLLOW_UP_PROMPT = ["Continue with recommended options until complete."];

// Check if integration tests should be skipped at module level
const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

// Log skip reason if skipping
if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

describeIntegration(`${SKILL_NAME}_ - Integration Tests`, () => {
  const agent = useAgentRunner();

  describe("skill-invocation", () => {
    test("invokes azure-upgrade skill for Functions Consumption to Flex migration prompt", () => withTestResult(async () => {
      const agentMetadata = await agent.run({
        prompt: "Migrate my Azure Functions app from Consumption to Flex Consumption plan",
        nonInteractive: true,
        followUp: ["Continue with recommended options until complete."],
        shouldEarlyTerminate: (agentMetadata) => shouldEarlyTerminateForSkillInvocation(agentMetadata, SKILL_NAME)
      });

      softCheckSkill(agentMetadata, SKILL_NAME);
      expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
    }));

    test("invokes azure-upgrade skill for upgrading Functions plan prompt", () => withTestResult(async () => {
      const agentMetadata = await agent.run({
        prompt: "Upgrade my Azure Functions hosting plan to Flex Consumption",
        nonInteractive: true,
        followUp: ["Continue with recommended options until complete."],
        shouldEarlyTerminate: (agentMetadata) => shouldEarlyTerminateForSkillInvocation(agentMetadata, SKILL_NAME)
      });

      softCheckSkill(agentMetadata, SKILL_NAME);
      expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
    }));

    test("invokes azure-upgrade skill for legacy Azure Java SDK migration prompt (Flow B)", () => withTestResult(async () => {
      const agentMetadata = await agent.run({
        prompt: "Migrate my Java project from legacy Azure SDK (com.microsoft.azure) to modern Azure SDK (com.azure)",
        nonInteractive: true,
        followUp: ["Continue with recommended options until complete."],
        shouldEarlyTerminate: (agentMetadata) => shouldEarlyTerminateForSkillInvocation(agentMetadata, SKILL_NAME)
      });

      softCheckSkill(agentMetadata, SKILL_NAME);
      expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
    }));

    test("invokes azure-upgrade skill for upgrading legacy Azure Java libraries prompt (Flow B)", () => withTestResult(async () => {
      const agentMetadata = await agent.run({
        prompt: "Upgrade legacy Azure SDKs for Java to the latest modern Azure SDK packages",
        nonInteractive: true,
        followUp: ["Continue with recommended options until complete."],
        shouldEarlyTerminate: (agentMetadata) => shouldEarlyTerminateForSkillInvocation(agentMetadata, SKILL_NAME)
      });

      softCheckSkill(agentMetadata, SKILL_NAME);
      expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
    }));
  });

  describe("java-sdk-migration-e2e", () => {
    // Strip XML comments so that TODO/migration notes referencing the legacy
    // group ID don't cause false positives.
    const stripXmlComments = (src: string): string =>
      src.replace(/<!--[\s\S]*?(?:-->|$)/g, "");

    // Strip Java line and block comments so behavioral-change notes that
    // mention legacy identifiers (e.g. AZURE_AUTH_LOCATION,
    // InMemoryCheckpointManager) inside TODOs are allowed.
    const stripJavaComments = (src: string): string =>
      src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/[^\n]*/g, "");

    const collectJavaFiles = (dir: string): string[] => {
      const out: string[] = [];
      const walk = (d: string): void => {
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
          const full = path.join(d, entry.name);
          if (entry.isDirectory()) {
            if (entry.name === "target" || entry.name === ".git") continue;
            walk(full);
          } else if (entry.isFile() && entry.name.endsWith(".java")) {
            out.push(full);
          }
        }
      };
      walk(dir);
      return out;
    };

    const readPomNoComments = (workspace: string): string => {
      const pomPath = path.join(workspace, "pom.xml");
      expect(fs.existsSync(pomPath)).toBe(true);
      return stripXmlComments(fs.readFileSync(pomPath, "utf8"));
    };

    const runJavaMigration = async (fixtureDir: string): Promise<{
      agentMetadata: Awaited<ReturnType<typeof agent.run>>;
      workspacePath: string;
    }> => {
      let workspacePath: string | undefined;
      const agentMetadata = await agent.run({
        setup: async (workspace: string) => {
          workspacePath = workspace;
          fs.cpSync(
            `./azure-upgrade/resources/${fixtureDir}/`,
            workspace,
            { recursive: true }
          );
        },
        prompt: "Migrate my Java project from legacy Azure SDK to modern Azure SDK",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT,
        followUpTimeout: javaMigrationTimeoutMs,
        preserveWorkspace: true,
      });

      softCheckSkill(agentMetadata, SKILL_NAME);
      expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
      expect(workspacePath).toBeDefined();

      return { agentMetadata, workspacePath: workspacePath as string };
    };

    test("migrates legacy file-based Azure auth (client init) to DefaultAzureCredential", async () => {
      await withTestResult(async () => {
        const { workspacePath } = await runJavaMigration("java-legacy-sdk-client-init");

        const pomNoComments = readPomNoComments(workspacePath);

        // 1. No remaining legacy com.microsoft.azure dependencies.
        expect(pomNoComments).not.toMatch(/<groupId>\s*com\.microsoft\.azure\s*<\/groupId>/);

        // 2. azure-sdk-bom is present in dependencyManagement.
        expect(pomNoComments).toMatch(/<artifactId>\s*azure-sdk-bom\s*<\/artifactId>/);
        expect(pomNoComments).toMatch(/<groupId>\s*com\.azure\s*<\/groupId>/);

        // 3. At least one com.azure.resourcemanager:* dependency replaces the
        //    legacy management SDKs.
        expect(pomNoComments).toMatch(/<groupId>\s*com\.azure\.resourcemanager\s*<\/groupId>/);

        // 4. No migrated Java source still references AZURE_AUTH_LOCATION.
        //    Per com.microsoft.azure.management.md, the file-based
        //    `.authenticate(File)` flow must be replaced with
        //    DefaultAzureCredential.
        for (const javaFile of collectJavaFiles(workspacePath)) {
          const codeNoComments = stripJavaComments(fs.readFileSync(javaFile, "utf8"));
          expect(codeNoComments).not.toMatch(/AZURE_AUTH_LOCATION/);
        }
      });
    }, javaMigrationTimeoutMs);

    test("migrates EventProcessorHost InMemory managers to BlobCheckpointStore", async () => {
      await withTestResult(async () => {
        const { workspacePath } = await runJavaMigration("java-legacy-sdk-eventhubs");

        const pomNoComments = readPomNoComments(workspacePath);

        // 1. No remaining legacy com.microsoft.azure dependencies.
        expect(pomNoComments).not.toMatch(/<groupId>\s*com\.microsoft\.azure\s*<\/groupId>/);

        // 2. azure-sdk-bom + com.azure are the new home.
        expect(pomNoComments).toMatch(/<artifactId>\s*azure-sdk-bom\s*<\/artifactId>/);
        expect(pomNoComments).toMatch(/<groupId>\s*com\.azure\s*<\/groupId>/);

        // 3. EventProcessorHost migration: no InMemory* checkpoint/lease
        //    types may survive in code (the skill explicitly forbids keeping
        //    or recreating them — see com.microsoft.azure.eventprocessorhost.md).
        //    Comments are stripped, so behavioral-change notes referencing
        //    "InMemoryCheckpointManager" are allowed.
        let sawBlobCheckpointStore = false;
        for (const javaFile of collectJavaFiles(workspacePath)) {
          const codeNoComments = stripJavaComments(fs.readFileSync(javaFile, "utf8"));
          expect(codeNoComments).not.toMatch(/\bInMemory[A-Z]\w*/);
          if (/\bBlobCheckpointStore\b/.test(codeNoComments)) {
            sawBlobCheckpointStore = true;
          }
        }

        // 4. BlobCheckpointStore is the only acceptable replacement for the
        //    legacy InMemory* managers — at least one migrated file must use it.
        expect(sawBlobCheckpointStore).toBe(true);
      });
    }, javaMigrationTimeoutMs);

    test("migrates Batch defineNewApplicationPackage chain to applicationPackages().define()", async () => {
      await withTestResult(async () => {
        const { workspacePath } = await runJavaMigration("java-legacy-sdk-batch");

        const pomNoComments = readPomNoComments(workspacePath);

        // 1. No remaining legacy com.microsoft.azure dependencies.
        expect(pomNoComments).not.toMatch(/<groupId>\s*com\.microsoft\.azure\s*<\/groupId>/);

        // 2. At least one com.azure.resourcemanager:* dependency replaces the
        //    legacy azure-mgmt-batch SDK.
        expect(pomNoComments).toMatch(/<groupId>\s*com\.azure\.resourcemanager\s*<\/groupId>/);

        // 3. Batch application-package migration: per
        //    com.microsoft.azure.management.md, the legacy
        //    `.defineNewApplicationPackage(...)` chain on BatchAccount must be
        //    rewritten to top-level `.applicationPackages().define(...)`.
        let sawApplicationPackagesDefine = false;
        for (const javaFile of collectJavaFiles(workspacePath)) {
          const codeNoComments = stripJavaComments(fs.readFileSync(javaFile, "utf8"));
          if (/applicationPackages\(\s*\)\s*\.define\s*\(/.test(codeNoComments)) {
            sawApplicationPackagesDefine = true;
          }
        }
        expect(sawApplicationPackagesDefine).toBe(true);
      });
    }, javaMigrationTimeoutMs);
  });

});
