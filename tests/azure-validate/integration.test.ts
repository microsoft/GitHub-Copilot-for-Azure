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
  shouldSkipIntegrationTests,
  getIntegrationSkipReason
} from "../utils/agent-runner";
import {
  hasValidationCommand,
  matchesFileEdit,
} from "./utils";
import { cloneRepo } from "../utils/git-clone";
import { matchesCommand, softCheckSkill } from "../utils/evaluate";
import { isSkillInvoked } from "../utils/evaluate";

const SKILL_NAME = "azure-validate";
const RUNS_PER_PROMPT = 5;
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
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Check if my app is ready to deploy to Azure"
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

    test("invokes azure-validate skill for azure.yaml validation prompt", async () => {
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Validate my azure.yaml configuration before deploying"
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

    // Preflight validation tests (formerly azure-deployment-preflight)
    test("invokes azure-validate skill for Bicep validation prompt", async () => {
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Validate my Bicep template before deploying to Azure"
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

    test("invokes azure-validate skill for what-if analysis prompt", async () => {
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Run a what-if analysis to preview changes before deploying my infrastructure"
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
          matchesCommand(metadata, /azd\s+(provision|deploy|up)/),
      });

      const setsSecretStorageType = matchesFileEdit(
        agentMetadata,
        /AppHost\.cs/i,
        /AzureWebJobsSecretStorageType/i,
      );
      expect(setsSecretStorageType).toBe(true);

      agentMetadata.testComments.push("⚠️ We do not expect this test to deploy.");
    }, aspireEnvVarTestTimeoutMs);
  });
});
