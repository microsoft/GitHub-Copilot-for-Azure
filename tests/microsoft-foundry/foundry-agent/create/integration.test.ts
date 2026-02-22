/**
 * Integration Tests for agent-framework
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
  AgentMetadata,
  getToolCalls,
  shouldSkipIntegrationTests,
  getIntegrationSkipReason,
} from "../../../utils/agent-runner";
import { softCheckSkill } from "../../../utils/evaluate";

const SKILL_NAME = "microsoft-foundry";
const RUNS_PER_PROMPT = 5;

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

describeIntegration(`${SKILL_NAME}_create - Integration Tests`, () => {
  const agent = useAgentRunner();
  describe("skill-invocation", () => {
    test("invokes skill for agent creation prompt", async () => {
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Create a new hosted agent for Foundry using Python.",
            shouldEarlyTerminate: terminateOnCreate,
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

    test("invokes skill for multi-agent workflow prompt", async () => {
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Create a LangGraph hosted agent for Foundry in Python.",
            shouldEarlyTerminate: terminateOnCreate,
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
