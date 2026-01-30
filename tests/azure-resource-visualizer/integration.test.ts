/**
 * Integration Tests for azure-resource-visualizer
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

const SKILL_NAME = "azure-resource-visualizer";
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
  
  test("invokes azure-resource-visualizer skill for architecture diagram prompt", async () => {
    let successCount = 0;
    
    for (let i = 0; i < RUNS_PER_PROMPT; i++) {
      try {
        const agentMetadata = await run({
          prompt: "Generate a Mermaid diagram showing my Azure resource group architecture"
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
    console.log(`${SKILL_NAME} invocation rate for architecture diagram prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`);
    fs.appendFileSync(`./tests/result-${SKILL_NAME}.txt`, `${SKILL_NAME} invocation rate for architecture diagram prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`);
    expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
  });

  test("invokes azure-resource-visualizer skill for resource relationships prompt", async () => {
    let successCount = 0;
    
    for (let i = 0; i < RUNS_PER_PROMPT; i++) {
      try {
        const agentMetadata = await run({
          prompt: "Visualize how my Azure resources are connected and show their relationships"
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
    console.log(`${SKILL_NAME} invocation rate for resource relationships prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`);
    fs.appendFileSync(`./tests/result-${SKILL_NAME}.txt`, `${SKILL_NAME} invocation rate for resource relationships prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`);
    expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
  });

});
