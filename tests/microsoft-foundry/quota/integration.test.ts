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
 * Run with: npm run test:integration -- --testPathPatterns=microsoft-foundry-quota
 */

import {
  useAgentRunner,
  doesAssistantMessageIncludeKeyword,
  shouldSkipIntegrationTests
} from "../../utils/agent-runner";
import {
  isSkillInvoked,
  matchesCommand,
  withTestResult,
  doesAssistantOrToolsIncludeKeyword,
  softCheckSkill
} from "../../utils/evaluate";

const SKILL_NAME = "microsoft-foundry";

// Use centralized skip logic from agent-runner
const describeIntegration = shouldSkipIntegrationTests() ? describe.skip : describe;

describeIntegration(`${SKILL_NAME}_quota - Integration Tests`, () => {
  const agent = useAgentRunner();

  describe("View Quota Usage", () => {
    test("invokes skill for quota usage check", () => withTestResult(async () => {
      const agentMetadata = await agent.run({
        prompt: "Use the microsoft-foundry skill to show me my current quota usage for Microsoft Foundry resources"
      });

      const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
      expect(isSkillUsed).toBe(true);
    }));

    test("response includes quota-related commands", () => withTestResult(async () => {
      const agentMetadata = await agent.run({
        prompt: "How do I check my Azure AI Foundry quota limits?"
      });

      const hasQuotaCommand = doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "az cognitiveservices"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "quota"
      );
      expect(hasQuotaCommand).toBe(true);
    }));

    test("response mentions TPM (Tokens Per Minute)", () => withTestResult(async () => {
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
    }));
  });

  describe("Quota Before Deployment", () => {
    test("provides guidance on checking quota before deployment", () => withTestResult(async () => {
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
    }));

    test("suggests capacity calculation", () => withTestResult(async () => {
      const agentMetadata = await agent.run({
        prompt: "How much quota do I need for a production Foundry deployment?"
      });

      // Require at least one quota-specific term
      const hasQuotaTerm = doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "TPM"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "PTU"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "capacity"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "tokens per minute"
      );

      // Require at least one calculation verb
      const hasCalculationVerb = doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "calculate"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "estimate"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "calculation"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "quantify"
      );

      expect(hasQuotaTerm && hasCalculationVerb).toBe(true);
    }));
  });

  describe("Request Quota Increase", () => {
    test("explains quota increase process", () => withTestResult(async () => {
      const agentMetadata = await agent.run({
        prompt: "Using the microsoft-foundry quota skill, how do I request a quota increase for Microsoft Foundry?"
      });

      const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
      expect(isSkillUsed).toBe(true);

      // Check in both responses and tool execution data
      const mentionsPortal = doesAssistantOrToolsIncludeKeyword(
        agentMetadata,
        "Azure Portal"
      ) || doesAssistantOrToolsIncludeKeyword(
        agentMetadata,
        "portal"
      );
      expect(mentionsPortal).toBe(true);
    }));

    test("mentions business justification", () => withTestResult(async () => {
      const agentMetadata = await agent.run({
        prompt: "Request more TPM quota for Azure AI Foundry and explain what justification is needed"
      });

      // Check in both responses and tool execution data (e.g., file writes)
      const mentionsJustification = doesAssistantOrToolsIncludeKeyword(
        agentMetadata,
        "justification"
      ) || doesAssistantOrToolsIncludeKeyword(
        agentMetadata,
        "business"
      ) || doesAssistantOrToolsIncludeKeyword(
        agentMetadata,
        "reason"
      ) || doesAssistantOrToolsIncludeKeyword(
        agentMetadata,
        "rationale"
      );
      expect(mentionsJustification).toBe(true);
    }));
  });

  describe("Monitor Quota Across Deployments", () => {
    test("provides monitoring commands", () => withTestResult(async () => {
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
    }));

    test("explains capacity by model tracking", () => withTestResult(async () => {
      const agentMetadata = await agent.run({
        prompt: "Show me quota allocation by model in Azure AI Foundry"
      });

      const hasModelTracking = doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "model"
      ) && (doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "capacity"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "quota"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "allocation"
      ));
      expect(hasModelTracking).toBe(true);
    }));
  });

  describe("Troubleshoot Quota Errors", () => {
    test("troubleshoots QuotaExceeded error", () => withTestResult(async () => {
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
    }));

    test("troubleshoots InsufficientQuota error", () => withTestResult(async () => {
      const agentMetadata = await agent.run({
        prompt: "I'm getting an InsufficientQuota error when deploying gpt-4o to eastus in Azure AI Foundry. Use the microsoft-foundry skill to help me troubleshoot and fix this."
      });

      const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
      expect(isSkillUsed).toBe(true);
    }));

    test("troubleshoots DeploymentLimitReached error", () => withTestResult(async () => {
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
    }));

    test("addresses 429 rate limit errors", () => withTestResult(async () => {
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
    }));
  });

  describe("Capacity Planning", () => {
    test("helps with production capacity planning", () => withTestResult(async () => {
      const agentMetadata = await agent.run({
        prompt: "Help me plan capacity for production Microsoft Foundry deployment with 1M requests per day"
      });

      const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
      expect(isSkillUsed).toBe(true);

      // Require at least one quota-specific term
      const hasQuotaTerm = doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "TPM"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "PTU"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "capacity"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "tokens per minute"
      );

      // Require at least one calculation verb
      const hasCalculationVerb = doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "calculate"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "estimate"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "calculation"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "quantify"
      );

      expect(hasQuotaTerm && hasCalculationVerb).toBe(true);
    }));

    test("provides best practices", () => withTestResult(async () => {
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
    }));
  });

  describe("Deployment Listing", () => {
    test("lists deployments using MCP tools or CLI", () => withTestResult(async () => {
      const agentMetadata = await agent.run({
        prompt: "Use the microsoft-foundry skill to list all my Microsoft Foundry model deployments and their capacity"
      });

      // Soft check for skill invocation - agent should use the skill when explicitly asked
      softCheckSkill(agentMetadata, SKILL_NAME);

      // Check if agent used Azure MCP tool for deployments (model_deployment_get from azure server)
      const usedAzureMcp = doesAssistantOrToolsIncludeKeyword(agentMetadata, "model_deployment");

      // Check if agent used Azure CLI commands for deployments
      const usedCli = matchesCommand(agentMetadata, /az\s+(cognitiveservices|rest|ai)\s+.*?(deployment|model|capacity|quota)/i);

      // Check if Azure CLI commands are mentioned in responses or tool execution data
      const mentionsAzCli = doesAssistantOrToolsIncludeKeyword(agentMetadata, "az cognitiveservices") ||
                            doesAssistantOrToolsIncludeKeyword(agentMetadata, "az rest") ||
                            doesAssistantOrToolsIncludeKeyword(agentMetadata, "az ai");

      // Pass if agent used Azure MCP tools, CLI, or mentioned CLI commands in response/reasoning
      expect(usedAzureMcp || usedCli || mentionsAzCli).toBe(true);
    }));
  });

  describe("Regional Capacity", () => {
    test("explains regional quota distribution", () => withTestResult(async () => {
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
    }));

    test("suggests deploying to different region when quota exhausted", () => withTestResult(async () => {
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
    }));
  });

  describe("Quota Optimization", () => {
    test("provides optimization guidance", () => withTestResult(async () => {
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
    }));

    test("suggests deleting unused deployments", () => withTestResult(async () => {
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
    }));
  });

  describe("Command Output Explanation", () => {
    test("explains how to interpret quota usage output", () => withTestResult(async () => {
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
    }));

    test("explains TPM concept", () => withTestResult(async () => {
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
    }));
  });

  describe("Error Resolution Steps", () => {
    test("provides step-by-step resolution for quota errors", () => withTestResult(async () => {
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
    }));

    test("offers multiple resolution options", () => withTestResult(async () => {
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
    }));
  });
});
