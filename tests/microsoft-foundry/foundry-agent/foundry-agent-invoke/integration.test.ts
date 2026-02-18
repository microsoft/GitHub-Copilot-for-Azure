/**
 * Integration Tests for invoke
 *
 * Tests skill behavior with a real Copilot agent session.
 * Requires Copilot CLI to be installed and authenticated.
 */

import {
  useAgentRunner,
  isSkillInvoked,
  doesAssistantMessageIncludeKeyword,
  shouldSkipIntegrationTests,
  getIntegrationSkipReason,
} from "../../../utils/agent-runner";

const SKILL_NAME = "microsoft-foundry";

const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();
if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

describeIntegration(`${SKILL_NAME}_ - Integration Tests`, () => {
  const agent = useAgentRunner();

  test("invokes skill for relevant prompt", async () => {
    try {
      const agentMetadata = await agent.run({
        prompt: "Send a test message to my Foundry agent"
      });

      expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
    } catch (e) {
      if (
        e instanceof Error &&
        e.message &&
        e.message.includes("Failed to load @github/copilot-sdk")
      ) {
        console.log(`⏭️  Skipping integration test: ${e.message}`);
        return;
      }
      throw e;
    }
  });

  test("response mentions agent concepts", async () => {
    try {
      const agentMetadata = await agent.run({
        prompt: "Send a test message to my Foundry agent"
      });

      expect(doesAssistantMessageIncludeKeyword(agentMetadata, "agent")).toBe(true);
    } catch (e) {
      if (
        e instanceof Error &&
        e.message &&
        e.message.includes("Failed to load @github/copilot-sdk")
      ) {
        console.log(`⏭️  Skipping integration test: ${e.message}`);
        return;
      }
      throw e;
    }
  });
});
