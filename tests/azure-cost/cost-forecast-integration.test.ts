/**
 * Integration Tests for azure-cost (forecast area)
 *
 * Migrated from azure-cost-forecast to the unified azure-cost skill.
 */

import {
  useAgentRunner,
  shouldSkipIntegrationTests,
  getIntegrationSkipReason,
  doesAssistantMessageIncludeKeyword
} from "../utils/agent-runner";
import { softCheckSkill } from "../utils/evaluate";

const SKILL_NAME = "azure-cost";
const RUNS_PER_PROMPT = 5;

const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

describeIntegration(`${SKILL_NAME} - Integration Tests`, () => {
  const agent = useAgentRunner();

  describe("skill-invocation", () => {
    test("invokes azure-cost skill for future cost prompt", async () => {
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "What will my Azure costs be next month?"
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

    test("invokes azure-cost skill for quarterly forecast prompt", async () => {
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Forecast my Azure spending for the rest of the quarter"
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

    test("invokes skill for subscription cost prediction prompt", async () => {
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Predict my subscription costs for the next 90 days"
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

  test("response contains forecast-related keywords", async () => {
    try {
      const agentMetadata = await agent.run({
        prompt: "What will my Azure costs be next month?"
      });
      const hasForecast = doesAssistantMessageIncludeKeyword(agentMetadata, "forecast") ||
        doesAssistantMessageIncludeKeyword(agentMetadata, "projected") ||
        doesAssistantMessageIncludeKeyword(agentMetadata, "estimate");
      expect(hasForecast).toBe(true);
    } catch (e: unknown) {
      if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
        console.log("⏭️  SDK not loadable, skipping test");
        return;
      }
      throw e;
    }
  });

  test("response mentions Cost Management for forecast", async () => {
    try {
      const agentMetadata = await agent.run({
        prompt: "Forecast my Azure spending for next quarter"
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
