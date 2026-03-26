/**
 * Integration Tests for azure-cost-optimization
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
  shouldSkipIntegrationTests,
  getIntegrationSkipReason,
  doesAssistantMessageIncludeKeyword
} from "../utils/agent-runner";
import { shouldEarlyTerminateForSkillInvocation, softCheckSkill, isSkillInvoked, withTestResult } from "../utils/evaluate";

const SKILL_NAME = "azure-cost-optimization";
const RUNS_PER_PROMPT = 5;
const invocationRateThreshold = 0.8;

// Check if integration tests should be skipped at module level
const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

// Log skip reason if skipping
if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

describeIntegration(`${SKILL_NAME}_ - Integration Tests`, () => {
  const agent = useAgentRunner();

  describe("skill-invocation", () => {
    test("invokes azure-cost-optimization skill for cost savings prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "How can I reduce my Azure spending and find cost savings in my subscription?",
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

    test("invokes azure-cost-optimization skill for orphaned resources prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "Find orphaned and unused resources in my Azure subscription that I can delete for cost savings",
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

    test("invokes skill for VM rightsizing prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "Rightsize my Azure VMs to reduce costs",
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

    test("invokes skill for Redis cost optimization prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "How can I optimize my Azure Redis costs?",
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

    test("invokes skill for storage cost optimization prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "Find unused storage accounts to reduce my Azure costs",
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

    test("invokes skill for AKS cost analysis add-on prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "Show me cost breakdown by Kubernetes namespace in my AKS cluster",
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

    test("invokes skill for AKS cost anomaly investigation prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "Why did my AKS cluster spend suddenly increase this week? Help me find the cause",
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

  test("response mentions Cost Management for cost analysis", async () => {
    await withTestResult(async () => {
      const agentMetadata = await agent.run({
        prompt: "Analyze my Azure costs and show me where I can save money"
      });

      const mentionsCostManagement = doesAssistantMessageIncludeKeyword(agentMetadata, "Cost Management") ||
        doesAssistantMessageIncludeKeyword(agentMetadata, "az costmanagement");
      expect(mentionsCostManagement).toBe(true);
    });
  });

  describe("aks-cost-optimization", () => {
    test("response mentions cost analysis add-on for AKS namespace cost prompt", async () => {
      await withTestResult(async () => {
        const agentMetadata = await agent.run({
          prompt: "How do I enable namespace-level cost visibility for my AKS cluster?"
        });

        const mentionsAddon = doesAssistantMessageIncludeKeyword(agentMetadata, "--enable-cost-analysis") ||
          doesAssistantMessageIncludeKeyword(agentMetadata, "costAnalysis") ||
          doesAssistantMessageIncludeKeyword(agentMetadata, "Cost Analysis");
        expect(mentionsAddon).toBe(true);
      });
    });

    test("response mentions monitoring commands for AKS cost anomaly prompt", async () => {
      await withTestResult(async () => {
        const agentMetadata = await agent.run({
          prompt: "My AKS cluster costs spiked unexpectedly this week, help me investigate"
        });

        const mentionsMonitoring = doesAssistantMessageIncludeKeyword(agentMetadata, "kubectl top") ||
          doesAssistantMessageIncludeKeyword(agentMetadata, "az monitor metrics") ||
          doesAssistantMessageIncludeKeyword(agentMetadata, "az consumption budget");
        expect(mentionsMonitoring).toBe(true);
      });
    });
  });
});
