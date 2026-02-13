/**
 * Integration Tests for foundry-agent-package
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

const SKILL_NAME = "package";

const describeIntegration = shouldSkipIntegrationTests() ? describe.skip : describe;

describeIntegration(`${SKILL_NAME} - Integration Tests`, () => {

  test("invokes skill for containerization prompt", async () => {
    const agentMetadata = await run({
      prompt: "Help me containerize my Python agent project for Azure AI Foundry"
    });

    expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
  });

  test("response mentions Dockerfile", async () => {
    const agentMetadata = await run({
      prompt: "Create a Docker image for my Node.js hosted agent"
    });

    expect(doesAssistantMessageIncludeKeyword(agentMetadata, "Dockerfile")).toBe(true);
  });
});
