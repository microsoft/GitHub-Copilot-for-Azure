/**
 * Integration Tests for foundry-agent-router (microsoft-foundry/agent)
 *
 * Tests skill behavior with a real Copilot agent session.
 * Requires Copilot CLI to be installed and authenticated.
 */

import {
  run,
  isSkillInvoked,
  doesAssistantMessageIncludeKeyword,
  shouldSkipIntegrationTests
} from "../utils/agent-runner";

const SKILL_NAME = "agent";

const describeIntegration = shouldSkipIntegrationTests() ? describe.skip : describe;

describeIntegration(`${SKILL_NAME} - Integration Tests`, () => {

  test("invokes skill for agent lifecycle prompt", async () => {
    const agentMetadata = await run({
      prompt: "Help me build and deploy a Foundry agent"
    });

    expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
  });

  test("response mentions agent concepts", async () => {
    const agentMetadata = await run({
      prompt: "Walk me through the Foundry agent lifecycle"
    });

    expect(doesAssistantMessageIncludeKeyword(agentMetadata, "agent")).toBe(true);
  });
});
