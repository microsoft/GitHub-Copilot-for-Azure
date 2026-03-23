/**
 * Integration Tests for preset (deploy-model-optimal-region)
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
} from "../../../../utils/agent-runner";
import { softCheckSkill, isSkillInvoked, shouldEarlyTerminateForSkillInvocation } from "../../../../utils/evaluate";

const SKILL_NAME = "microsoft-foundry";
const RUNS_PER_PROMPT = 5;
const invocationRateThreshold = 0.8;

const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

describeIntegration(`${SKILL_NAME}_deploy-model-optimal-region - Integration Tests`, () => {
  describe("skill-invocation", () => {
    const agent = useAgentRunner();
    test("invokes skill for quick deployment prompt", async () => {
      let invocationCount = 0;
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        const agentMetadata = await agent.run({
          prompt: "Deploy gpt-4o quickly to the optimal region",
          shouldEarlyTerminate: (metadata) => shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME)
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
          invocationCount += 1;
        }
      }
      expect(invocationCount / RUNS_PER_PROMPT).toBeGreaterThanOrEqual(invocationRateThreshold);
    });

    test("invokes skill for best region deployment prompt", async () => {
      let invocationCount = 0;
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        const agentMetadata = await agent.run({
          prompt: "Deploy gpt-4o to the best available region with high availability",
          shouldEarlyTerminate: (metadata) => shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME)
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
          invocationCount += 1;
        }
      }
      expect(invocationCount / RUNS_PER_PROMPT).toBeGreaterThanOrEqual(invocationRateThreshold);
    });
  });
});
