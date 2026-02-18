/**
 * Integration Tests for router
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

const SKILL_NAME = "foundry-agent";

const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();
if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

describeIntegration(`${SKILL_NAME} - Integration Tests`, () => {
  const agent = useAgentRunner();

  test("invokes skill for relevant prompt", async () => {
    const agentMetadata = await agent.run({
      prompt: "Help me build and deploy a Foundry agent"
    });

    expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
  });

  test("response mentions agent concepts", async () => {
    const agentMetadata = await agent.run({
      prompt: "Help me build and deploy a Foundry agent"
    });

    expect(doesAssistantMessageIncludeKeyword(agentMetadata, "agent")).toBe(true);
  });
});
