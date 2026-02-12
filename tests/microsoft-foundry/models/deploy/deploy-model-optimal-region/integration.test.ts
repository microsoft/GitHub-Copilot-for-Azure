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

import * as fs from "fs";
import {
  useAgentRunner,
  isSkillInvoked,
  shouldSkipIntegrationTests,
  getIntegrationSkipReason,
} from "../../../../utils/agent-runner";

const SKILL_NAME = "microsoft-foundry";
const RUNS_PER_PROMPT = 5;
const EXPECTED_INVOCATION_RATE = 0.6;

const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

describeIntegration("preset (deploy-model-optimal-region) - Integration Tests", () => {
  const agent = useAgentRunner();

  describe("skill-invocation", () => {
    test("invokes skill for quick deployment prompt", async () => {
      let successCount = 0;

      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Deploy gpt-4o quickly to the optimal region"
          });

          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            successCount++;
          }
        } catch (e: unknown) {
          if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
            console.log("⏭️  SDK not loadable, skipping test");
            return;
          }
          throw e;
        }
      }

      const invocationRate = successCount / RUNS_PER_PROMPT;
      console.log(`preset invocation rate for quick deployment: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`);
      fs.appendFileSync("./result-preset.txt", `preset invocation rate for quick deployment: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`);
      expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    });

    test("invokes skill for best region deployment prompt", async () => {
      let successCount = 0;

      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Deploy gpt-4o to the best available region with high availability"
          });

          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            successCount++;
          }
        } catch (e: unknown) {
          if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
            console.log("⏭️  SDK not loadable, skipping test");
            return;
          }
          throw e;
        }
      }

      const invocationRate = successCount / RUNS_PER_PROMPT;
      console.log(`preset invocation rate for best region: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`);
      fs.appendFileSync("./result-preset.txt", `preset invocation rate for best region: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`);
      expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    });
  });
});
