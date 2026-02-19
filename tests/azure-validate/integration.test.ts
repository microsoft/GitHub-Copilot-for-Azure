/**
 * Integration Tests for azure-validate
 * 
 * Tests skill behavior with a real Copilot agent session.
 * Runs prompts multiple times to measure skill invocation rate.
 * 
 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 */

import {
  useAgentRunner,
  isSkillInvoked,
  shouldSkipIntegrationTests,
  getIntegrationSkipReason
} from "../utils/agent-runner";
import {
  hasValidationCommand,
  matchesCommand,
  matchesToolCallArgs,
} from "./utils";
import { cloneRepo } from "../utils/git-clone";
import * as fs from "fs";

const SKILL_NAME = "azure-validate";
const RUNS_PER_PROMPT = 5;
const EXPECTED_INVOCATION_RATE = 0.6; // 60% minimum invocation rate
const aspireEnvVarTestTimeoutMs = 2700000; // 45 minutes

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
    test("invokes azure-validate skill for deployment readiness check", async () => {
      let successCount = 0;

      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Check if my app is ready to deploy to Azure"
          });

          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            successCount++;
          }
        } catch (e: unknown) {
          if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
            console.log("⏭️  SDK not loadable, skipping test");
            return;
          }
          throw e;
        }
      }

      const invocationRate = successCount / RUNS_PER_PROMPT;
      console.log(`${SKILL_NAME} invocation rate for readiness check: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`);
      fs.appendFileSync(`./result-${SKILL_NAME}.txt`, `${SKILL_NAME} invocation rate for readiness check: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`);
      expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    });

    test("invokes azure-validate skill for azure.yaml validation prompt", async () => {
      let successCount = 0;

      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Validate my azure.yaml configuration before deploying"
          });

          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            successCount++;
          }
        } catch (e: unknown) {
          if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
            console.log("⏭️  SDK not loadable, skipping test");
            return;
          }
          throw e;
        }
      }

      const invocationRate = successCount / RUNS_PER_PROMPT;
      console.log(`${SKILL_NAME} invocation rate for azure.yaml validation: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`);
      fs.appendFileSync(`./result-${SKILL_NAME}.txt`, `${SKILL_NAME} invocation rate for azure.yaml validation: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`);
      expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    });

    // Preflight validation tests (formerly azure-deployment-preflight)
    test("invokes azure-validate skill for Bicep validation prompt", async () => {
      let successCount = 0;

      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Validate my Bicep template before deploying to Azure"
          });

          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            successCount++;
          }
        } catch (e: unknown) {
          if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
            console.log("⏭️  SDK not loadable, skipping test");
            return;
          }
          throw e;
        }
      }

      const invocationRate = successCount / RUNS_PER_PROMPT;
      console.log(`${SKILL_NAME} invocation rate for Bicep validation prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`);
      fs.appendFileSync(`./result-${SKILL_NAME}.txt`, `${SKILL_NAME} invocation rate for Bicep validation prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`);
      expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    });

    test("invokes azure-validate skill for what-if analysis prompt", async () => {
      let successCount = 0;

      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Run a what-if analysis to preview changes before deploying my infrastructure"
          });

          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            successCount++;
          }
        } catch (e: unknown) {
          if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
            console.log("⏭️  SDK not loadable, skipping test");
            return;
          }
          throw e;
        }
      }

      const invocationRate = successCount / RUNS_PER_PROMPT;
      console.log(`${SKILL_NAME} invocation rate for what-if prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`);
      fs.appendFileSync(`./result-${SKILL_NAME}.txt`, `${SKILL_NAME} invocation rate for what-if prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`);
      expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    });
  });

  describe("deployment-validation", () => {
    const FOLLOW_UP_PROMPT = ["Go with recommended options."];

    test("terminates at validation for static whiteboard web app", async () => {
      const agentMetadata = await agent.run({
        prompt: "Create a static whiteboard web app and deploy to Azure.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT,
        shouldEarlyTerminate: (metadata) =>
          hasValidationCommand(metadata) || isSkillInvoked(metadata, "azure-deploy"),
      });

      const deployInvoked = isSkillInvoked(agentMetadata, "azure-deploy");
      expect(deployInvoked).toBe(false);

      const validateInvoked = isSkillInvoked(agentMetadata, SKILL_NAME);
      const validationCommandRan = hasValidationCommand(agentMetadata);
      expect(validateInvoked || validationCommandRan).toBe(true);
    });

    test("terminates at validation for static portfolio website", async () => {
      const agentMetadata = await agent.run({
        prompt: "Create a static portfolio website and deploy to Azure.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT,
        shouldEarlyTerminate: (metadata) =>
          hasValidationCommand(metadata) || isSkillInvoked(metadata, "azure-deploy"),
      });

      const deployInvoked = isSkillInvoked(agentMetadata, "azure-deploy");
      expect(deployInvoked).toBe(false);

      const validateInvoked = isSkillInvoked(agentMetadata, SKILL_NAME);
      const validationCommandRan = hasValidationCommand(agentMetadata);
      expect(validateInvoked || validationCommandRan).toBe(true);
    });

    test("terminates at validation for containerized web app on Container Apps", async () => {
      const agentMetadata = await agent.run({
        prompt: "Create a containerized web application and deploy to Azure Container Apps.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT,
        shouldEarlyTerminate: (metadata) =>
          hasValidationCommand(metadata) || isSkillInvoked(metadata, "azure-deploy"),
      });

      const deployInvoked = isSkillInvoked(agentMetadata, "azure-deploy");
      expect(deployInvoked).toBe(false);

      const validateInvoked = isSkillInvoked(agentMetadata, SKILL_NAME);
      const validationCommandRan = hasValidationCommand(agentMetadata);
      expect(validateInvoked || validationCommandRan).toBe(true);
    });
  });

  describe("brownfield-dotnet-validate", () => {
    const ASPIRE_SAMPLES_REPO = "https://github.com/dotnet/aspire-samples.git";
    const FOLLOW_UP_PROMPT = ["Go with recommended options."];
    const CONTAINER_DEPLOY_ENV_PATTERNS: readonly RegExp[] = [
      /AZURE_CONTAINER_REGISTRY_ENDPOINT/i,
      /AZURE_CONTAINER_REGISTRY_MANAGED_IDENTITY_ID/i,
      /MANAGED_IDENTITY_CLIENT_ID/i,
    ];

    test("sets container deploy env vars for orleans-voting (Aspire limited mode)", async () => {
      const ORLEANS_VOTING_SPARSE_PATH = "samples/orleans-voting";

      const agentMetadata = await agent.run({
        setup: async (workspace: string) => {
          await cloneRepo({
            repoUrl: ASPIRE_SAMPLES_REPO,
            targetDir: workspace,
            depth: 1,
            sparseCheckoutPath: ORLEANS_VOTING_SPARSE_PATH,
          });
        },
        prompt:
          "Please deploy this application to Azure. " +
          "Use the eastus2 region. " +
          "Use my current subscription. " +
          "This is for a small scale production environment. " +
          "Use standard SKUs.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT,
        shouldEarlyTerminate: (metadata) =>
          matchesCommand(metadata, /azd\s+(deploy|up)/),
      });

      const setAll = CONTAINER_DEPLOY_ENV_PATTERNS.every(p => matchesCommand(agentMetadata, p));
      expect(setAll).toBe(true);

      agentMetadata.testComments.push("⚠️ We do not expect this test to deploy.");
    }, aspireEnvVarTestTimeoutMs);

    test("passes --environment on azd init and sets subscription before provision", async () => {
      const CLIENT_APPS_SPARSE_PATH = "samples/client-apps-integration";

      const agentMetadata = await agent.run({
        setup: async (workspace: string) => {
          await cloneRepo({
            repoUrl: ASPIRE_SAMPLES_REPO,
            targetDir: workspace,
            depth: 1,
            sparseCheckoutPath: CLIENT_APPS_SPARSE_PATH,
          });
        },
        prompt:
          "Please deploy this application to Azure. " +
          "Use the eastus2 region. " +
          "Use my current subscription. " +
          "This is for a small scale production environment. " +
          "Use standard SKUs.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT,
        shouldEarlyTerminate: (metadata) =>
          matchesCommand(metadata, /azd\s+(provision|up)/),
      });

      const envFlagOnInit = matchesCommand(
        agentMetadata,
        /azd\s+init\b.*(\s+--environment\s+|-e\s+)\S+/i,
      );
      expect(envFlagOnInit).toBe(true);

      const setsSubscription = matchesCommand(
        agentMetadata,
        /azd\s+env\s+set\s+AZURE_SUBSCRIPTION_ID\s+\S+/i,
      );
      expect(setsSubscription).toBe(true);

      agentMetadata.testComments.push("⚠️ We do not expect this test to deploy.");
    }, aspireEnvVarTestTimeoutMs);

    test("sets AzureWebJobsSecretStorageType for aspire-with-azure-functions", async () => {
      const ASPIRE_FUNCTIONS_SPARSE_PATH = "samples/aspire-with-azure-functions";

      const agentMetadata = await agent.run({
        setup: async (workspace: string) => {
          await cloneRepo({
            repoUrl: ASPIRE_SAMPLES_REPO,
            targetDir: workspace,
            depth: 1,
            sparseCheckoutPath: ASPIRE_FUNCTIONS_SPARSE_PATH,
          });
        },
        prompt:
          "Please deploy this application to Azure. " +
          "Use the eastus2 region. " +
          "Use my current subscription. " +
          "This is for a small scale production environment. " +
          "Use standard SKUs.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT,
        shouldEarlyTerminate: (metadata) =>
          matchesCommand(metadata, /azd\s+(deploy|up)/) ||
          matchesToolCallArgs(metadata, /AzureWebJobsSecretStorageType/i),
      });

      const setsSecretStorageType = matchesToolCallArgs(
        agentMetadata,
        /AzureWebJobsSecretStorageType/i,
      );
      expect(setsSecretStorageType).toBe(true);

      agentMetadata.testComments.push("⚠️ We do not expect this test to deploy.");
    }, aspireEnvVarTestTimeoutMs);
  });
});
