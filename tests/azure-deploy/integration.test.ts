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
  hasDeployLinks,
  useAgentRunner
} from "../utils/agent-runner";
import * as fs from "fs";

const SKILL_NAME = "azure-deploy";
const RUNS_PER_PROMPT = 5;
const EXPECTED_INVOCATION_RATE = 0.6; // 60% minimum invocation rate

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
    test("creates whiteboard application and deploys to Azure", async () => {
      const agentMetadata = await agent.run({
        prompt: "Create a static whiteboard web app and deploy to Azure using my current subscription in eastus2 region.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT
      });

      const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
      const isValidateInvoked = isSkillInvoked(agentMetadata, "azure-validate");
      const isPrepareInvoked = isSkillInvoked(agentMetadata, "azure-prepare");
      const containsDeployLinks = hasDeployLinks(agentMetadata);

      expect(isSkillUsed).toBe(true);
      expect(isValidateInvoked).toBe(true);
      expect(isPrepareInvoked).toBe(true);
      expect(containsDeployLinks).toBe(true);
    }, deployTestTimeoutMs);

    test("creates static portfolio website and deploys to Azure", async () => {
      const agentMetadata = await agent.run({
        prompt: "Create a static portfolio website and deploy to Azure using my current subscription in eastus2 region.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT
      });

      const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
      const isValidateInvoked = isSkillInvoked(agentMetadata, "azure-validate");
      const isPrepareInvoked = isSkillInvoked(agentMetadata, "azure-prepare");
      const containsDeployLinks = hasDeployLinks(agentMetadata);

      expect(isSkillUsed).toBe(true);
      expect(isValidateInvoked).toBe(true);
      expect(isPrepareInvoked).toBe(true);
      expect(containsDeployLinks).toBe(true);
    }, deployTestTimeoutMs);
  });

  // App Service
  describe("app-service-deploy", () => {
    test("creates discussion board and deploys to Azure", async () => {
      const agentMetadata = await agent.run({
        prompt: "Create a discussion board application and deploy to Azure App Service using my current subscription in eastus2 region.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT
      });

      const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
      const isValidateInvoked = isSkillInvoked(agentMetadata, "azure-validate");
      const isPrepareInvoked = isSkillInvoked(agentMetadata, "azure-prepare");
      const containsDeployLinks = hasDeployLinks(agentMetadata);

      expect(isSkillUsed).toBe(true);
      expect(isValidateInvoked).toBe(true);
      expect(isPrepareInvoked).toBe(true);
      expect(containsDeployLinks).toBe(true);
    }, deployTestTimeoutMs);

    test("creates todo list with frontend and API and deploys to Azure", async () => {
      const agentMetadata = await agent.run({
        prompt: "Create a todo list with frontend and API and deploy to Azure App Service using my current subscription in eastus2 region.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT
      });

      const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
      const isValidateInvoked = isSkillInvoked(agentMetadata, "azure-validate");
      const isPrepareInvoked = isSkillInvoked(agentMetadata, "azure-prepare");
      const containsDeployLinks = hasDeployLinks(agentMetadata);

      expect(isSkillUsed).toBe(true);
      expect(isValidateInvoked).toBe(true);
      expect(isPrepareInvoked).toBe(true);
      expect(containsDeployLinks).toBe(true);
    }, deployTestTimeoutMs);
  });

  // Azure Functions
  describe("azure-functions-deploy", () => {
    test("creates serverless HTTP API and deploys to Azure Functions", async () => {
      const agentMetadata = await agent.run({
        prompt: "Create a serverless HTTP API using Azure Functions and deploy to Azure using my current subscription in eastus2 region.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT
      });

      const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
      const isValidateInvoked = isSkillInvoked(agentMetadata, "azure-validate");
      const isPrepareInvoked = isSkillInvoked(agentMetadata, "azure-prepare");
      const containsDeployLinks = hasDeployLinks(agentMetadata);

      expect(isSkillUsed).toBe(true);
      expect(isValidateInvoked).toBe(true);
      expect(isPrepareInvoked).toBe(true);
      expect(containsDeployLinks).toBe(true);
    }, deployTestTimeoutMs);

    test("creates event-driven function app and deploys to Azure Functions", async () => {
      const agentMetadata = await agent.run({
        prompt: "Create an event-driven function app to process messages and deploy to Azure Functions using my current subscription in eastus2 region.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT
      });

      const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
      const isValidateInvoked = isSkillInvoked(agentMetadata, "azure-validate");
      const isPrepareInvoked = isSkillInvoked(agentMetadata, "azure-prepare");
      const containsDeployLinks = hasDeployLinks(agentMetadata);

      expect(isSkillUsed).toBe(true);
      expect(isValidateInvoked).toBe(true);
      expect(isPrepareInvoked).toBe(true);
      expect(containsDeployLinks).toBe(true);
    }, deployTestTimeoutMs);
  });

  // Azure Container Apps (ACA)
  describe("azure-container-apps-deploy", () => {
    test("creates containerized web application and deploys to Azure Container Apps", async () => {
      const agentMetadata = await agent.run({
        prompt: "Create a containerized web application and deploy to Azure Container Apps using my current subscription in eastus2 region.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT
      });

      const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
      const isValidateInvoked = isSkillInvoked(agentMetadata, "azure-validate");
      const isPrepareInvoked = isSkillInvoked(agentMetadata, "azure-prepare");
      const containsDeployLinks = hasDeployLinks(agentMetadata);

      expect(isSkillUsed).toBe(true);
      expect(isValidateInvoked).toBe(true);
      expect(isPrepareInvoked).toBe(true);
      expect(containsDeployLinks).toBe(true);
    }, deployTestTimeoutMs);

    test("creates simple containerized Node.js app and deploys to Azure Container Apps", async () => {
      const agentMetadata = await agent.run({
        prompt: "Create a simple containerized Node.js hello world app and deploy to Azure Container Apps using my current subscription in eastus2 region.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT
      });

      const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
      const isValidateInvoked = isSkillInvoked(agentMetadata, "azure-validate");
      const isPrepareInvoked = isSkillInvoked(agentMetadata, "azure-prepare");
      const containsDeployLinks = hasDeployLinks(agentMetadata);

      expect(isSkillUsed).toBe(true);
      expect(isValidateInvoked).toBe(true);
      expect(isPrepareInvoked).toBe(true);
      expect(containsDeployLinks).toBe(true);
    }, deployTestTimeoutMs);
  });
});
