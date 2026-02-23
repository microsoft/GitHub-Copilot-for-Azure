/**
 * Integration Tests for check-deployment-health
 *
 * Tests skill behavior with a real Copilot agent session.
 * Verifies the agent invokes the microsoft-foundry skill and provides
 * relevant deployment health guidance for troubleshooting scenarios.
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

describeIntegration("check-deployment-health - Integration Tests", () => {
  const agent = useAgentRunner();

  describe("Deployment Status Check", () => {
    test("invokes skill for deployment health check", async () => {
      const agentMetadata = await agent.run({
        prompt: "Check the health of my Azure AI Foundry model deployment"
      });

      expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
    });

    test("response mentions deployment status concepts", async () => {
      const agentMetadata = await agent.run({
        prompt: "Is my Microsoft Foundry deployment healthy?"
      });

      const hasStatusInfo = doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "deployment"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "health"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "status"
      );
      expect(hasStatusInfo).toBe(true);
    });
  });

  describe("Deployment Failures", () => {
    test("invokes skill for stuck deployment", async () => {
      const agentMetadata = await agent.run({
        prompt: "My Azure AI Foundry deployment is stuck in Creating state"
      });

      expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
    });

    test("invokes skill for failed deployment", async () => {
      const agentMetadata = await agent.run({
        prompt: "My model deployment failed in Microsoft Foundry, how do I fix it?"
      });

      expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
    });

    test("provides remediation guidance for failures", async () => {
      const agentMetadata = await agent.run({
        prompt: "My Azure AI Foundry deployment shows a Failed provisioning state"
      });

      const hasRemediation = doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "failed"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "provisioning"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "redeploy"
      );
      expect(hasRemediation).toBe(true);
    });
  });

  describe("Inference Issues", () => {
    test("invokes skill for endpoint errors", async () => {
      const agentMetadata = await agent.run({
        prompt: "I'm getting 5xx errors from my Azure AI Foundry model endpoint"
      });

      expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
    });

    test("invokes skill for high latency", async () => {
      const agentMetadata = await agent.run({
        prompt: "My Microsoft Foundry deployment has very high latency"
      });

      const hasLatencyInfo = doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "latency"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "performance"
      );
      expect(hasLatencyInfo).toBe(true);
    });
  });

  describe("Monitoring", () => {
    test("suggests monitoring tools", async () => {
      const agentMetadata = await agent.run({
        prompt: "How do I monitor my Azure AI Foundry deployment health?"
      });

      const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
      expect(isSkillUsed).toBe(true);

      const hasMonitoring = doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "monitor"
      ) || doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "metric"
      );
      expect(hasMonitoring).toBe(true);
    });
  });
});
