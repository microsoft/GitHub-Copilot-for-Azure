/**
 * Integration Tests for azure-iac-generator
 * 
 * Tests skill behavior with a real Copilot agent session.
 * 
 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 * 3. az login (for Azure resource access)
 */

import {
  useAgentRunner,
  shouldSkipIntegrationTests,
  getIntegrationSkipReason
} from "../utils/agent-runner";
import { softCheckSkill, isSkillInvoked, shouldEarlyTerminateForSkillInvocation, withTestResult } from "../utils/evaluate";

const SKILL_NAME = "azure-iac-generator";
const RUNS_PER_PROMPT = 5;
const invocationRateThreshold = 0.8;

const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

describeIntegration(`${SKILL_NAME} - Integration Tests`, () => {
  const agent = useAgentRunner();

  describe("skill-invocation", () => {
    test("invokes azure-iac-generator skill for Bicep generation prompt", () => withTestResult(async ({ setSkillInvocationRate }) => {
      let invocationCount = 0;
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        const agentMetadata = await agent.run({
          prompt: "Generate Bicep templates from my Azure resource group",
          shouldEarlyTerminate: (metadata) => shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME)
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
          invocationCount++;
        }
      }

      const invocationRate = invocationCount / RUNS_PER_PROMPT;
      setSkillInvocationRate(invocationRate);
      expect(invocationRate).toBeGreaterThanOrEqual(invocationRateThreshold);
    }), 1200000);
  });
});
