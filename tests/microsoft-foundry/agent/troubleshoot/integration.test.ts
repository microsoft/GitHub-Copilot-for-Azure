/**
 * Integration Tests for troubleshoot
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

const SKILL_NAME = "troubleshoot";

const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();
if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

describeIntegration(`${SKILL_NAME} - Integration Tests`, () => {
  const agent = useAgentRunner();

  test("invokes skill for relevant prompt", async () => {
    try {
      const agentMetadata = await agent.run({
        prompt: "Troubleshoot my Foundry agent that is returning errors"
      });

      expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
    } catch (e) {
      if (e instanceof Error && e.message.includes("Failed to load @github/copilot-sdk")) {
        console.log("⏭️  Skipping integration test due to Copilot SDK load failure:", e.message);
        return;
      }
      throw e;
    }
  });

  test("response mentions agent concepts", async () => {
    try {
      const agentMetadata = await agent.run({
        prompt: "Troubleshoot my Foundry agent that is returning errors"
      });

      expect(doesAssistantMessageIncludeKeyword(agentMetadata, "agent")).toBe(true);
    } catch (e) {
      if (e instanceof Error && e.message.includes("Failed to load @github/copilot-sdk")) {
        console.log("⏭️  Skipping integration test due to Copilot SDK load failure:", e.message);
        return;
      }
      throw e;
    }
  });
});
