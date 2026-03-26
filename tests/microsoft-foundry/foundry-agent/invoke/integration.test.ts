/**
 * Integration Tests for invoke
 *
 * Tests skill behavior with a real Copilot agent session.
 * Requires Copilot CLI to be installed and authenticated.
 */

import {
  useAgentRunner,
  doesAssistantMessageIncludeKeyword,
  shouldSkipIntegrationTests,
  getIntegrationSkipReason,
} from "../../../utils/agent-runner";
import { softCheckSkill, isSkillInvoked, shouldEarlyTerminateForSkillInvocation, withTestResult } from "../../../utils/evaluate";

const SKILL_NAME = "microsoft-foundry";
const RUNS_PER_PROMPT = 3;
const invocationRateThreshold = 0.8;

const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();
if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

describeIntegration(`${SKILL_NAME}_ - Integration Tests`, () => {
  const agent = useAgentRunner();

  test("invokes skill for relevant prompt", () => withTestResult(async ({ setSkillInvocationRate }) => {
    let invocationCount = 0;
    for (let i = 0; i < RUNS_PER_PROMPT; i++) {
      const agentMetadata = await agent.run({
        prompt: "I deployed an agent called 'support-bot' to my Azure AI Foundry project. Can you invoke it with the message 'hello, are you working?'",
        shouldEarlyTerminate: (metadata) =>
          shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME),
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

  test("response mentions agent concepts", () => withTestResult(async () => {
    const agentMetadata = await agent.run({
      prompt: "I deployed an agent called 'support-bot' to my Azure AI Foundry project. Can you invoke it with the message 'hello, are you working?'",
      shouldEarlyTerminate: (metadata) =>
        isSkillInvoked(metadata, SKILL_NAME) &&
        doesAssistantMessageIncludeKeyword(metadata, "agent"),
    });

    expect(doesAssistantMessageIncludeKeyword(agentMetadata, "agent")).toBe(true);
  }));
});
