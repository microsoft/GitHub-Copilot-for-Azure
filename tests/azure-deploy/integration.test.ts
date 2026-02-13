/**
 * Integration Tests for azure-deploy
 * 
 * Tests skill behavior with a real Copilot agent session.
 * Runs prompts multiple times to measure skill invocation rate.
 * 
 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 */

import {
  isSkillInvoked,
  shouldSkipIntegrationTests,
  getIntegrationSkipReason,
  useAgentRunner,
  type AgentMetadata
} from "../utils/agent-runner";
import * as fs from "fs";
import { hasDeployLinks, hasTerraformFiles, hasBicepFiles } from "./utils";
import { cloneRepo } from "../utils/git-clone";

const SKILL_NAME = "azure-deploy";
const RUNS_PER_PROMPT = 5;
const EXPECTED_INVOCATION_RATE = 0.6; // 60% minimum invocation rate
const ESHOP_REPO = "https://github.com/dotnet/eShop.git";

/**
 * Infrastructure as Code type
 */
type IacType = "bicep" | "terraform";

/**
 * Assert deployment outcome with skill invocations, deploy links, and IaC files
 * Adds soft warnings for skill invocations and strict assertions for links and IaC
 */
function assertDeployOutcome(
  agentMetadata: AgentMetadata,
  options: {
    expectIac?: IacType;
    skillName?: string;
  }
): void {
  const skillName = options.skillName || SKILL_NAME;
  
  // Soft assertions - add warnings to test comments
  const isSkillUsed = isSkillInvoked(agentMetadata, skillName);
  const isValidateInvoked = isSkillInvoked(agentMetadata, "azure-validate");
  const isPrepareInvoked = isSkillInvoked(agentMetadata, "azure-prepare");
  
  if (!isSkillUsed) {
    agentMetadata.testComments.push(`⚠️ ${skillName} skill was expected to be used but was not used.`);
  }
  if (!isValidateInvoked) {
    agentMetadata.testComments.push("⚠️ azure-validate skill was expected to be used but was not used.");
  }
  if (!isPrepareInvoked) {
    agentMetadata.testComments.push("⚠️ azure-prepare skill was expected to be used but was not used.");
  }
  
  // Strict assertions
  const containsDeployLinks = hasDeployLinks(agentMetadata);
  expect(containsDeployLinks).toBe(true);
  
  // Check IaC files based on expectation
  if (options.expectIac === "bicep") {
    const hasBicep = hasBicepFiles(agentMetadata);
    expect(hasBicep).toBe(true);
  } else if (options.expectIac === "terraform") {
    const hasTerraform = hasTerraformFiles(agentMetadata);
    expect(hasTerraform).toBe(true);
  }
}

// Check if integration tests should be skipped at module level
const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

// Log skip reason if skipping
if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;
const deployTestTimeoutMs = 1800000;

describeIntegration(`${SKILL_NAME} - Integration Tests`, () => {
  const agent = useAgentRunner();
  describe("skill-invocation", () => {
    test("invokes azure-deploy skill for deployment prompt", async () => {
      let successCount = 0;

      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Run azd up to deploy my already-prepared app to Azure"
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
      console.log(`${SKILL_NAME} invocation rate for deployment prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`);
      fs.appendFileSync(`./result-${SKILL_NAME}.txt`, `${SKILL_NAME} invocation rate for deployment prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`);
      expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    });

    test("invokes azure-deploy skill for publish to Azure prompt", async () => {
      let successCount = 0;

      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Publish my web app to Azure and configure the environment"
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
      console.log(`${SKILL_NAME} invocation rate for publish prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`);
      fs.appendFileSync(`./result-${SKILL_NAME}.txt`, `${SKILL_NAME} invocation rate for publish prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`);
      expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    });

    test("invokes azure-deploy skill for Azure Functions deployment prompt", async () => {
      let successCount = 0;

      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Deploy my Azure Functions app to the cloud using azd"
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
      console.log(`${SKILL_NAME} invocation rate for Functions deployment prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`);
      fs.appendFileSync(`./result-${SKILL_NAME}.txt`, `${SKILL_NAME} invocation rate for Functions deployment prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`);
      expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    });
  });

  // Need to be logged into azd for these tests. 
  // azd auth login
  const FOLLOW_UP_PROMPT = ["Go with recommended options."];
  // Static Web Apps (SWA)
  describe("static-web-apps-deploy", () => {
    test("creates whiteboard application", async () => {
      const agentMetadata = await agent.run({
        prompt: "Create a static whiteboard web app and deploy to Azure using my current subscription in eastus2 region.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT
      });

      assertDeployOutcome(agentMetadata, { expectIac: "bicep", skillName: SKILL_NAME });
    }, deployTestTimeoutMs);

    test("creates static portfolio website", async () => {
      const agentMetadata = await agent.run({
        prompt: "Create a static portfolio website and deploy to Azure using my current subscription in eastus2 region.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT
      });

      assertDeployOutcome(agentMetadata, { expectIac: "bicep", skillName: SKILL_NAME });
    }, deployTestTimeoutMs);

    // Terraform test
    test("creates static portfolio website with Terraform infrastructure", async () => {
      const agentMetadata = await agent.run({
        prompt: "Create a static portfolio website and deploy to Azure Static Web Apps using azd with Terraform infrastructure in my current subscription in eastus2 region.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT
      });

      assertDeployOutcome(agentMetadata, { expectIac: "terraform", skillName: SKILL_NAME });
    }, deployTestTimeoutMs);
  });

  // App Service
  describe("app-service-deploy", () => {
    test("creates discussion board", async () => {
      const agentMetadata = await agent.run({
        prompt: "Create a discussion board application and deploy to Azure App Service using my current subscription in eastus2 region.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT
      });

      assertDeployOutcome(agentMetadata, { expectIac: "bicep", skillName: SKILL_NAME });
    }, deployTestTimeoutMs);

    test("creates todo list with frontend and API", async () => {
      const agentMetadata = await agent.run({
        prompt: "Create a todo list with frontend and API and deploy to Azure App Service using my current subscription in eastus2 region.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT
      });

      assertDeployOutcome(agentMetadata, { expectIac: "bicep", skillName: SKILL_NAME });
    }, deployTestTimeoutMs);

    // Terraform test
    test("creates todo list with frontend and API using Terraform", async () => {
      const agentMetadata = await agent.run({
        prompt: "Create a todo list with frontend and API and deploy to Azure App Service using azd with Terraform infrastructure in my current subscription in eastus2 region.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT
      });

      assertDeployOutcome(agentMetadata, { expectIac: "terraform", skillName: SKILL_NAME });
    }, deployTestTimeoutMs);
  });

  // Azure Functions
  describe("azure-functions-deploy", () => {
    test("creates serverless HTTP API", async () => {
      const agentMetadata = await agent.run({
        prompt: "Create a serverless HTTP API using Azure Functions and deploy to Azure using my current subscription in eastus2 region.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT
      });

      assertDeployOutcome(agentMetadata, { expectIac: "bicep", skillName: SKILL_NAME });
    }, deployTestTimeoutMs);

    test("creates event-driven function app", async () => {
      const agentMetadata = await agent.run({
        prompt: "Create an event-driven function app to process messages and deploy to Azure Functions using my current subscription in eastus2 region.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT
      });

      assertDeployOutcome(agentMetadata, { expectIac: "bicep", skillName: SKILL_NAME });
    }, deployTestTimeoutMs);

    // Terraform test
    test("creates URL shortener service with Terraform infrastructure", async () => {
      const agentMetadata = await agent.run({
        prompt: "Create a URL shortener service using Azure Functions that creates short links and redirects users to the original URL and deploy to Azure using azd with Terraform infrastructure in my current subscription in eastus2 region.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT
      });

      assertDeployOutcome(agentMetadata, { expectIac: "terraform", skillName: SKILL_NAME });
    }, deployTestTimeoutMs);
  });

  // Azure Container Apps (ACA)
  describe("azure-container-apps-deploy", () => {
    test("creates containerized web application", async () => {
      const agentMetadata = await agent.run({
        prompt: "Create a containerized web application and deploy to Azure Container Apps using my current subscription in eastus2 region.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT
      });

      assertDeployOutcome(agentMetadata, { expectIac: "bicep", skillName: SKILL_NAME });
    }, deployTestTimeoutMs);

    test("creates simple containerized Node.js app", async () => {
      const agentMetadata = await agent.run({
        prompt: "Create a simple containerized Node.js hello world app and deploy to Azure Container Apps using my current subscription in eastus2 region.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT
      });

      assertDeployOutcome(agentMetadata, { expectIac: "bicep", skillName: SKILL_NAME });
    }, deployTestTimeoutMs);

    // Terraform test
    test("creates social media application with Terraform infrastructure", async () => {
      const agentMetadata = await agent.run({
        prompt: "Create a simple social media application with likes and comments and deploy to Azure using azd with Terraform infrastructure in my current subscription in eastus2 region.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT
      });

      assertDeployOutcome(agentMetadata, { expectIac: "terraform", skillName: SKILL_NAME });
    }, deployTestTimeoutMs);
  });

  describe("brownfield-dotnet", () => {
    test("deploys eShop to Azure for small scale production", async () => {
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            await cloneRepo({
              repoUrl: ESHOP_REPO,
              targetDir: workspace,
              depth: 1,
            });
          },
          prompt:
            "Please deploy this application to Azure. " +
            "Use the eastus2 region. " +
            "Use my current subscription. " +
            "This is for a small scale production environment. " +
            "Use standard SKUs",
          nonInteractive: true,
          followUp: FOLLOW_UP_PROMPT,
        });
    
        assertDeployOutcome(agentMetadata, { skillName: SKILL_NAME });
      }, deployTestTimeoutMs);
  })
});

