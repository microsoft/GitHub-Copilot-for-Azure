/**
 * Integration Tests for deploy-model (router)
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
import { softCheckSkill } from "../../../../utils/evaluate";

const SKILL_NAME = "microsoft-foundry";
const RUNS_PER_PROMPT = 5;

const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

describeIntegration(`${SKILL_NAME}_deploy-model - Integration Tests`, () => {
  const agent = useAgentRunner();
  describe("skill-invocation", () => {
    test("invokes skill for simple model deployment prompt", async () => {
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Deploy gpt-4o model to my Azure project"
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

    test("invokes skill for capacity discovery prompt", async () => {
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Where can I deploy gpt-4o? Check capacity across regions"
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

    test("invokes skill for customized deployment prompt", async () => {
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Deploy gpt-4o with custom SKU and capacity settings"
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
  });
});
