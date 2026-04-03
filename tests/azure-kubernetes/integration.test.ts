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

    test("invokes azure-kubernetes skill for pod rightsizing prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "My AKS pods are over-provisioned, how do I rightsize them to reduce costs?",
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

    test("invokes azure-kubernetes skill for cluster autoscaler prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "How do I enable and configure Cluster Autoscaler on my AKS cluster to save costs?",
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

    test("invokes azure-kubernetes skill for CAS profile tuning prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "CAS is enabled but idle nodes persist due to conservative profile settings, tune it for more aggressive scale-down",
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

    test("invokes azure-kubernetes skill for spot node pool prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "How do I add a Spot VM node pool to my AKS cluster to cut costs?",
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

    test("response mentions resource requests and limits for pod rightsizing prompt", async () => {
      await withTestResult(async () => {
        const agentMetadata = await agent.run({
          prompt: "My AKS pods are over-provisioned, how do I rightsize them to reduce costs?"
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        const hasRightsizingContent = doesAssistantMessageIncludeKeyword(agentMetadata, "kubectl top") ||
                                      doesAssistantMessageIncludeKeyword(agentMetadata, "requests") ||
                                      doesAssistantMessageIncludeKeyword(agentMetadata, "limits") ||
                                      doesAssistantMessageIncludeKeyword(agentMetadata, "VPA");
        expect(hasRightsizingContent).toBe(true);
      });
    });

    test("response mentions autoscaler commands for cluster autoscaler prompt", async () => {
      await withTestResult(async () => {
        const agentMetadata = await agent.run({
          prompt: "How do I enable and configure Cluster Autoscaler on my AKS cluster to save costs?"
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        const hasCASContent = doesAssistantMessageIncludeKeyword(agentMetadata, "enable-cluster-autoscaler") ||
                              doesAssistantMessageIncludeKeyword(agentMetadata, "min-count") ||
                              doesAssistantMessageIncludeKeyword(agentMetadata, "scale-down");
        expect(hasCASContent).toBe(true);
      });
    });

    test("response mentions autoscaler profile parameters for CAS tuning prompt", async () => {
      await withTestResult(async () => {
        const agentMetadata = await agent.run({
          prompt: "CAS is enabled but idle nodes persist due to conservative profile settings, tune it for more aggressive scale-down"
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        const hasTuneContent = doesAssistantMessageIncludeKeyword(agentMetadata, "scale-down-unneeded-time") ||
                               doesAssistantMessageIncludeKeyword(agentMetadata, "utilization-threshold") ||
                               doesAssistantMessageIncludeKeyword(agentMetadata, "cluster-autoscaler-profile") ||
                               doesAssistantMessageIncludeKeyword(agentMetadata, "scale-down-delay");
        expect(hasTuneContent).toBe(true);
      });
    });

    test("response mentions spot priority and eviction for spot node pool prompt", async () => {
      await withTestResult(async () => {
        const agentMetadata = await agent.run({
          prompt: "How do I add a Spot VM node pool to my AKS cluster to cut costs?"
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        const hasSpotContent = doesAssistantMessageIncludeKeyword(agentMetadata, "Spot") ||
                               doesAssistantMessageIncludeKeyword(agentMetadata, "eviction") ||
                               doesAssistantMessageIncludeKeyword(agentMetadata, "priority");
        expect(hasSpotContent).toBe(true);
      });
    });
  });
});
