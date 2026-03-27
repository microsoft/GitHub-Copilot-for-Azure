/**
 * Integration Tests for azure-kubernetes
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
  doesAssistantMessageIncludeKeyword,
  shouldSkipIntegrationTests,
  getIntegrationSkipReason
} from "../utils/agent-runner";
import { softCheckSkill, isSkillInvoked, shouldEarlyTerminateForSkillInvocation, withTestResult } from "../utils/evaluate";

const SKILL_NAME = "azure-kubernetes";
const RUNS_PER_PROMPT = 5;
const invocationRateThreshold = 0.8;

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
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "Help me create a production-ready AKS cluster with best practices",
            shouldEarlyTerminate: (metadata) => shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME)
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

  describe("response-quality", () => {
    test("responds with Day-0 vs Day-1 guidance", async () => {
      await withTestResult(async () => {
        const agentMetadata = await agent.run({
          prompt: "What Day-0 decisions do I need to make for AKS?"
        });

        const hasDay0Content = doesAssistantMessageIncludeKeyword(agentMetadata, "tier") ||
                               doesAssistantMessageIncludeKeyword(agentMetadata, "networking") ||
                               doesAssistantMessageIncludeKeyword(agentMetadata, "API server");
        expect(hasDay0Content).toBe(true);
      });
    });

    test("recommends AKS Automatic vs Standard appropriately", async () => {
      await withTestResult(async () => {
        const agentMetadata = await agent.run({
          prompt: "Should I use AKS Automatic or Standard for my production workload?"
        });

        const hasSkuGuidance = doesAssistantMessageIncludeKeyword(agentMetadata, "Automatic") ||
                               doesAssistantMessageIncludeKeyword(agentMetadata, "Standard");
        expect(hasSkuGuidance).toBe(true);
      });
    });

    test("provides networking recommendations", async () => {
      await withTestResult(async () => {
        const agentMetadata = await agent.run({
          prompt: "How should I configure AKS networking for pods that need VNet-routable IPs?"
        });

        const hasNetworkingContent = doesAssistantMessageIncludeKeyword(agentMetadata, "CNI") ||
                                     doesAssistantMessageIncludeKeyword(agentMetadata, "overlay") ||
                                     doesAssistantMessageIncludeKeyword(agentMetadata, "VNet");
        expect(hasNetworkingContent).toBe(true);
      });
    });

    test("covers security best practices", async () => {
      await withTestResult(async () => {
        const agentMetadata = await agent.run({
          prompt: "What security best practices should I follow for AKS?"
        });

        const hasSecurityContent = doesAssistantMessageIncludeKeyword(agentMetadata, "identity") ||
                                   doesAssistantMessageIncludeKeyword(agentMetadata, "Entra") ||
                                   doesAssistantMessageIncludeKeyword(agentMetadata, "workload") ||
                                   doesAssistantMessageIncludeKeyword(agentMetadata, "Key Vault");
        expect(hasSecurityContent).toBe(true);
      });
    });
  });

  test("aks pod rightsizing scenarios", async () => {
    for (let i = 0; i < RUNS_PER_PROMPT; i++) {
      try {
        const agentMetadata = await agent.run({
          prompt: "My AKS pods are over-provisioned and costs are high, how do I rightsize them?"
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        const hasRightsizingContent = doesAssistantMessageIncludeKeyword(agentMetadata, "request") ||
                                      doesAssistantMessageIncludeKeyword(agentMetadata, "limit") ||
                                      doesAssistantMessageIncludeKeyword(agentMetadata, "VPA") ||
                                      doesAssistantMessageIncludeKeyword(agentMetadata, "resource");
        expect(hasRightsizingContent).toBe(true);
      } catch (e: unknown) {
        if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
          console.log("⏭️  SDK not loadable, skipping test");
          return;
        }
        throw e;
      }
    }
  });

  test("aks Cluster Autoscaler scenarios", async () => {
    for (let i = 0; i < RUNS_PER_PROMPT; i++) {
      try {
        const agentMetadata = await agent.run({
          prompt: "How do I enable Cluster Autoscaler on my AKS cluster to reduce costs?"
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        const hasCASContent = doesAssistantMessageIncludeKeyword(agentMetadata, "autoscaler") ||
                              doesAssistantMessageIncludeKeyword(agentMetadata, "min") ||
                              doesAssistantMessageIncludeKeyword(agentMetadata, "node");
        expect(hasCASContent).toBe(true);
      } catch (e: unknown) {
        if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
          console.log("⏭️  SDK not loadable, skipping test");
          return;
        }
        throw e;
      }
    }
  });

  test("aks Spot node cost savings scenarios", async () => {
    for (let i = 0; i < RUNS_PER_PROMPT; i++) {
      try {
        const agentMetadata = await agent.run({
          prompt: "How do I use Spot VMs in AKS to cut node pool costs?"
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        const hasSpotContent = doesAssistantMessageIncludeKeyword(agentMetadata, "spot") ||
                               doesAssistantMessageIncludeKeyword(agentMetadata, "eviction") ||
                               doesAssistantMessageIncludeKeyword(agentMetadata, "priority");
        expect(hasSpotContent).toBe(true);
      } catch (e: unknown) {
        if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
          console.log("⏭️  SDK not loadable, skipping test");
          return;
        }
        throw e;
      }
    }
  });

  test("aks cost analysis add-on scenarios", async () => {
    for (let i = 0; i < RUNS_PER_PROMPT; i++) {
      try {
        const agentMetadata = await agent.run({
          prompt: "How do I enable cost analysis for my AKS cluster?"
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        const hasCostAddonContent = doesAssistantMessageIncludeKeyword(agentMetadata, "cost") ||
                                    doesAssistantMessageIncludeKeyword(agentMetadata, "add-on") ||
                                    doesAssistantMessageIncludeKeyword(agentMetadata, "Standard");
        expect(hasCostAddonContent).toBe(true);
      } catch (e: unknown) {
        if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
          console.log("⏭️  SDK not loadable, skipping test");
          return;
        }
        throw e;
      }
    }
  });

  test("aks cost anomaly investigation scenarios", async () => {
    for (let i = 0; i < RUNS_PER_PROMPT; i++) {
      try {
        const agentMetadata = await agent.run({
          prompt: "My AKS cost spiked unexpectedly this month, how do I investigate?"
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        const hasAnomalyContent = doesAssistantMessageIncludeKeyword(agentMetadata, "spike") ||
                                  doesAssistantMessageIncludeKeyword(agentMetadata, "scaling") ||
                                  doesAssistantMessageIncludeKeyword(agentMetadata, "budget") ||
                                  doesAssistantMessageIncludeKeyword(agentMetadata, "alert");
        expect(hasAnomalyContent).toBe(true);
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
