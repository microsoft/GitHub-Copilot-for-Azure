/**
 * Integration Tests for azure-prepare
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
  getIntegrationSkipReason,
  getToolCalls
} from "../utils/agent-runner";
import { hasValidationCommand } from "../azure-validate/utils";
import { hasPlanReadyForValidation, getDockerContext } from "./utils";
import { cloneRepo } from "../utils/git-clone";
import * as fs from "fs";
import { expectFiles } from "../utils/evaluate";

const SKILL_NAME = "azure-prepare";
const RUNS_PER_PROMPT = 5;
const EXPECTED_INVOCATION_RATE = 0.6; // 60% minimum invocation rate
const FOLLOW_UP_PROMPT = ["Go with recommended options."];

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
    test("invokes azure-prepare skill for new Azure application preparation prompt", async () => {
      let successCount = 0;

      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Prepare my application for Azure deployment and set up the infrastructure"
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
      console.log(`${SKILL_NAME} invocation rate for Azure preparation prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`);
      fs.appendFileSync(`./result-${SKILL_NAME}.txt`, `${SKILL_NAME} invocation rate for Azure preparation prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`);
      expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    });

    test("invokes azure-prepare skill for modernizing application for Azure prompt", async () => {
      let successCount = 0;

      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Modernize my existing application for Azure hosting and generate the required infrastructure files"
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
      console.log(`${SKILL_NAME} invocation rate for modernization prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`);
      fs.appendFileSync(`./result-${SKILL_NAME}.txt`, `${SKILL_NAME} invocation rate for modernization prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`);
      expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    });

    test("invokes azure-prepare skill for Key Vault secrets integration prompt", async () => {
      let successCount = 0;

      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Prepare my Azure application to use Key Vault for storing secrets and credentials"
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
      console.log(`${SKILL_NAME} invocation rate for Key Vault integration prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`);
      fs.appendFileSync(`./result-${SKILL_NAME}.txt`, `${SKILL_NAME} invocation rate for Key Vault integration prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`);
      expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    });

    test("invokes azure-prepare skill for Azure Identity authentication prompt", async () => {
      let successCount = 0;

      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Set up my Azure application with managed identity authentication for accessing Azure services"
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
      console.log(`${SKILL_NAME} invocation rate for Azure Identity authentication prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`);
      fs.appendFileSync(`./result-${SKILL_NAME}.txt`, `${SKILL_NAME} invocation rate for Azure Identity authentication prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`);
      expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    });
    test("invokes azure-prepare skill for Azure deployment with Terraform prompt", async () => {
      let successCount = 0;

      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Create a simple social media application with likes and comments and deploy to Azure using Terraform infrastructure code"
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
      console.log(`${SKILL_NAME} invocation rate for Terraform deployment prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`);
      fs.appendFileSync(`./result-${SKILL_NAME}.txt`, `${SKILL_NAME} invocation rate for Terraform deployment prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`);
      expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    });
  });

  describe("prepare-deployment", () => {
    test("creates project files for static whiteboard web app before validation", async () => {
      let workspacePath: string | undefined;

      const agentMetadata = await agent.run({
        setup: async (workspace: string) => {
          workspacePath = workspace;
        },
        prompt: "Create a static whiteboard web app and deploy to Azure.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT,
        preserveWorkspace: true,
        shouldEarlyTerminate: (metadata) =>
          hasPlanReadyForValidation(metadata) || hasValidationCommand(metadata) || isSkillInvoked(metadata, "azure-validate"),
      });

      expect(workspacePath).toBeDefined();
      expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
      const planReady = hasPlanReadyForValidation(agentMetadata);
      expect(planReady).toBe(true);
    });

    test("creates correct files for AZD with Bicep recipe", async () => {
      let workspacePath: string | undefined;

      const agentMetadata = await agent.run({
        setup: async (workspace: string) => {
          workspacePath = workspace;
        },
        prompt: "Create a simple todo web app and deploy to Azure.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT,
        preserveWorkspace: true,
        shouldEarlyTerminate: (metadata) =>
          hasPlanReadyForValidation(metadata) || hasValidationCommand(metadata) || isSkillInvoked(metadata, "azure-validate"),
      });

      expect(workspacePath).toBeDefined();
      expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
      expectFiles(workspacePath!,
        [/plan\.md$/, /azure\.yaml$/, /infra\/.*\.bicep$/],
        [/\.tf$/],
      );
    });

    test("creates correct files for Terraform recipe", async () => {
      let workspacePath: string | undefined;

      const agentMetadata = await agent.run({
        setup: async (workspace: string) => {
          workspacePath = workspace;
        },
        prompt: "Create a simple todo web app and deploy to Azure with Terraform as the infrastructure provider.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT,
        preserveWorkspace: true,
        shouldEarlyTerminate: (metadata) =>
          hasPlanReadyForValidation(metadata) || hasValidationCommand(metadata) || isSkillInvoked(metadata, "azure-validate"),
      });

      expect(workspacePath).toBeDefined();
      expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
      expectFiles(workspacePath!,
        [/plan\.md$/, /infra\/.*\.tf$/],
        [/\.bicep$/, /azure\.yaml$/],
      );
    });

    test("creates correct files for standalone Bicep recipe", async () => {
      let workspacePath: string | undefined;

      const agentMetadata = await agent.run({
        setup: async (workspace: string) => {
          workspacePath = workspace;
        },
        prompt: "Create a simple todo web app and deploy to Azure using standalone Bicep templates.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT,
        preserveWorkspace: true,
        shouldEarlyTerminate: (metadata) =>
          hasPlanReadyForValidation(metadata) || hasValidationCommand(metadata) || isSkillInvoked(metadata, "azure-validate"),
      });

      expect(workspacePath).toBeDefined();
      expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
      expectFiles(workspacePath!,
        [/plan\.md$/, /infra\/.*\.bicep$/, /infra\/.*\.parameters\.json$/],
        [/azure\.yaml$/, /\.tf$/],
      );
    });
  });

  describe("aspire-brownfield", () => {
    const ASPIRE_SAMPLES_REPO = "https://github.com/dotnet/aspire-samples.git";

    test("sets correct docker context for Aspire container-build sample", async () => {
      const CONTAINER_BUILD_SPARSE_PATH = "samples/container-build";
      let workspacePath: string | undefined;

      const agentMetadata = await agent.run({
        setup: async (workspace: string) => {
          workspacePath = workspace;
          await cloneRepo({
            repoUrl: ASPIRE_SAMPLES_REPO,
            targetDir: workspace,
            depth: 1,
            sparseCheckoutPath: CONTAINER_BUILD_SPARSE_PATH,
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
        preserveWorkspace: true,
        shouldEarlyTerminate: (metadata) =>
          hasPlanReadyForValidation(metadata) || hasValidationCommand(metadata) || isSkillInvoked(metadata, "azure-validate"),
      });

      expect(workspacePath).toBeDefined();
      expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
      expectFiles(workspacePath!, [/azure\.yaml$/], []);

      // The AppHost defines: builder.AddDockerfile("ginapp", "./ginapp")
      // So azure.yaml should have docker.context: ginapp (not "." or the project root)
      const dockerContext = getDockerContext(workspacePath!, "ginapp");
      expect(dockerContext).toBeDefined();
      expect(dockerContext).toMatch(/ginapp/);
    });
  });

  describe("entra-sql-auth", () => {
    test("generates Entra-only SQL auth for ASP.NET Core EF Core app (not SQL admin password)", async () => {
      const agentMetadata = await agent.run({
        prompt:
          "Create an ASP.NET Core 8 web API with a Todo model using Entity Framework Core and SQL Server. " +
          "Then prepare it for Azure deployment. " +
          "Use the eastus2 region and my current subscription.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT,
        shouldEarlyTerminate: (metadata) =>
          hasPlanReadyForValidation(metadata) ||
          hasValidationCommand(metadata) ||
          isSkillInvoked(metadata, "azure-validate"),
      });

      // Preconditions
      expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

      // Collect all file contents the agent wrote via create tool calls
      const createCalls = getToolCalls(agentMetadata, "create");
      const bicepContents = createCalls
        .filter(event => {
          const args = (event.data as Record<string, unknown>).arguments as { path?: string } | undefined;
          return args?.path?.endsWith(".bicep");
        })
        .map(event => {
          const args = (event.data as Record<string, unknown>).arguments as { file_text?: string };
          return args?.file_text ?? "";
        });
      const bicepContent = bicepContents.join("\n");
      expect(bicepContent.length).toBeGreaterThan(0);

      // Must NOT use legacy SQL admin login/password auth
      expect(/administratorLoginPassword/i.test(bicepContent)).toBe(false);

      // Must use Entra-only authentication
      expect(/azureADOnlyAuthentication\s*:\s*true/i.test(bicepContent)).toBe(true);

      // Connection string should use Active Directory auth (Default or Managed Identity)
      const allFileContents = createCalls
        .map(event => {
          const args = (event.data as Record<string, unknown>).arguments as { file_text?: string };
          return args?.file_text ?? "";
        })
        .join("\n");
      expect(/Authentication\s*=\s*Active\s+Directory\s+(Default|Managed\s+Identity)/i.test(allFileContents)).toBe(true);
    });
  });
});
