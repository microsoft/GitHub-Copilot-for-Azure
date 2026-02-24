/**
 * Integration Tests for microsoft-foundry-quota
 *
 * Tests skill behavior with a real Copilot agent session for quota management.
 * These tests require Copilot CLI to be installed and authenticated.
 *
 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 * 3. Have an Azure subscription with Microsoft Foundry resources
 *
 * Run with: npm run test:integration -- --testPathPattern=microsoft-foundry-quota
 */

import {
  useAgentRunner,
  isSkillInvoked,
  doesAssistantMessageIncludeKeyword,
  shouldSkipIntegrationTests
} from "../../utils/agent-runner";

const SKILL_NAME = "microsoft-foundry";

// Use centralized skip logic from agent-runner
const describeIntegration = shouldSkipIntegrationTests() ? describe.skip : describe;

describeIntegration("microsoft-foundry-quota - Integration Tests", () => {
  const agent = useAgentRunner();

  describe("View Quota Usage", () => {
    test("invokes skill for quota usage check", async () => {
      const agentMetadata = await agent.run({
        prompt: "Use the microsoft-foundry skill to show me my current quota usage for Microsoft Foundry resources"
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
        "az cognitiveservices"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "az rest"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "quota"
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

  describe("Quota Before Deployment", () => {
    test("provides guidance on checking quota before deployment", async () => {
      const agentMetadata = await agent.run({
        prompt: "Use the microsoft-foundry skill to check if I have enough quota to deploy GPT-4o to Microsoft Foundry"
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

  describe("Request Quota Increase", () => {
    test("explains quota increase process", async () => {
      const agentMetadata = await agent.run({
        prompt: "Using the microsoft-foundry quota skill, how do I request a quota increase for Microsoft Foundry?"
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

  describe("Monitor Quota Across Deployments", () => {
    test("provides monitoring commands", async () => {
      const agentMetadata = await agent.run({
        prompt: "Use the microsoft-foundry quota skill to monitor quota usage across all my Microsoft Foundry deployments"
      });

      const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
      expect(isSkillUsed).toBe(true);

      const hasMonitoring = doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "deployment"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "usage"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "quota"
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

  describe("Troubleshoot Quota Errors", () => {
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
        prompt: "I'm getting an InsufficientQuota error when deploying gpt-4o to eastus in Azure AI Foundry. Use the microsoft-foundry skill to help me troubleshoot and fix this."
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

  describe("Capacity Planning", () => {
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

  describe("MCP Tool Integration", () => {
    test("suggests foundry MCP tools when available", async () => {
      const agentMetadata = await agent.run({
        prompt: "Use the microsoft-foundry skill to list all my Microsoft Foundry model deployments and their capacity"
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

  describe("Regional Capacity", () => {
    test("explains regional quota distribution", async () => {
      const agentMetadata = await agent.run({
        prompt: "Using the microsoft-foundry quota skill, explain how quota works across different Azure regions for Foundry"
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

  describe("Quota Optimization", () => {
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

  describe("Command Output Explanation", () => {
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

  describe("Error Resolution Steps", () => {
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
