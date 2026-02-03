/**
 * Integration Tests for azure-quick-review
 * 
 * Tests skill behavior with a real Copilot agent session.
 * Runs prompts multiple times to measure skill invocation rate.
 * 
 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 */

import { 
  run, 
  isSkillInvoked, 
  shouldSkipIntegrationTests,
  getIntegrationSkipReason
} from "../utils/agent-runner";
import * as fs from "fs";

const SKILL_NAME = "azure-quick-review";
const RUNS_PER_PROMPT = 5;
const EXPECTED_INVOCATION_RATE = 0.6; // 60% minimum invocation rate

// Check if integration tests should be skipped at module level
const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

// Log skip reason if skipping
if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

describeIntegration(`${SKILL_NAME} - Integration Tests`, () => {
  describe("skill-invocation", () => {
      test("invokes azure-quick-review skill for compliance assessment prompt", async () => {
      let successCount = 0;
      
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await run({
            prompt: "Run azqr to check my Azure subscription for compliance issues"
          });
          
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            successCount++;
          }
        } catch (e: any) {
          if (e.message?.includes("Failed to load @github/copilot-sdk")) {
            console.log("⏭️  SDK not loadable, skipping test");
            return;
          }
          throw e;
        }
      }
      
      const invocationRate = successCount / RUNS_PER_PROMPT;
      console.log(`${SKILL_NAME} invocation rate for compliance assessment prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`);
      fs.appendFileSync(`./result-${SKILL_NAME}.txt`, `${SKILL_NAME} invocation rate for compliance assessment prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`);
      expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    });

    test("invokes azure-quick-review skill for best practices review prompt", async () => {
      let successCount = 0;
      
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await run({
            prompt: "Assess my Azure resources against best practices using Azure Quick Review"
          });
          
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            successCount++;
          }
        } catch (e: any) {
          if (e.message?.includes("Failed to load @github/copilot-sdk")) {
            console.log("⏭️  SDK not loadable, skipping test");
            return;
          }
          throw e;
        }
      }
      
      const invocationRate = successCount / RUNS_PER_PROMPT;
      console.log(`${SKILL_NAME} invocation rate for best practices prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`);
      fs.appendFileSync(`./result-${SKILL_NAME}.txt`, `${SKILL_NAME} invocation rate for best practices prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`);
      expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    });
  });
});
