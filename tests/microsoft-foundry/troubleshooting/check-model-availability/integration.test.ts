/**
 * Integration Tests for check-model-availability
 *
 * Tests skill behavior with a real Copilot agent session.
 * Verifies the agent invokes the microsoft-foundry skill and provides
 * relevant availability guidance for various model availability scenarios.
 *
 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 */

import {
  useAgentRunner,
  isSkillInvoked,
  doesAssistantMessageIncludeKeyword,
  shouldSkipIntegrationTests,
} from "../../../utils/agent-runner";

const SKILL_NAME = "microsoft-foundry";

const describeIntegration = shouldSkipIntegrationTests() ? describe.skip : describe;

describeIntegration("check-model-availability - Integration Tests", () => {
  const agent = useAgentRunner();

  describe("Model Availability Check", () => {
    test("invokes skill for model availability in a region", async () => {
      const agentMetadata = await agent.run({
        prompt: "Is the GPT-4o model available in the West Europe region on Azure AI Foundry?"
      });

      expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
    });

    test("response mentions region for availability query", async () => {
      const agentMetadata = await agent.run({
        prompt: "Can I deploy GPT-4o in eastus on Microsoft Foundry?"
      });

      const mentionsRegion = doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "region"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "eastus"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "East US"
      );
      expect(mentionsRegion).toBe(true);
    });
  });

  describe("Find Regions for Model", () => {
    test("invokes skill for finding regions", async () => {
      const agentMetadata = await agent.run({
        prompt: "Which Azure regions have GPT-4o available for deployment in Foundry?"
      });

      expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
    });

    test("provides multi-region guidance", async () => {
      const agentMetadata = await agent.run({
        prompt: "In what regions can I deploy GPT-4.1 on Azure AI Foundry?"
      });

      const hasRegionInfo = doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "region"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "available"
      );
      expect(hasRegionInfo).toBe(true);
    });
  });

  describe("Troubleshoot Model Not Found", () => {
    test("invokes skill for model not found error", async () => {
      const agentMetadata = await agent.run({
        prompt: "I'm getting a 'model not found' error when deploying to Azure AI Foundry"
      });

      expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
    });

    test("invokes skill for SKU not available error", async () => {
      const agentMetadata = await agent.run({
        prompt: "SKU not available error when deploying my model in Azure AI Foundry"
      });

      expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
    });

    test("provides troubleshooting guidance", async () => {
      const agentMetadata = await agent.run({
        prompt: "My model deployment failed because the model is not supported in this region on Microsoft Foundry"
      });

      const hasTroubleshooting = doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "region"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "available"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "capacity"
      );
      expect(hasTroubleshooting).toBe(true);
    });
  });

  describe("Capacity and Quota", () => {
    test("invokes skill for capacity check", async () => {
      const agentMetadata = await agent.run({
        prompt: "Check if there is capacity to deploy GPT-4o in eastus2 on Azure AI Foundry"
      });

      expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
    });

    test("mentions quota or capacity concepts", async () => {
      const agentMetadata = await agent.run({
        prompt: "Do I have enough quota to deploy a model in Microsoft Foundry?"
      });

      const hasCapacityInfo = doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "quota"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "capacity"
      );
      expect(hasCapacityInfo).toBe(true);
    });
  });
});
