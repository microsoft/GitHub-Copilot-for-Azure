/**
 * Integration Tests for agent-framework (evaluate)
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
  run,
  AgentMetadata,
  isSkillInvoked,
  getToolCalls,
  shouldSkipIntegrationTests,
  getIntegrationSkipReason,
} from "../../../../utils/agent-runner";

const SKILL_NAME = "microsoft-foundry";
const RUNS_PER_PROMPT = 5;
const EXPECTED_INVOCATION_RATE = 0.6;

/** Terminate on first `create` tool call to avoid unnecessary file writes. */
function terminateOnCreate(metadata: AgentMetadata): boolean {
  return getToolCalls(metadata, "create").length > 0;
}

const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

describeIntegration("agent-framework (evaluate) - Integration Tests", () => {
  describe("skill-invocation", () => {
    test("invokes skill for agent evaluation prompt", async () => {
      let successCount = 0;

      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await run({
            prompt: "Evaluate my Foundry agent built with Microsoft Agent Framework using pytest evaluators.",
            shouldEarlyTerminate: terminateOnCreate,
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
      console.log(`agent-framework (evaluate) invocation rate for evaluation: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`);
      fs.appendFileSync("./result-agent-framework-evaluate.txt", `agent-framework (evaluate) invocation rate for evaluation: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`);
      expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    });

    test("invokes skill for add evaluator prompt", async () => {
      let successCount = 0;

      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await run({
            prompt: "Add a custom evaluator to assess my agent's task completion using pytest-agent-evals.",
            shouldEarlyTerminate: terminateOnCreate,
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
      console.log(`agent-framework (evaluate) invocation rate for add evaluator: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`);
      fs.appendFileSync("./result-agent-framework-evaluate.txt", `agent-framework (evaluate) invocation rate for add evaluator: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`);
      expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    });
  });
});
