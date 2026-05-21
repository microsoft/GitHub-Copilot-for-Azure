/**
 * Integration Tests for azure-arc-servers
 *
 * Tests skill behavior with a real Copilot agent session.
 * Runs prompts multiple times to measure skill invocation rate.
 *
 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 *
 * Run with:
 *   npm run test:integration -- --testPathPatterns=azure-arc-servers
 */

import {
  useAgentRunner,
  shouldSkipIntegrationTests,
  getIntegrationSkipReason,
} from "../utils/agent-runner";
import {
  isSkillInvoked,
  isToolCalled,
  softCheckSkill,
  withTestResult,
} from "../utils/evaluate";

const SKILL_NAME = "azure-arc-servers";
const ONBOARD_WORKFLOW_PATH =
  /workflows\/arc-server-onboard\/arc-server-onboard\.md/i;
const TROUBLESHOOT_WORKFLOW_PATH =
  /workflows\/arc-server-troubleshoot\/arc-server-troubleshoot\.md/i;
const MANAGE_WORKFLOW_PATH =
  /workflows\/arc-server-manage\/arc-server-manage\.md/i;
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

  async function expectPromptToInvokeWorkflow(
    prompt: string,
    workflowPathPattern: RegExp
  ): Promise<
    | {
        skillInvocationCount: number;
        toolCallCount: number;
      }
    | undefined
  > {
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
      toolCallCount: toolCallCount,
    };
  }

  describe("skill-invocation", () => {
    test("routes onboarding prompt to arc-server-onboard", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        const result = await expectPromptToInvokeWorkflow(
          "Onboard my on-prem Windows Server to Azure Arc. Generate the install script.",
          ONBOARD_WORKFLOW_PATH
        );
        if (!result) return;
        const rate = result.skillInvocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
        const referenceViewRate = result.toolCallCount / RUNS_PER_PROMPT;
        expect(referenceViewRate).toBeGreaterThanOrEqual(
          invocationRateThreshold
        );
      });
    });

    test("'on-prem server to Azure' invokes arc-servers, NOT azure-compute", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        let wrongSkillInvocations = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt:
              "I have an existing Windows server in my datacenter. " +
              "I want to project it into Azure so I can manage it with Azure Policy.",
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invocationCount += 1;
          }
          if (isSkillInvoked(agentMetadata, "azure-compute")) {
            wrongSkillInvocations += 1;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
        // Wrong skill should never be invoked for a clearly-Arc prompt.
        expect(wrongSkillInvocations).toBe(0);
      });
    });

    test("routes agent-disconnected prompt to arc-server-troubleshoot", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        const result = await expectPromptToInvokeWorkflow(
          "My Azure Arc server is showing Disconnected. The Connected Machine agent " +
            "was working yesterday. How do I troubleshoot it?",
          TROUBLESHOOT_WORKFLOW_PATH
        );
        if (!result) return;
        const rate = result.skillInvocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
        const referenceViewRate = result.toolCallCount / RUNS_PER_PROMPT;
        expect(referenceViewRate).toBeGreaterThanOrEqual(
          invocationRateThreshold
        );
      });
    });

    test("routes Extended Security Updates prompt to arc-server-manage", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        const result = await expectPromptToInvokeWorkflow(
          "Enable Extended Security Updates for my Windows Server 2012 R2 " +
            "Arc-enabled machine. I need it to keep getting security patches.",
          MANAGE_WORKFLOW_PATH
        );
        if (!result) return;
        const rate = result.skillInvocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
        const referenceViewRate = result.toolCallCount / RUNS_PER_PROMPT;
        expect(referenceViewRate).toBeGreaterThanOrEqual(
          invocationRateThreshold
        );
      });
    });
  });
});
