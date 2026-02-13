/**
 * Integration Tests for foundry-agent-invoke
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

const SKILL_NAME = "invoke";

const describeIntegration = shouldSkipIntegrationTests() ? describe.skip : describe;

describeIntegration(`${SKILL_NAME} - Integration Tests`, () => {

  test("invokes skill for agent invocation prompt", async () => {
    const agentMetadata = await run({
      prompt: "Send a test message to my Foundry agent"
    });

    expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
  });

  test("response mentions agent invocation", async () => {
    const agentMetadata = await run({
      prompt: "Test my deployed agent in Azure AI Foundry"
    });

    expect(doesAssistantMessageIncludeKeyword(agentMetadata, "agent")).toBe(true);
  });
});
