/**
 * Integration Tests for foundry-agent-deploy
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

const SKILL_NAME = "foundry-agent-deploy";

const describeIntegration = shouldSkipIntegrationTests() ? describe.skip : describe;

describeIntegration(`${SKILL_NAME} - Integration Tests`, () => {

  test("invokes skill for deployment prompt", async () => {
    const agentMetadata = await run({
      prompt: "Deploy my hosted agent to Azure AI Foundry"
    });

    expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
  });

  test("response mentions agent creation", async () => {
    const agentMetadata = await run({
      prompt: "Create a prompt agent with gpt-4o in Foundry"
    });

    expect(doesAssistantMessageIncludeKeyword(agentMetadata, "agent")).toBe(true);
  });
});
