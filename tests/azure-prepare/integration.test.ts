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
  shouldSkipIntegrationTests,
  getIntegrationSkipReason,
} from "../utils/agent-runner";
import { hasValidationCommand } from "../azure-validate/utils";
import { hasPlanReadyForValidation, getDockerContext, hasServicesSection, getServiceProject } from "./utils";
import { cloneRepo } from "../utils/git-clone";
import { doesWorkspaceFileIncludePattern, expectFiles, getToolCalls, listFilesRecursive, softCheckSkill, isSkillInvoked, shouldEarlyTerminateForSkillInvocation, withTestResult } from "../utils/evaluate";
import * as fs from "fs";

const SKILL_NAME = "azure-prepare";
const RUNS_PER_PROMPT = 1;
const FOLLOW_UP_PROMPT = ["Continue with recommended options until complete."];
const invocationRateThreshold = 0.8;

/**
 * System prompt override for prepare-deployment tests.
 * Skips the Provisioning Limit Checklist (quota validation) to save agent turns
 * for actual infrastructure file generation, which is what these tests verify.
 */
const SKIP_QUOTA_CHECK_PROMPT = {
  mode: "append" as const,
  content: "Skip the Provisioning Limit Checklist (Step 6 in the plan template). Use reasonable default values for quota/limit columns instead of running az quota commands or invoking the azure-quotas skill. Focus your effort on generating the infrastructure and application files.",
};

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
    const followUp = ["Continue with recommended options until complete."];
    test("invokes azure-prepare skill for new Azure application preparation prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "Prepare my application for Azure deployment and set up the infrastructure",
            nonInteractive: true,
            followUp,
            shouldEarlyTerminate: (agentMetadata) => shouldEarlyTerminateForSkillInvocation(agentMetadata, SKILL_NAME)
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invocationCount += 1;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    });

    test("invokes azure-prepare skill for modernizing application for Azure prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "Modernize my existing application for Azure hosting and generate the required infrastructure files",
            nonInteractive: true,
            followUp,
            shouldEarlyTerminate: (agentMetadata) => shouldEarlyTerminateForSkillInvocation(agentMetadata, SKILL_NAME)
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invocationCount += 1;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    });

    test("invokes azure-prepare skill for functional verification before deployment prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "Prepare my web app for Azure and verify it works locally before deploying",
            nonInteractive: true,
            followUp,
            shouldEarlyTerminate: (agentMetadata) => shouldEarlyTerminateForSkillInvocation(agentMetadata, SKILL_NAME)
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invocationCount += 1;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    });

    test("invokes azure-prepare skill for subscription policy compliance prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "Prepare my application for Azure deployment and check subscription policies for compliance",
            nonInteractive: true,
            followUp,
            shouldEarlyTerminate: (agentMetadata) => shouldEarlyTerminateForSkillInvocation(agentMetadata, SKILL_NAME)
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invocationCount += 1;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    });

    test("invokes azure-prepare skill for Key Vault secrets integration prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "Prepare my Azure application to use Key Vault for storing secrets and credentials",
            nonInteractive: true,
            followUp,
            shouldEarlyTerminate: (agentMetadata) => shouldEarlyTerminateForSkillInvocation(agentMetadata, SKILL_NAME)
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invocationCount += 1;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    });

    test("invokes azure-prepare skill for Azure Identity authentication prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "Set up my Azure application with managed identity authentication for accessing Azure services",
            nonInteractive: true,
            followUp,
            shouldEarlyTerminate: (agentMetadata) => shouldEarlyTerminateForSkillInvocation(agentMetadata, SKILL_NAME)
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invocationCount += 1;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    });
    test("invokes azure-prepare skill for Azure deployment with Terraform prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "Create a simple social media application with likes and comments and deploy to Azure using Terraform infrastructure code",
            nonInteractive: true,
            followUp,
            shouldEarlyTerminate: (agentMetadata) => shouldEarlyTerminateForSkillInvocation(agentMetadata, SKILL_NAME)
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invocationCount += 1;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    });

    test("invokes azure-prepare skill for create serverless HTTP API and deploy prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "Create a serverless HTTP API using Azure Functions and deploy to Azure",
            nonInteractive: true,
            followUp,
            shouldEarlyTerminate: (agentMetadata) => shouldEarlyTerminateForSkillInvocation(agentMetadata, SKILL_NAME)
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invocationCount += 1;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    });

    test("invokes azure-prepare skill for create event-driven function app and deploy prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "Create an event-driven function app to process messages and deploy to Azure Functions",
            nonInteractive: true,
            followUp,
            shouldEarlyTerminate: (agentMetadata) => shouldEarlyTerminateForSkillInvocation(agentMetadata, SKILL_NAME)
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invocationCount += 1;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    });

    test("invokes azure-prepare skill for create Azure Functions app with timer trigger prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "Create an Azure Functions app with a timer trigger",
            nonInteractive: true,
            followUp,
            shouldEarlyTerminate: (agentMetadata) => shouldEarlyTerminateForSkillInvocation(agentMetadata, SKILL_NAME)
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invocationCount += 1;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    });

    // --- Deploy integration test prompts (SWA) ---
    test("invokes azure-prepare skill for static whiteboard web app deploy prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "Create a static whiteboard web app and deploy to Azure using my current subscription in eastus2 region.",
            nonInteractive: true,
            followUp,
            shouldEarlyTerminate: (agentMetadata) => shouldEarlyTerminateForSkillInvocation(agentMetadata, SKILL_NAME)
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invocationCount += 1;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    });

    test("invokes azure-prepare skill for static portfolio website deploy prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "Create a static portfolio website and deploy to Azure using my current subscription in eastus2 region.",
            nonInteractive: true,
            followUp,
            shouldEarlyTerminate: (agentMetadata) => shouldEarlyTerminateForSkillInvocation(agentMetadata, SKILL_NAME)
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invocationCount += 1;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    });

    // --- Deploy integration test prompts (App Service) ---
    test("invokes azure-prepare skill for discussion board App Service deploy prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "Create a discussion board application and deploy to Azure App Service using my current subscription in eastus2 region.",
            nonInteractive: true,
            followUp,
            shouldEarlyTerminate: (agentMetadata) => shouldEarlyTerminateForSkillInvocation(agentMetadata, SKILL_NAME)
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invocationCount += 1;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    });

    test("invokes azure-prepare skill for todo list App Service deploy prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "Create a todo list with frontend and API and deploy to Azure App Service using my current subscription in eastus2 region.",
            nonInteractive: true,
            followUp,
            shouldEarlyTerminate: (agentMetadata) => shouldEarlyTerminateForSkillInvocation(agentMetadata, SKILL_NAME)
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invocationCount += 1;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    });

    // --- Deploy integration test prompts (Azure Functions) ---
    test("invokes azure-prepare skill for serverless HTTP API Functions deploy prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "Create a serverless HTTP API using Azure Functions and deploy to Azure using my current subscription in eastus2 region.",
            nonInteractive: true,
            followUp,
            shouldEarlyTerminate: (agentMetadata) => shouldEarlyTerminateForSkillInvocation(agentMetadata, SKILL_NAME)
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invocationCount += 1;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    });

    test("invokes azure-prepare skill for event-driven function app deploy prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "Create an event-driven function app to process messages and deploy to Azure Functions using my current subscription in eastus2 region.",
            nonInteractive: true,
            followUp,
            shouldEarlyTerminate: (agentMetadata) => shouldEarlyTerminateForSkillInvocation(agentMetadata, SKILL_NAME)
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invocationCount += 1;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    });

    test("invokes azure-prepare skill for Python function app Service Bus trigger deploy prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "Create an azure python function app that takes input from a service bus trigger and does message processing and deploy to Azure using my current subscription in eastus2 region.",
            nonInteractive: true,
            followUp,
            shouldEarlyTerminate: (agentMetadata) => shouldEarlyTerminateForSkillInvocation(agentMetadata, SKILL_NAME)
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invocationCount += 1;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    });

    // --- Deploy integration test prompts (Container Apps) ---
    test("invokes azure-prepare skill for containerized web app Container Apps deploy prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "Create a containerized web application and deploy to Azure Container Apps using my current subscription in eastus2 region.",
            nonInteractive: true,
            followUp,
            shouldEarlyTerminate: (agentMetadata) => shouldEarlyTerminateForSkillInvocation(agentMetadata, SKILL_NAME)
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invocationCount += 1;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    });

    test("invokes azure-prepare skill for Node.js Container Apps deploy prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "Create a simple containerized Node.js hello world app and deploy to Azure Container Apps using my current subscription in eastus2 region.",
            nonInteractive: true,
            followUp,
            shouldEarlyTerminate: (agentMetadata) => shouldEarlyTerminateForSkillInvocation(agentMetadata, SKILL_NAME)
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invocationCount += 1;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    });

    // --- Deploy integration test prompts (Terraform SWA) ---
    test("invokes azure-prepare skill for static whiteboard Terraform deploy prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "Create a static whiteboard web app and deploy to Azure using Terraform infrastructure in my current subscription in eastus2 region.",
            nonInteractive: true,
            followUp,
            shouldEarlyTerminate: (agentMetadata) => shouldEarlyTerminateForSkillInvocation(agentMetadata, SKILL_NAME)
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invocationCount += 1;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    });

    test("invokes azure-prepare skill for static portfolio Terraform deploy prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "Create a static portfolio website and deploy to Azure using Terraform infrastructure in my current subscription in eastus2 region.",
            nonInteractive: true,
            followUp,
            shouldEarlyTerminate: (agentMetadata) => shouldEarlyTerminateForSkillInvocation(agentMetadata, SKILL_NAME)
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invocationCount += 1;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    });

    // --- Deploy integration test prompts (Terraform App Service) ---
    test("invokes azure-prepare skill for discussion board Terraform App Service deploy prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "Create a discussion board application and deploy to Azure App Service using Terraform infrastructure in my current subscription in eastus2 region.",
            nonInteractive: true,
            followUp,
            shouldEarlyTerminate: (agentMetadata) => shouldEarlyTerminateForSkillInvocation(agentMetadata, SKILL_NAME)
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invocationCount += 1;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    });

    test("invokes azure-prepare skill for todo list Terraform App Service deploy prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "Create a todo list with frontend and API and deploy to Azure App Service using Terraform infrastructure in my current subscription in eastus2 region.",
            nonInteractive: true,
            followUp,
            shouldEarlyTerminate: (agentMetadata) => shouldEarlyTerminateForSkillInvocation(agentMetadata, SKILL_NAME)
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invocationCount += 1;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    });

    // --- Deploy integration test prompts (Terraform Azure Functions) ---
    test("invokes azure-prepare skill for serverless HTTP API Terraform Functions deploy prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "Create a serverless HTTP API using Azure Functions and deploy to Azure using Terraform infrastructure in my current subscription in eastus2 region.",
            nonInteractive: true,
            followUp,
            shouldEarlyTerminate: (agentMetadata) => shouldEarlyTerminateForSkillInvocation(agentMetadata, SKILL_NAME)
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invocationCount += 1;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    });

    test("invokes azure-prepare skill for event-driven function app Terraform deploy prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "Create an event-driven function app to process messages and deploy to Azure Functions using Terraform infrastructure in my current subscription in eastus2 region.",
            nonInteractive: true,
            followUp,
            shouldEarlyTerminate: (agentMetadata) => shouldEarlyTerminateForSkillInvocation(agentMetadata, SKILL_NAME)
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invocationCount += 1;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    });

    test("invokes azure-prepare skill for URL shortener Terraform Functions deploy prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "Create a URL shortener service using Azure Functions that creates short links and redirects users to the original URL and deploy to Azure using Terraform infrastructure in my current subscription in eastus2 region.",
            nonInteractive: true,
            followUp,
            shouldEarlyTerminate: (agentMetadata) => shouldEarlyTerminateForSkillInvocation(agentMetadata, SKILL_NAME)
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invocationCount += 1;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    });

    // --- Deploy integration test prompts (Terraform Container Apps) ---
    test("invokes azure-prepare skill for containerized web app Terraform Container Apps deploy prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "Create a containerized web application and deploy to Azure Container Apps using Terraform infrastructure in my current subscription in eastus2 region.",
            nonInteractive: true,
            followUp,
            shouldEarlyTerminate: (agentMetadata) => shouldEarlyTerminateForSkillInvocation(agentMetadata, SKILL_NAME)
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invocationCount += 1;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    });

    test("invokes azure-prepare skill for Node.js Terraform Container Apps deploy prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "Create a simple containerized Node.js hello world app and deploy to Azure Container Apps using Terraform infrastructure in my current subscription in eastus2 region.",
            nonInteractive: true,
            followUp,
            shouldEarlyTerminate: (agentMetadata) => shouldEarlyTerminateForSkillInvocation(agentMetadata, SKILL_NAME)
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invocationCount += 1;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    });

    test("invokes azure-prepare skill for social media app Terraform deploy prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "Create a simple social media application with likes and comments and deploy to Azure using Terraform infrastructure in my current subscription in eastus2 region.",
            nonInteractive: true,
            followUp,
            shouldEarlyTerminate: (agentMetadata) => shouldEarlyTerminateForSkillInvocation(agentMetadata, SKILL_NAME)
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invocationCount += 1;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    });

    test("invokes azure-prepare skill for APIM deployment prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "Deploy a new Azure API Management instance for my application",
            nonInteractive: true,
            followUp,
            shouldEarlyTerminate: (agentMetadata) => shouldEarlyTerminateForSkillInvocation(agentMetadata, SKILL_NAME)
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invocationCount += 1;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    });
  });

  describe("prepare-deployment", () => {
    test("creates project files for static whiteboard web app before validation", async () => {
      await withTestResult(async () => {
        let workspacePath: string | undefined;

        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
          },
          prompt: "Create a static whiteboard web app and deploy to Azure.",
          nonInteractive: true,
          followUp: FOLLOW_UP_PROMPT,
          systemPrompt: SKIP_QUOTA_CHECK_PROMPT,
          preserveWorkspace: true,
          shouldEarlyTerminate: (metadata) =>
            hasPlanReadyForValidation(metadata) || hasValidationCommand(metadata) || isSkillInvoked(metadata, "azure-validate"),
        });

        expect(workspacePath).toBeDefined();
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
        const planReady = hasPlanReadyForValidation(agentMetadata);
        expect(planReady).toBe(true);
      });
    });

    test("creates correct files for AZD with Bicep recipe", async () => {
      await withTestResult(async () => {
        let workspacePath: string | undefined;

        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
          },
          prompt: "Create a simple todo web app and deploy to Azure.",
          nonInteractive: true,
          followUp: FOLLOW_UP_PROMPT,
          systemPrompt: SKIP_QUOTA_CHECK_PROMPT,
          preserveWorkspace: true,
          shouldEarlyTerminate: (metadata) =>
            hasPlanReadyForValidation(metadata) || hasValidationCommand(metadata) || isSkillInvoked(metadata, "azure-validate"),
        });

        expect(workspacePath).toBeDefined();
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
        expectFiles(workspacePath!,
          [/deployment-plan\.md$/, /azure\.yaml$/, /infra\/.*\.bicep$/],
          [/\.tf$/],
        );
      });
    });

    test("creates correct files for Terraform recipe", async () => {
      await withTestResult(async () => {
        let workspacePath: string | undefined;

        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
          },
          prompt: "Create a simple todo web app and deploy to Azure with Terraform as the infrastructure provider.",
          nonInteractive: true,
          followUp: FOLLOW_UP_PROMPT,
          systemPrompt: SKIP_QUOTA_CHECK_PROMPT,
          preserveWorkspace: true,
          shouldEarlyTerminate: (metadata) =>
            hasPlanReadyForValidation(metadata) || hasValidationCommand(metadata) || isSkillInvoked(metadata, "azure-validate"),
        });

        expect(workspacePath).toBeDefined();
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
        expectFiles(workspacePath!,
          [/deployment-plan\.md$/, /infra\/.*\.tf$/],
          [/\.bicep$/],
        );
      });
    });

    test("creates correct files for standalone Bicep recipe", async () => {
      await withTestResult(async () => {
        let workspacePath: string | undefined;

        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
          },
          prompt: "Create a simple todo web app and deploy to Azure using standalone Bicep templates.",
          nonInteractive: true,
          followUp: FOLLOW_UP_PROMPT,
          systemPrompt: SKIP_QUOTA_CHECK_PROMPT,
          preserveWorkspace: true,
          shouldEarlyTerminate: (metadata) =>
            hasValidationCommand(metadata) || isSkillInvoked(metadata, "azure-validate"),
        });

        expect(workspacePath).toBeDefined();
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
        expectFiles(workspacePath!,
          [/deployment-plan\.md$/, /infra\/.*\.bicep$/, /infra\/(.*\.bicepparam|(.*\.)?parameters\.json)$/],
          [/azure\.yaml$/, /\.tf$/],
        );
      });
    });
  });

  describe("aspire-brownfield", () => {
    const ASPIRE_SAMPLES_REPO = "https://github.com/dotnet/aspire-samples.git";

    test("generates azure.yaml with services section for Aspire projects", async () => {
      await withTestResult(async () => {
        const ASPIRE_FUNCTIONS_SPARSE_PATH = "samples/aspire-with-azure-functions";
        let workspacePath: string | undefined;

        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
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
            "Use standard SKUs. " +
            `The app can be found under ${ASPIRE_FUNCTIONS_SPARSE_PATH}.`,
          nonInteractive: true,
          followUp: FOLLOW_UP_PROMPT,
          preserveWorkspace: true,
          shouldEarlyTerminate: (metadata) =>
            hasPlanReadyForValidation(metadata) || hasValidationCommand(metadata) || isSkillInvoked(metadata, "azure-validate"),
        });

        expect(workspacePath).toBeDefined();
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        // Verify azure.yaml exists
        expectFiles(workspacePath!, [/azure\.yaml$/], []);

        // CRITICAL: Verify azure.yaml has services section (not just name + metadata)
        // This is the main issue - manual creation omits services section
        expect(hasServicesSection(workspacePath!)).toBe(true);

        // Verify the service references the AppHost project
        // The AppHost project is ImageGallery.AppHost/ImageGallery.AppHost.csproj
        const serviceProject = getServiceProject(workspacePath!, "app");
        expect(serviceProject).toBeDefined();
        expect(serviceProject).toMatch(/AppHost\.csproj/);
      });
    });

    test("sets correct docker context for Aspire container-build sample", async () => {
      await withTestResult(async () => {
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
            "Use standard SKUs. " +
            `The app can be found under ${CONTAINER_BUILD_SPARSE_PATH}.`,
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
  });

  describe("entra-sql-auth", () => {
    test("generates Entra-only SQL auth for ASP.NET Core EF Core app (not SQL admin password)", async () => {
      await withTestResult(async () => {
        const agentMetadata = await agent.run({
          prompt:
            "Create an ASP.NET Core 8 web API with a Todo model using Entity Framework Core and SQL Server. " +
            "Then prepare it for Azure deployment. " +
            "Use the eastus2 region and my current subscription.",
          nonInteractive: true,
          followUp: FOLLOW_UP_PROMPT,
          systemPrompt: SKIP_QUOTA_CHECK_PROMPT,
          shouldEarlyTerminate: (metadata) =>
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

  describe("durable-task-scheduler", () => {
    test("generates Durable Task Scheduler infrastructure and workflow code for a workflow app", async () => {
      await withTestResult(async () => {
        let workspacePath: string | undefined;

        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
          },
          prompt:
            "Prepare the Azure deployment infrastructure for a new workflow app " +
            "that will orchestrate a multi-step order processing pipeline. " +
            "Generate the Bicep templates, RBAC assignments, and azure.yaml. " +
            "Use the eastus2 region and my current subscription.",
          nonInteractive: true,
          followUp: FOLLOW_UP_PROMPT,
          preserveWorkspace: true,
          shouldEarlyTerminate: (metadata) =>
            hasPlanReadyForValidation(metadata) || hasValidationCommand(metadata) || isSkillInvoked(metadata, "azure-validate"),
        });

        // Preconditions
        expect(workspacePath).toBeDefined();
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        // Read Bicep file contents from the workspace filesystem.
        // The agent may create files via the `create` tool or bash heredocs,
        // so reading from disk is more reliable than inspecting tool calls.
        const allFiles = listFilesRecursive(workspacePath!);
        const bicepFiles = allFiles.filter(f => f.endsWith(".bicep"));
        const bicepContent = bicepFiles.map(f => fs.readFileSync(f, "utf-8")).join("\n");
        expect(bicepContent.length).toBeGreaterThan(0);

        // Must provision a Durable Task Scheduler resource
        expect(/Microsoft\.DurableTask\/schedulers/i.test(bicepContent)).toBe(true);

        // Must provision a task hub child resource
        expect(/Microsoft\.DurableTask\/schedulers\/taskHubs/i.test(bicepContent)).toBe(true);

        // Must assign the Durable Task Data Contributor RBAC role (role ID: 0ad04412-c4d5-4796-b79c-f76d14c8d402)
        expect(/0ad04412-c4d5-4796-b79c-f76d14c8d402/i.test(bicepContent)).toBe(true);

        // Must include the scheduler connection string app setting
        expect(doesWorkspaceFileIncludePattern(workspacePath!, /DURABLE_TASK_SCHEDULER_CONNECTION_STRING/i)).toBe(true);

        // Must include ipAllowlist to avoid 403 errors (empty list denies all traffic)
        expect(/ipAllowlist/i.test(bicepContent)).toBe(true);

        // Workspace should contain orchestration/workflow code files
        expectFiles(workspacePath!,
          [/deployment-plan\.md$/, /azure\.yaml$/, /infra\/.*\.bicep$/],
          [/\.tf$/],
        );
      });
    });
  });
});
