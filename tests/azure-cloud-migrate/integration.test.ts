/**
 * Integration Tests for azure-cloud-migrate
 *
 * Tests skill behavior with a real Copilot agent session.
 *
 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 */

import * as fs from "fs";
import * as path from "path";
import {
  shouldSkipIntegrationTests,
  getIntegrationSkipReason,
  useAgentRunner
} from "../utils/agent-runner";
import { cloneRepo } from "../utils/git-clone";
import { expectFiles, isSkillInvoked, shouldEarlyTerminateForSkillInvocation, withTestResult } from "../utils/evaluate";

/**
 * Find the -azure output directory. The skill may create it as a sibling
 * of the workspace (e.g. /tmp/ws-azure) or nested inside the workspace
 * (e.g. /tmp/ws/ws-azure). Returns the first match found.
 */
function findAzureOutputDir(workspacePath: string): string {
  const basename = path.basename(workspacePath);
  const azureDirName = basename + "-azure";

  // Check sibling location first (original expected path)
  const siblingPath = workspacePath + "-azure";
  if (fs.existsSync(siblingPath)) {
    return siblingPath;
  }

  // Search recursively inside the workspace
  const nested = findDirRecursive(workspacePath, azureDirName);
  if (nested) {
    return nested;
  }

  // Return sibling path to produce a clear assertion error
  return siblingPath;
}

const SKIP_DIRS = new Set([".git", "node_modules"]);

function findDirRecursive(dir: string, targetName: string): string | null {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  const subdirs: fs.Dirent[] = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (entry.name === targetName) {
        return path.join(dir, entry.name);
      }
      if (!SKIP_DIRS.has(entry.name)) {
        subdirs.push(entry);
      }
    }
  }
  for (const entry of subdirs) {
    const found = findDirRecursive(path.join(dir, entry.name), targetName);
    if (found) return found;
  }
  return null;
}

const SKILL_NAME = "azure-cloud-migrate";
const FACE_BLUR_REPO = "https://github.com/aws-samples/serverless-face-blur-service.git";
const WEBAPP_REPO = "https://github.com/aws-samples/lambda-refarch-webapp.git";

const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;
const migrationTestTimeoutMs = 2700000;
const FOLLOW_UP_PROMPT = ["Go with recommended options and test it locally."];

describeIntegration(`${SKILL_NAME}_ - Integration Tests`, () => {
  const agent = useAgentRunner();

  describe("brownfield-lambda", () => {
    test("migrates serverless-face-blur-service Lambda to Azure", async () => {
      await withTestResult(async () => {
        let workspacePath: string | undefined;

        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
            await cloneRepo({
              repoUrl: FACE_BLUR_REPO,
              targetDir: workspace,
              depth: 1,
            });
          },
          prompt: "Migrate this Lambda to Azure. " +
            "Use the eastus2 region. " +
            "Use my current subscription. ",
          nonInteractive: true,
          followUp: FOLLOW_UP_PROMPT,
          followUpTimeout: migrationTestTimeoutMs
        });

        const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
        expect(isSkillUsed).toBe(true);

        // Verify migrated files exist in the -azure directory
        expect(workspacePath).toBeDefined();
        const migratedPath = findAzureOutputDir(workspacePath!);
        expectFiles(migratedPath, [
          /src\/app\.js$/,
          /src\/detectFaces\.js$/,
          /src\/blurFaces\.js$/,
          /migration-status\.md$/,
          /migration-assessment-report\.md$/
        ], []);
      });
    }, migrationTestTimeoutMs);
  });

  describe("brownfield-lambda-webapp", () => {
    test("migrates lambda-refarch-webapp to Azure", async () => {
      await withTestResult(async () => {
        let workspacePath: string | undefined;

        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
            await cloneRepo({
              repoUrl: WEBAPP_REPO,
              targetDir: workspace,
              depth: 1,
            });
          },
          prompt: "Migrate this Lambda to Azure. " +
            "Use the eastus2 region. " +
            "Use my current subscription. ",
          nonInteractive: true,
          followUp: FOLLOW_UP_PROMPT,
          followUpTimeout: migrationTestTimeoutMs
        });

        const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
        expect(isSkillUsed).toBe(true);

        // Verify migrated files exist in the -azure directory
        expect(workspacePath).toBeDefined();
        const migratedPath = findAzureOutputDir(workspacePath!);
        expectFiles(migratedPath, [
          /migration-status\.md$/,
          /migration-assessment-report\.md$/
        ], []);
      });
    }, migrationTestTimeoutMs);
  });

  describe("Kubernetes to Container Apps migration scenario", () => {
    test("invokes skill for k8s to ACA migration prompt", async () => {
      await withTestResult(async () => {
        const agentMetadata = await agent.run({
          prompt: "I want to migrate my Kubernetes workloads from GKE to Azure Container Apps. Can you help me assess compatibility and create a migration plan?",
          nonInteractive: true,
          shouldEarlyTerminate: (metadata) => shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME),
        });

        const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
        expect(isSkillUsed).toBe(true);
      });
    }, migrationTestTimeoutMs);

    test("invokes skill for k8s manifest conversion", async () => {
      await withTestResult(async () => {
        const agentMetadata = await agent.run({
          prompt: "How do I convert my Kubernetes deployment manifests to Azure Container Apps configuration?",
          nonInteractive: true,
          shouldEarlyTerminate: (metadata) => shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME),
        });

        const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
        expect(isSkillUsed).toBe(true);
      });
    }, migrationTestTimeoutMs);
  });
});