/**
 * Integration Tests for microsoft-foundry
 * 
 * Tests skill behavior with a real Copilot agent session.
 * Runs prompts multiple times to measure skill invocation rate.
 * 
 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 */

import { randomUUID } from "crypto";
import {
  useAgentRunner,
  isSkillInvoked,
  shouldSkipIntegrationTests,
  getIntegrationSkipReason,
  doesAssistantMessageIncludeKeyword,
  areToolCallsSuccess,
} from "../utils/agent-runner";
import * as fs from "fs";
import { AIProjectClient } from "@azure/ai-projects";
import { DefaultAzureCredential } from "@azure/identity";

const SKILL_NAME = "microsoft-foundry";
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

describeIntegration(`${SKILL_NAME} - Integration Tests`, () => {
  const agent = useAgentRunner();

  describe("skill-invocation", () => {
    test("invokes microsoft-foundry skill for AI model deployment prompt", async () => {
      let successCount = 0;

      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "How do I deploy an AI model from the Microsoft Foundry catalog?"
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
      console.log(`${SKILL_NAME} invocation rate for model deployment prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`);
      fs.appendFileSync(`./result-${SKILL_NAME}.txt`, `${SKILL_NAME} invocation rate for model deployment prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`);
      expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    });

    test("invokes microsoft-foundry skill for RAG application prompt", async () => {
      let successCount = 0;

      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Build a RAG application with Microsoft Foundry using knowledge indexes"
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
      console.log(`${SKILL_NAME} invocation rate for RAG application prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`);
      fs.appendFileSync(`./result-${SKILL_NAME}.txt`, `${SKILL_NAME} invocation rate for RAG application prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`);
      expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    });

    test("invokes microsoft-foundry skill for RBAC role assignment prompt", async () => {
      let successCount = 0;

      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Grant a user the Azure AI User role on my Foundry project"
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
      console.log(`${SKILL_NAME} invocation rate for RBAC role assignment prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`);
      fs.appendFileSync(`./result-${SKILL_NAME}.txt`, `${SKILL_NAME} invocation rate for RBAC role assignment prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`);
      expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    });

    test("invokes microsoft-foundry skill for service principal CI/CD prompt", async () => {
      let successCount = 0;

      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Create a service principal for my Foundry CI/CD pipeline"
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
      console.log(`${SKILL_NAME} invocation rate for service principal CI/CD prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`);
      fs.appendFileSync(`./result-${SKILL_NAME}.txt`, `${SKILL_NAME} invocation rate for service principal CI/CD prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`);
      expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    });

    test("invokes microsoft-foundry skill for managed identity roles prompt", async () => {
      let successCount = 0;

      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Set up managed identity roles for my Foundry project to access Azure Storage"
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
      console.log(`${SKILL_NAME} invocation rate for managed identity roles prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`);
      fs.appendFileSync(`./result-${SKILL_NAME}.txt`, `${SKILL_NAME} invocation rate for managed identity roles prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`);
      expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    });

    test("invokes microsoft-foundry skill for audit role assignments prompt", async () => {
      let successCount = 0;

      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Who has access to my Foundry project? List all role assignments"
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
      console.log(`${SKILL_NAME} invocation rate for audit role assignments prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`);
      fs.appendFileSync(`./result-${SKILL_NAME}.txt`, `${SKILL_NAME} invocation rate for audit role assignments prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`);
      expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    });

    test("invokes microsoft-foundry skill for developer permissions prompt", async () => {
      let successCount = 0;

      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Make Bob a project manager in my Azure AI Foundry"
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
      console.log(`${SKILL_NAME} invocation rate for developer permissions prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`);
      fs.appendFileSync(`./result-${SKILL_NAME}.txt`, `${SKILL_NAME} invocation rate for developer permissions prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`);
      expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    });

    test("invokes microsoft-foundry skill for validate permissions prompt", async () => {
      let successCount = 0;

      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Can I deploy models to my Foundry project? Check my permissions"
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
      console.log(`${SKILL_NAME} invocation rate for validate permissions prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`);
      fs.appendFileSync(`./result-${SKILL_NAME}.txt`, `${SKILL_NAME} invocation rate for validate permissions prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`);
      expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    });
  });

  test("returns v1 model identifier for a given model", async () => {
    const projectEndpoint = process.env.FOUNDRY_PROJECT_ENDPOINT;
    if (!projectEndpoint) {
      console.log("Environment variable FOUNDRY_PROJECT_ENDPOINT not defined. Skipping test.");
      return;
    }

    // Foundry assigns a unique identifier to each model, which must be used when calling Foundry APIs.
    // However, users may refer to a model in various ways (e.g. GPT 5, gpt-5, GPT-5, GPT5, etc.)
    // The agent can list the models to help the user find the unique identifier for a model.
    const agentMetadata = await agent.run({
      systemPrompt: {
        mode: "append",
        content: `Use ${projectEndpoint} as the project endpoint when calling Foundry tools.`
      },
      prompt: "What's the official name of GPT 5 in Foundry?",
      nonInteractive: true
    });

    const areFoundryToolCallsSuccess = areToolCallsSuccess(agentMetadata, "azure-foundry");
    const isCorrectModelNameInResponse = doesAssistantMessageIncludeKeyword(agentMetadata, "gpt-5", { caseSensitive: true });
    expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
    expect(areFoundryToolCallsSuccess).toBe(true);
    expect(isCorrectModelNameInResponse).toBe(true);
  });

  test("successfully creates a v1 agent in Foundry", async () => {
    const projectEndpoint = process.env.FOUNDRY_PROJECT_ENDPOINT;
    if (!projectEndpoint) {
      console.log("Environment variable FOUNDRY_PROJECT_ENDPOINT not defined. Skipping test.");
      return;
    }

    const agentNameSuffix = randomUUID().substring(0, 4);
    const agentName = `onboarding-buddy-${agentNameSuffix}`;
    const projectClient = new AIProjectClient(projectEndpoint, new DefaultAzureCredential());

    const _agentMetadata = await agent.run({
      prompt: `Create a Foundry agent called "${agentName}" in my foundry project ${projectEndpoint}, use gpt-4o as the model, and give it a generic system instruction suitable for onboarding a new team member in a professional environment for now.`,
      nonInteractive: true
    });

    // Verify if the agent is created in the Foundry project
    const agentsIter = projectClient.agents.listAgents();

    // The agentId of the created agent
    let targetAgentId: string | undefined = undefined;
    for await (const agent of agentsIter) {
      console.log("Found agent", agent.name)
      if (agent.name === agentName) {
        targetAgentId = agent.id;
      }
    }
    expect(targetAgentId).not.toBe(undefined);
    await projectClient.agents.deleteAgent(targetAgentId!);
  });

  describe("Quota - View Quota Usage", () => {
    test("invokes skill for quota usage check", async () => {
      const agentMetadata = await agent.run({
        prompt: "Show me my current quota usage for Microsoft Foundry resources"
      });

      const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
      expect(isSkillUsed).toBe(true);
    });

    test("response includes quota-related commands", async () => {
      const agentMetadata = await agent.run({
        prompt: "How do I check my Azure AI Foundry quota limits?"
      });

      const hasQuotaCommand = doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "az cognitiveservices usage"
      );
      expect(hasQuotaCommand).toBe(true);
    });

    test("response mentions TPM (Tokens Per Minute)", async () => {
      const agentMetadata = await agent.run({
        prompt: "Explain quota in Microsoft Foundry"
      });

      const mentionsTPM = doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "TPM"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "Tokens Per Minute"
      );
      expect(mentionsTPM).toBe(true);
    });
  });

  describe("Quota - Before Deployment", () => {
    test("provides guidance on checking quota before deployment", async () => {
      const agentMetadata = await agent.run({
        prompt: "Do I have enough quota to deploy GPT-4o to Microsoft Foundry?"
      });

      const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
      expect(isSkillUsed).toBe(true);

      const hasGuidance = doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "capacity"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "quota"
      );
      expect(hasGuidance).toBe(true);
    });

    test("suggests capacity calculation", async () => {
      const agentMetadata = await agent.run({
        prompt: "How much quota do I need for a production Foundry deployment?"
      });

      const hasCalculation = doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "calculate"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "estimate"
      );
      expect(hasCalculation).toBe(true);
    });
  });

  describe("Quota - Request Quota Increase", () => {
    test("explains quota increase process", async () => {
      const agentMetadata = await agent.run({
        prompt: "How do I request a quota increase for Microsoft Foundry?"
      });

      const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
      expect(isSkillUsed).toBe(true);

      const mentionsPortal = doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "Azure Portal"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "portal"
      );
      expect(mentionsPortal).toBe(true);
    });

    test("mentions business justification", async () => {
      const agentMetadata = await agent.run({
        prompt: "Request more TPM quota for Azure AI Foundry"
      });

      const mentionsJustification = doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "justification"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "business"
      );
      expect(mentionsJustification).toBe(true);
    });
  });

  describe("Quota - Monitor Across Deployments", () => {
    test("provides monitoring commands", async () => {
      const agentMetadata = await agent.run({
        prompt: "Monitor quota usage across all my Microsoft Foundry deployments"
      });

      const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
      expect(isSkillUsed).toBe(true);

      const hasMonitoring = doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "deployment list"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "usage list"
      );
      expect(hasMonitoring).toBe(true);
    });

    test("explains capacity by model tracking", async () => {
      const agentMetadata = await agent.run({
        prompt: "Show me quota allocation by model in Azure AI Foundry"
      });

      const hasModelTracking = doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "model"
      ) && doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "capacity"
      );
      expect(hasModelTracking).toBe(true);
    });
  });

  describe("Quota - Troubleshoot Quota Errors", () => {
    test("troubleshoots QuotaExceeded error", async () => {
      const agentMetadata = await agent.run({
        prompt: "My Microsoft Foundry deployment failed with QuotaExceeded error. Help me fix it."
      });

      const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
      expect(isSkillUsed).toBe(true);

      const hasTroubleshooting = doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "QuotaExceeded"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "quota"
      );
      expect(hasTroubleshooting).toBe(true);
    });

    test("troubleshoots InsufficientQuota error", async () => {
      const agentMetadata = await agent.run({
        prompt: "Getting InsufficientQuota error when deploying to Azure AI Foundry"
      });

      const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
      expect(isSkillUsed).toBe(true);
    });

    test("troubleshoots DeploymentLimitReached error", async () => {
      const agentMetadata = await agent.run({
        prompt: "DeploymentLimitReached error in Microsoft Foundry, what should I do?"
      });

      const providesResolution = doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "delete"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "deployment"
      );
      expect(providesResolution).toBe(true);
    });

    test("addresses 429 rate limit errors", async () => {
      const agentMetadata = await agent.run({
        prompt: "Getting 429 rate limit errors from my Foundry deployment"
      });

      const addresses429 = doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "429"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "rate limit"
      );
      expect(addresses429).toBe(true);
    });
  });

  describe("Quota - Capacity Planning", () => {
    test("helps with production capacity planning", async () => {
      const agentMetadata = await agent.run({
        prompt: "Help me plan capacity for production Microsoft Foundry deployment with 1M requests per day"
      });

      const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
      expect(isSkillUsed).toBe(true);

      const hasPlanning = doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "calculate"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "TPM"
      );
      expect(hasPlanning).toBe(true);
    });

    test("provides best practices", async () => {
      const agentMetadata = await agent.run({
        prompt: "What are best practices for quota management in Azure AI Foundry?"
      });

      const hasBestPractices = doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "best practice"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "optimize"
      );
      expect(hasBestPractices).toBe(true);
    });
  });

  describe("Quota - MCP Tool Integration", () => {
    test("suggests foundry MCP tools when available", async () => {
      const agentMetadata = await agent.run({
        prompt: "List all my Microsoft Foundry model deployments and their capacity"
      });

      const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
      expect(isSkillUsed).toBe(true);

      // May use foundry_models_deployments_list or az CLI
      const usesTools = doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "foundry_models"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "az cognitiveservices"
      );
      expect(usesTools).toBe(true);
    });
  });

  describe("Quota - Regional Capacity", () => {
    test("explains regional quota distribution", async () => {
      const agentMetadata = await agent.run({
        prompt: "How does quota work across different Azure regions for Foundry?"
      });

      const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
      expect(isSkillUsed).toBe(true);

      const mentionsRegion = doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "region"
      );
      expect(mentionsRegion).toBe(true);
    });

    test("suggests deploying to different region when quota exhausted", async () => {
      const agentMetadata = await agent.run({
        prompt: "I ran out of quota in East US for Microsoft Foundry. What are my options?"
      });

      const suggestsRegion = doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "region"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "location"
      );
      expect(suggestsRegion).toBe(true);
    });
  });

  describe("Quota - Optimization", () => {
    test("provides optimization guidance", async () => {
      const agentMetadata = await agent.run({
        prompt: "How can I optimize my Microsoft Foundry quota allocation?"
      });

      const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
      expect(isSkillUsed).toBe(true);

      const hasOptimization = doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "optimize"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "consolidate"
      );
      expect(hasOptimization).toBe(true);
    });

    test("suggests deleting unused deployments", async () => {
      const agentMetadata = await agent.run({
        prompt: "I need to free up quota in Azure AI Foundry"
      });

      const suggestsDelete = doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "delete"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "unused"
      );
      expect(suggestsDelete).toBe(true);
    });
  });

  describe("Quota - Command Output Explanation", () => {
    test("explains how to interpret quota usage output", async () => {
      const agentMetadata = await agent.run({
        prompt: "What does the quota usage output mean in Microsoft Foundry?"
      });

      const hasExplanation = doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "currentValue"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "limit"
      );
      expect(hasExplanation).toBe(true);
    });

    test("explains TPM concept", async () => {
      const agentMetadata = await agent.run({
        prompt: "What is TPM in the context of Microsoft Foundry quotas?"
      });

      const explainTPM = doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "Tokens Per Minute"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "TPM"
      );
      expect(explainTPM).toBe(true);
    });
  });

  describe("Quota - Error Resolution Steps", () => {
    test("provides step-by-step resolution for quota errors", async () => {
      const agentMetadata = await agent.run({
        prompt: "Walk me through fixing a quota error in Microsoft Foundry deployment"
      });

      const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
      expect(isSkillUsed).toBe(true);

      const hasSteps = doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "step"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "check"
      );
      expect(hasSteps).toBe(true);
    });

    test("offers multiple resolution options", async () => {
      const agentMetadata = await agent.run({
        prompt: "What are my options when I hit quota limits in Azure AI Foundry?"
      });

      const hasOptions = doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "option"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "reduce"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "increase"
      );
      expect(hasOptions).toBe(true);
    });
  });

});
