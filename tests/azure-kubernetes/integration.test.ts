/**
 * Integration Tests for azure-kubernetes
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
  doesAssistantMessageIncludeKeyword,
  shouldSkipIntegrationTests,
  getIntegrationSkipReason
} from "../utils/agent-runner";
import { softCheckSkill } from "../utils/evaluate";

const SKILL_NAME = "azure-kubernetes";
const RUNS_PER_PROMPT = 2;

const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

describeIntegration(`${SKILL_NAME}_ - Integration Tests`, () => {
  const agent = useAgentRunner();

  test("invokes azure-kubernetes skill for AKS cluster creation prompt", async () => {
    for (let i = 0; i < RUNS_PER_PROMPT; i++) {
      try {
        const agentMetadata = await agent.run({
          prompt: "Help me create a production-ready AKS cluster with best practices"
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
      } catch (e: unknown) {
        if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
          console.log("⏭️  SDK not loadable, skipping test");
          return;
        }
        throw e;
      }
    }
  });

  test("responds with Day-0 vs Day-1 guidance", async () => {
    for (let i = 0; i < RUNS_PER_PROMPT; i++) {
      try {
        const agentMetadata = await agent.run({
          prompt: "What Day-0 decisions do I need to make for AKS?"
        });

        const hasDay0Content = doesAssistantMessageIncludeKeyword(agentMetadata, "tier") ||
                               doesAssistantMessageIncludeKeyword(agentMetadata, "networking") ||
                               doesAssistantMessageIncludeKeyword(agentMetadata, "API server");
        expect(hasDay0Content).toBe(true);
      } catch (e: unknown) {
        if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
          console.log("⏭️  SDK not loadable, skipping test");
          return;
        }
        throw e;
      }
    }
  });

  test("recommends AKS Automatic vs Standard appropriately", async () => {
    for (let i = 0; i < RUNS_PER_PROMPT; i++) {
      try {
        const agentMetadata = await agent.run({
          prompt: "Should I use AKS Automatic or Standard for my production workload?"
        });

        const hasSkuGuidance = doesAssistantMessageIncludeKeyword(agentMetadata, "Automatic") ||
                               doesAssistantMessageIncludeKeyword(agentMetadata, "Standard");
        expect(hasSkuGuidance).toBe(true);
      } catch (e: unknown) {
        if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
          console.log("⏭️  SDK not loadable, skipping test");
          return;
        }
        throw e;
      }
    }
  });

  test("provides networking recommendations", async () => {
    for (let i = 0; i < RUNS_PER_PROMPT; i++) {
      try {
        const agentMetadata = await agent.run({
          prompt: "How should I configure AKS networking for pods that need VNet-routable IPs?"
        });

        const hasNetworkingContent = doesAssistantMessageIncludeKeyword(agentMetadata, "CNI") ||
                                     doesAssistantMessageIncludeKeyword(agentMetadata, "overlay") ||
                                     doesAssistantMessageIncludeKeyword(agentMetadata, "VNet");
        expect(hasNetworkingContent).toBe(true);
      } catch (e: unknown) {
        if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
          console.log("⏭️  SDK not loadable, skipping test");
          return;
        }
        throw e;
      }
    }
  });

  test("covers security best practices", async () => {
    for (let i = 0; i < RUNS_PER_PROMPT; i++) {
      try {
        const agentMetadata = await agent.run({
          prompt: "What security best practices should I follow for AKS?"
        });

        const hasSecurityContent = doesAssistantMessageIncludeKeyword(agentMetadata, "identity") ||
                                   doesAssistantMessageIncludeKeyword(agentMetadata, "Entra") ||
                                   doesAssistantMessageIncludeKeyword(agentMetadata, "workload") ||
                                   doesAssistantMessageIncludeKeyword(agentMetadata, "Key Vault");
        expect(hasSecurityContent).toBe(true);
      } catch (e: unknown) {
        if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
          console.log("⏭️  SDK not loadable, skipping test");
          return;
        }
        throw e;
      }
    }
  });
});
