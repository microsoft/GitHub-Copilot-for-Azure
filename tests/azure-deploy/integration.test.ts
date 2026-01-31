/**
 * Integration Tests for azure-deploy
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
  getIntegrationSkipReason,
  hasDeployLinks
} from "../utils/agent-runner";
import * as fs from "fs";

const SKILL_NAME = "azure-deploy";
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
  
  test("invokes azure-deploy skill for deployment prompt", async () => {
    let successCount = 0;
    
    for (let i = 0; i < RUNS_PER_PROMPT; i++) {
      try {
        const agentMetadata = await run({
          prompt: "Run azd up to deploy my already-prepared app to Azure"
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
    console.log(`${SKILL_NAME} invocation rate for deployment prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`);
    fs.appendFileSync(`./tests/result-${SKILL_NAME}.txt`, `${SKILL_NAME} invocation rate for deployment prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`);
    expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
  });

  test("invokes azure-deploy skill for publish to Azure prompt", async () => {
    let successCount = 0;
    
    for (let i = 0; i < RUNS_PER_PROMPT; i++) {
      try {
        const agentMetadata = await run({
          prompt: "Publish my web app to Azure and configure the environment"
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
    console.log(`${SKILL_NAME} invocation rate for publish prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`);
    fs.appendFileSync(`./tests/result-${SKILL_NAME}.txt`, `${SKILL_NAME} invocation rate for publish prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`);
    expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
  });

  // Need to be logged into azd for these tests. 
  // azd auth login
  test('creates whiteboard application and deploys to Azure', async () => {
    const agentMetadata = await run({
      prompt: 'Create a whiteboard application and deploy to azure',
      nonInteractive: true
    });

    const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
    const containsDeployLinks = hasDeployLinks(agentMetadata);

    expect(isSkillUsed).toBe(true);
    expect(containsDeployLinks).toBe(true);
  });

  test('creates discussion board and deploys to Azure', async () => {
    const agentMetadata = await run({
      prompt: 'Create a discussion board and deploy to Azure',
      nonInteractive: true
    });

    const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
    const containsDeployLinks = hasDeployLinks(agentMetadata);

    expect(isSkillUsed).toBe(true);
    expect(containsDeployLinks).toBe(true);
  });

  test('creates todo list with frontend and API and deploys to Azure', async () => {
    const agentMetadata = await run({
      prompt: 'Create a todo list with frontend and API and deploy to Azure',
      nonInteractive: true
    });

    const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
    const containsDeployLinks = hasDeployLinks(agentMetadata);

    expect(isSkillUsed).toBe(true);
    expect(containsDeployLinks).toBe(true);
  });
});
