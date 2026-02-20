/**
 * Integration Tests for azure-hosted-copilot-sdk
 * 
 * Tests skill behavior with a real Copilot agent session.
 * 
 * Two test categories:
 * 1. Skill invocation rate — measures how often the correct skill is selected (may be <60% initially)
 * 2. Content quality — verifies agent output contains correct patterns regardless of skill routing
 * 
 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 */

import {
  useAgentRunner,
  isSkillInvoked,
  doesAssistantMessageIncludeKeyword,
  shouldSkipIntegrationTests,
  getIntegrationSkipReason
} from "../utils/agent-runner";
import {
  countSecretsInCode,
  countApiKeyInByomConfig
} from "../utils/regression-detectors";
import * as fs from "fs";

const SKILL_NAME = "azure-hosted-copilot-sdk";
const RUNS_PER_PROMPT = 5;
const EXPECTED_INVOCATION_RATE = 0.6; // 60% minimum invocation rate

const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

describeIntegration(`${SKILL_NAME} - Integration Tests`, () => {
  const agent = useAgentRunner();

  describe("skill-invocation", () => {
    test("invokes skill for Copilot SDK scaffold prompt", async () => {
      let successCount = 0;

      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Scaffold a new copilot-powered app using the GitHub Copilot SDK and host it on Azure",
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
      console.log(`${SKILL_NAME} invocation rate for scaffold prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`);
      fs.appendFileSync(`./result-${SKILL_NAME}.txt`, `${SKILL_NAME} invocation rate for scaffold prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`);
      expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    }, 600000);

    test("invokes skill for BYOM Azure model prompt", async () => {
      let successCount = 0;

      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Build a copilot SDK app that uses my own Azure model with bring your own model",
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
      console.log(`${SKILL_NAME} invocation rate for BYOM prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`);
      fs.appendFileSync(`./result-${SKILL_NAME}.txt`, `${SKILL_NAME} invocation rate for BYOM prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`);
      expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    }, 600000);

    test("invokes skill for copilot service prompt", async () => {
      let successCount = 0;

      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Create a new copilot SDK app and deploy it to Azure",
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
      console.log(`${SKILL_NAME} invocation rate for copilot service prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`);
      fs.appendFileSync(`./result-${SKILL_NAME}.txt`, `${SKILL_NAME} invocation rate for copilot service prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`);
      expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    }, 600000);

    test("invokes skill for self-hosted model prompt", async () => {
      let successCount = 0;

      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Set up a copilot service with BYOM and DefaultAzureCredential using my own endpoint",
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
      console.log(`${SKILL_NAME} invocation rate for self-hosted model prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`);
      fs.appendFileSync(`./result-${SKILL_NAME}.txt`, `${SKILL_NAME} invocation rate for self-hosted model prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`);
      expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    }, 600000);
  });

  describe("content-quality", () => {
    // Content tests verify the agent produces useful output regardless
    // of which skill is invoked (azure-hosted-copilot-sdk or azure-prepare)
    test("scaffold prompt mentions copilot SDK templates", async () => {
      const agentMetadata = await agent.run({
        prompt: "Scaffold a copilot-powered app using the copilot SDK and deploy it to Azure",
        nonInteractive: true,
      });

      const mentionsTemplate = doesAssistantMessageIncludeKeyword(agentMetadata, "copilot-sdk-service") ||
        doesAssistantMessageIncludeKeyword(agentMetadata, "copilot-sdk") ||
        doesAssistantMessageIncludeKeyword(agentMetadata, "Copilot SDK");
      expect(mentionsTemplate).toBe(true);
      expect(countSecretsInCode(agentMetadata)).toBe(0);
    }, 600000);

    test("BYOM prompt mentions DefaultAzureCredential", async () => {
      const agentMetadata = await agent.run({
        prompt: "Build a copilot SDK app with BYOM using my Azure model and DefaultAzureCredential for auth",
        nonInteractive: true,
      });

      const mentionsByom = doesAssistantMessageIncludeKeyword(agentMetadata, "DefaultAzureCredential") ||
        doesAssistantMessageIncludeKeyword(agentMetadata, "bearerToken") ||
        doesAssistantMessageIncludeKeyword(agentMetadata, "provider");
      expect(mentionsByom).toBe(true);
      expect(countApiKeyInByomConfig(agentMetadata)).toBe(0);
    }, 600000);
  });
});
