/**
 * Integration Tests for diagnose-429-errors
 *
 * Tests skill behavior with a real Copilot agent session.
 * Verifies the agent invokes the microsoft-foundry skill and provides
 * relevant rate-limiting diagnostics and resolution guidance.
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

describeIntegration("diagnose-429-errors - Integration Tests", () => {
  const agent = useAgentRunner();

  describe("Rate Limit Diagnosis", () => {
    test("invokes skill for 429 error diagnosis", async () => {
      const agentMetadata = await agent.run({
        prompt: "I'm getting 429 rate limit errors from my Azure AI Foundry deployment"
      });

      expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
    });

    test("response mentions rate limiting concepts", async () => {
      const agentMetadata = await agent.run({
        prompt: "Getting 429 Too Many Requests from my Microsoft Foundry model"
      });

      const hasRateLimitInfo = doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "rate limit"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "429"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "throttl"
      );
      expect(hasRateLimitInfo).toBe(true);
    });
  });

  describe("Quota and TPM", () => {
    test("invokes skill for TPM quota issues", async () => {
      const agentMetadata = await agent.run({
        prompt: "My Azure AI Foundry deployment is hitting TPM limits"
      });

      expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
    });

    test("explains TPM/RPM concepts", async () => {
      const agentMetadata = await agent.run({
        prompt: "What are TPM and RPM limits in Microsoft Foundry?"
      });

      const hasTPMInfo = doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "TPM"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "Tokens Per Minute"
      );
      expect(hasTPMInfo).toBe(true);
    });
  });

  describe("Retry Strategies", () => {
    test("provides retry guidance", async () => {
      const agentMetadata = await agent.run({
        prompt: "How should I handle retry logic for 429 errors from Azure AI Foundry?"
      });

      const hasRetryInfo = doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "retry"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "backoff"
      );
      expect(hasRetryInfo).toBe(true);
    });
  });

  describe("Scaling Solutions", () => {
    test("invokes skill for scaling beyond rate limits", async () => {
      const agentMetadata = await agent.run({
        prompt: "How do I scale my Azure AI Foundry deployment to avoid 429 errors?"
      });

      expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
    });

    test("mentions scaling options", async () => {
      const agentMetadata = await agent.run({
        prompt: "My Microsoft Foundry deployment keeps hitting rate limits even after increasing quota"
      });

      const hasScaling = doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "scale"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "capacity"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "region"
      );
      expect(hasScaling).toBe(true);
    });
  });

  describe("Quota Increase", () => {
    test("explains quota increase process", async () => {
      const agentMetadata = await agent.run({
        prompt: "I need more TPM quota for my Azure AI Foundry deployment to stop 429 errors"
      });

      const hasQuotaIncrease = doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "quota"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "increase"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "request"
      );
      expect(hasQuotaIncrease).toBe(true);
    });
  });
});
