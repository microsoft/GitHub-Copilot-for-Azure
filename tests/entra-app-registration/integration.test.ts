/**
 * Integration Tests for entra-app-registration
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
  getIntegrationSkipReason
} from "../utils/agent-runner";
import { softCheckSkill, isSkillInvoked, shouldEarlyTerminateForSkillInvocation, withTestResult } from "../utils/evaluate";

const SKILL_NAME = "entra-app-registration";
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
    test("invokes entra-app-registration skill for OAuth app registration prompt", () => withTestResult(async ({ setSkillInvocationRate }) => {
      let invocationCount = 0;
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        const agentMetadata = await agent.run({
          prompt: "How do I create a Microsoft Entra app registration for OAuth authentication?",
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
    }));

    test("invokes entra-app-registration skill for API permissions prompt", () => withTestResult(async ({ setSkillInvocationRate }) => {
      let invocationCount = 0;
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        const agentMetadata = await agent.run({
          prompt: "Configure API permissions for my Entra ID application to access Microsoft Graph",
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
    }));
  });
});
