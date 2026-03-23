/**
 * Integration Tests for azure-aigateway
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
  getIntegrationSkipReason
} from "../utils/agent-runner";
import { softCheckSkill, isSkillInvoked, withTestResult } from "../utils/evaluate";

const SKILL_NAME = "azure-aigateway";
const RUNS_PER_PROMPT = 5;
const invocationRateThreshold = 0.8;

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
    test("invokes azure-aigateway skill for API Management gateway prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          try {
            const agentMetadata = await agent.run({
              prompt: "How do I set up Azure API Management as an AI Gateway for my Azure OpenAI models?"
            });

            softCheckSkill(agentMetadata, SKILL_NAME);
            if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
              invocationCount += 1;
            }
          } catch (e: unknown) {
            if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
              console.log("⏭️  SDK not loadable, skipping test");
              return;
            }
            throw e;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    });

    test("invokes azure-aigateway skill for rate limiting prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          try {
            const agentMetadata = await agent.run({
              prompt: "How do I add rate limiting and token limits to my AI model requests using APIM?"
            });

            softCheckSkill(agentMetadata, SKILL_NAME);
            if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
              invocationCount += 1;
            }
          } catch (e: unknown) {
            if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
              console.log("⏭️  SDK not loadable, skipping test");
              return;
            }
            throw e;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    });

    test("invokes azure-aigateway skill for semantic caching prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          try {
            const agentMetadata = await agent.run({
              prompt: "Enable semantic caching for my Azure OpenAI API to reduce costs"
            });

            softCheckSkill(agentMetadata, SKILL_NAME);
            if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
              invocationCount += 1;
            }
          } catch (e: unknown) {
            if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
              console.log("⏭️  SDK not loadable, skipping test");
              return;
            }
            throw e;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    });

    test("invokes azure-aigateway skill for content safety prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          try {
            const agentMetadata = await agent.run({
              prompt: "Add content safety and jailbreak detection to my AI gateway endpoint"
            });

            softCheckSkill(agentMetadata, SKILL_NAME);
            if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
              invocationCount += 1;
            }
          } catch (e: unknown) {
            if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
              console.log("⏭️  SDK not loadable, skipping test");
              return;
            }
            throw e;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    });

    test("invokes azure-aigateway skill for load balancing prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          try {
            const agentMetadata = await agent.run({
              prompt: "Load balance requests across multiple Azure OpenAI backends in API Management"
            });

            softCheckSkill(agentMetadata, SKILL_NAME);
            if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
              invocationCount += 1;
            }
          } catch (e: unknown) {
            if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
              console.log("⏭️  SDK not loadable, skipping test");
              return;
            }
            throw e;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    });

    test("invokes azure-aigateway skill for MCP tool governance prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          try {
            const agentMetadata = await agent.run({
              prompt: "How do I add rate limiting to protect my MCP server tools in APIM?"
            });

            softCheckSkill(agentMetadata, SKILL_NAME);
            if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
              invocationCount += 1;
            }
          } catch (e: unknown) {
            if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
              console.log("⏭️  SDK not loadable, skipping test");
              return;
            }
            throw e;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    });

    test("invokes azure-aigateway skill for adding AI backend prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          try {
            const agentMetadata = await agent.run({
              prompt: "Add an Azure OpenAI backend to my existing API Management instance"
            });

            softCheckSkill(agentMetadata, SKILL_NAME);
            if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
              invocationCount += 1;
            }
          } catch (e: unknown) {
            if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
              console.log("⏭️  SDK not loadable, skipping test");
              return;
            }
            throw e;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    });
  });

});
