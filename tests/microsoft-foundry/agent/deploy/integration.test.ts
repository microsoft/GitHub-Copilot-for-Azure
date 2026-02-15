/**
 * Integration Tests for deploy
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

const SKILL_NAME = "deploy";

const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();
if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

describeIntegration(`${SKILL_NAME} - Integration Tests`, () => {
  const agent = useAgentRunner();

  test("invokes skill for relevant prompt", async () => {
    let agentMetadata;
    try {
      agentMetadata = await agent.run({
        prompt: "Deploy my agent to Azure AI Foundry"
      });
    } catch (e) {
      if (e instanceof Error && e.message.includes("Failed to load @github/copilot-sdk")) {
        console.log(`⏭️  Skipping integration test: ${e.message}`);
        return;
      }
      throw e;
    }

    expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
  });

  test("response mentions agent concepts", async () => {
    let agentMetadata;
    try {
      agentMetadata = await agent.run({
        prompt: "Deploy my agent to Azure AI Foundry"
      });
    } catch (e) {
      if (e instanceof Error && e.message.includes("Failed to load @github/copilot-sdk")) {
        console.log(`⏭️  Skipping integration test: ${e.message}`);
        return;
      }
      throw e;
    }

    expect(doesAssistantMessageIncludeKeyword(agentMetadata, "agent")).toBe(true);
  });
});
