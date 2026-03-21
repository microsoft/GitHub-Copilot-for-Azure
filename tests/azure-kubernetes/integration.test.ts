/**
 * Integration Tests for azure-kubernetes
 *
 * Tests skill behavior with a real Copilot agent session.
 * Runs prompts multiple times to measure skill invocation rate.
 */

import {
  useAgentRunner,
  doesAssistantMessageIncludeKeyword,
  shouldSkipIntegrationTests,
  getIntegrationSkipReason
} from "../utils/agent-runner";
import { shouldEarlyTerminateForSkillInvocation, softCheckSkill } from "../utils/evaluate";

const SKILL_NAME = "azure-kubernetes";
const RUNS_PER_PROMPT = 5;

const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

describeIntegration(`${SKILL_NAME}_ - Integration Tests`, () => {
  const agent = useAgentRunner();

  describe("skill-invocation", () => {
    test("invokes azure-kubernetes skill for AKS cluster creation prompt", async () => {
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Help me create a production-ready AKS cluster with best practices",
            shouldEarlyTerminate: (metadata) => shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME)
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
        } catch (e: unknown) {
          if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
            console.log("⏭️  SDK not loadable, skipping test");
            return;
          }
          throw e;
        }
      }
    });

    test("invokes skill for AKS networking design prompt", async () => {
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Design AKS networking with private API server and CNI overlay",
            shouldEarlyTerminate: (metadata) => shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME)
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
        } catch (e: unknown) {
          if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
            console.log("⏭️  SDK not loadable, skipping test");
            return;
          }
          throw e;
        }
      }
    });

    test("invokes skill for AKS SKU selection prompt", async () => {
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Should I use AKS Automatic or Standard for my production workload?",
            shouldEarlyTerminate: (metadata) => shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME)
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
        } catch (e: unknown) {
          if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
            console.log("⏭️  SDK not loadable, skipping test");
            return;
          }
          throw e;
        }
      }
    });

    test("invokes skill for AKS security configuration prompt", async () => {
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Configure AKS with workload identity and Azure Policy",
            shouldEarlyTerminate: (metadata) => shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME)
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
        } catch (e: unknown) {
          if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
            console.log("⏭️  SDK not loadable, skipping test");
            return;
          }
          throw e;
        }
      }
    });
  });

  test("responds with Day-0 vs Day-1 guidance", async () => {
    try {
      const agentMetadata = await agent.run({
        prompt: "What Day-0 decisions do I need to make for AKS?"
      });

      const hasDay0Content = doesAssistantMessageIncludeKeyword(agentMetadata, "tier") ||
                             doesAssistantMessageIncludeKeyword(agentMetadata, "networking") ||
                             doesAssistantMessageIncludeKeyword(agentMetadata, "API server");
      expect(hasDay0Content).toBe(true);
    } catch (e: unknown) {
      if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
        console.log("SDK not loadable, skipping test");
        return;
      }
      throw e;
    }
  });

  test("provides networking recommendations", async () => {
    try {
      const agentMetadata = await agent.run({
        prompt: "How should I configure AKS networking for pods that need VNet-routable IPs?"
      });

      const hasNetworkingContent = doesAssistantMessageIncludeKeyword(agentMetadata, "CNI") ||
                                   doesAssistantMessageIncludeKeyword(agentMetadata, "overlay") ||
                                   doesAssistantMessageIncludeKeyword(agentMetadata, "VNet");
      expect(hasNetworkingContent).toBe(true);
    } catch (e: unknown) {
      if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
        console.log("SDK not loadable, skipping test");
        return;
      }
      throw e;
    }
  });
});
