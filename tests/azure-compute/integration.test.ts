/**
 * Integration Tests for azure-compute
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
} from "../utils/agent-runner";
import { isSkillInvoked, isToolCalled, softCheckSkill, withTestResult } from "../utils/evaluate";

const SKILL_NAME = "azure-compute";
const RECOMMENDER_WORKFLOW_PATH = /workflows\/vm-recommender\/vm-recommender\.md/i;
const TROUBLESHOOTER_WORKFLOW_PATH = /workflows\/vm-troubleshooter\/vm-troubleshooter\.md/i;
const CAPACITY_RESERVATION_WORKFLOW_PATH = /workflows\/capacity-reservation\/capacity-reservation\.md/i;
const VMSS_GUIDE_PATH = /references\/vmss-guide\.md/i;
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

  async function expectPromptToInvokeWorkflow(prompt: string, workflowPathPattern: RegExp): Promise<{
    skillInvocationCount: number,
    toolCallCount: number
  } | undefined> {
    let invocationCount = 0;
    let toolCallCount = 0;
    for (let i = 0; i < RUNS_PER_PROMPT; i++) {
      const agentMetadata = await agent.run({ prompt });

      softCheckSkill(agentMetadata, SKILL_NAME);
      if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
        invocationCount += 1;
      }
      if (isToolCalled(agentMetadata, "view", workflowPathPattern)) {
        toolCallCount += 1;
      }
    }
    return {
      skillInvocationCount: invocationCount,
      toolCallCount: toolCallCount
    };
  }

  describe("skill-invocation", () => {
    test("routes web workload recommendation prompt to vm-recommender", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        const result = await expectPromptToInvokeWorkflow(
          "Which Azure VM size should I use for a web server handling 500 concurrent users?",
          RECOMMENDER_WORKFLOW_PATH,
        );
        if (!result) return;
        const rate = result.skillInvocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
        expect(result.toolCallCount).toBe(RUNS_PER_PROMPT);
      });
    });

    test("routes GPU VM prompt to vm-recommender", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        const result = await expectPromptToInvokeWorkflow(
          "I need a GPU VM on Azure for training a deep learning model. What do you recommend?",
          RECOMMENDER_WORKFLOW_PATH,
        );
        if (!result) return;
        const rate = result.skillInvocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
        expect(result.toolCallCount).toBe(RUNS_PER_PROMPT);
      });
    });

    test("routes VMSS autoscale prompt to vm-recommender", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        const result = await expectPromptToInvokeWorkflow(
          "Should I use a VM Scale Set with autoscaling for my API backend on Azure?",
          RECOMMENDER_WORKFLOW_PATH,
        );
        if (!result) return;
        const rate = result.skillInvocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
        expect(result.toolCallCount).toBe(RUNS_PER_PROMPT);
      });
    });

    test("routes VM vs VMSS prompt to vm-recommender", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        const result = await expectPromptToInvokeWorkflow(
          "When should I use VMSS versus individual VMs on Azure?",
          VMSS_GUIDE_PATH,
        );
        if (!result) return;
        const rate = result.skillInvocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
        expect(result.toolCallCount).toBe(RUNS_PER_PROMPT);
      });
    });

    test("routes VM family comparison prompt to vm-recommender", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        const result = await expectPromptToInvokeWorkflow(
          "Compare Azure VM families for a memory-optimized database workload",
          RECOMMENDER_WORKFLOW_PATH,
        );
        if (!result) return;
        const rate = result.skillInvocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
        expect(result.toolCallCount).toBe(RUNS_PER_PROMPT);
      });
    });

    test("routes RDP troubleshooting prompt to vm-troubleshooter", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        const result = await expectPromptToInvokeWorkflow(
          "I can't RDP into my Azure Windows VM. The connection times out on port 3389. Help me troubleshoot it.",
          TROUBLESHOOTER_WORKFLOW_PATH,
        );
        if (!result) return;
        const rate = result.skillInvocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
        expect(result.toolCallCount).toBe(RUNS_PER_PROMPT);
      });
    });

    test("routes SSH troubleshooting prompt to vm-troubleshooter", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        const result = await expectPromptToInvokeWorkflow(
          "I can't SSH into my Azure Linux VM. SSH says connection refused and I need help checking NSG or firewall issues.",
          TROUBLESHOOTER_WORKFLOW_PATH,
        );
        if (!result) return;
        const rate = result.skillInvocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
        expect(result.toolCallCount).toBe(RUNS_PER_PROMPT);
      });
    });

    test("routes capacity reservation creation prompt to capacity-reservation", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        const result = await expectPromptToInvokeWorkflow(
          "I need to create a Capacity Reservation Group in Azure to guarantee Standard_D4s_v5 capacity in East US.",
          CAPACITY_RESERVATION_WORKFLOW_PATH,
        );
        if (!result) return;
        const rate = result.skillInvocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
        expect(result.toolCallCount).toBe(RUNS_PER_PROMPT);
      });
    });

    test("routes CRG association prompt to capacity-reservation", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        const result = await expectPromptToInvokeWorkflow(
          "How do I associate my Azure VM with a Capacity Reservation Group (CRG) to guarantee reserved compute capacity?",
          CAPACITY_RESERVATION_WORKFLOW_PATH,
        );
        if (!result) return;
        const rate = result.skillInvocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
        expect(result.toolCallCount).toBe(RUNS_PER_PROMPT);
      });
    });
  });
});
