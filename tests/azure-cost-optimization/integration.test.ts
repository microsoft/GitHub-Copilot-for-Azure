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
  isSkillInvoked, 
  shouldSkipIntegrationTests,
  getIntegrationSkipReason,
  doesAssistantMessageIncludeKeyword
} from "../utils/agent-runner";
import * as fs from "fs";

const SKILL_NAME = "azure-cost-optimization";
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

describeIntegration(`${SKILL_NAME}_ - Integration Tests`, () => {
  const agent = useAgentRunner();

  describe("skill-invocation", () => {
    test("invokes azure-cost-optimization skill for cost savings prompt", async () => {
      let successCount = 0;
      
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "How can I reduce my Azure spending and find cost savings in my subscription?"
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
      console.log(`${SKILL_NAME} invocation rate for cost savings prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`);
      fs.appendFileSync(`./result-${SKILL_NAME}.txt`, `${SKILL_NAME} invocation rate for cost savings prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`);
      expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    });

    test("invokes azure-cost-optimization skill for orphaned resources prompt", async () => {
      let successCount = 0;
      
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Find orphaned and unused resources in my Azure subscription that I can delete"
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
      console.log(`${SKILL_NAME} invocation rate for orphaned resources prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`);
      fs.appendFileSync(`./result-${SKILL_NAME}.txt`, `${SKILL_NAME} invocation rate for orphaned resources prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`);
      expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    });

    test("invokes skill for VM rightsizing prompt", async () => {
      let successCount = 0;
      
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Rightsize my Azure VMs to reduce costs"
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
      console.log(`${SKILL_NAME} invocation rate for VM rightsizing prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`);
      fs.appendFileSync(`./result-${SKILL_NAME}.txt`, `${SKILL_NAME} invocation rate for VM rightsizing prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`);
      expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    });

    test("invokes skill for Redis cost optimization prompt", async () => {
      let successCount = 0;
      
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "How can I optimize my Azure Redis costs?"
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
      console.log(`${SKILL_NAME} invocation rate for Redis optimization prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`);
      fs.appendFileSync(`./result-${SKILL_NAME}.txt`, `${SKILL_NAME} invocation rate for Redis optimization prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`);
      expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    });

    test("invokes skill for storage cost optimization prompt", async () => {
      let successCount = 0;
      
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Find unused storage accounts to reduce my Azure costs"
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
      console.log(`${SKILL_NAME} invocation rate for storage optimization prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`);
      fs.appendFileSync(`./result-${SKILL_NAME}.txt`, `${SKILL_NAME} invocation rate for storage optimization prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`);
      expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    });
  });

  test("response mentions Cost Management for cost analysis", async () => {
    try {
      const agentMetadata = await agent.run({
        prompt: "Analyze my Azure costs and show me where I can save money"
      });

      const mentionsCostManagement = doesAssistantMessageIncludeKeyword(agentMetadata, "Cost Management") ||
                                      doesAssistantMessageIncludeKeyword(agentMetadata, "az costmanagement");
      expect(mentionsCostManagement).toBe(true);
    } catch (e: unknown) {
      if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
        console.log("⏭️  SDK not loadable, skipping test");
        return;
      }
      throw e;
    }
  });

});
