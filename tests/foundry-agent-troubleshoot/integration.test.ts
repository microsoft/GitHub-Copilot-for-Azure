/**
 * Integration Tests for foundry-agent-troubleshoot
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

const SKILL_NAME = "troubleshoot";

const describeIntegration = shouldSkipIntegrationTests() ? describe.skip : describe;

describeIntegration(`${SKILL_NAME} - Integration Tests`, () => {

  test("invokes skill for troubleshooting prompt", async () => {
    const agentMetadata = await run({
      prompt: "Troubleshoot my Foundry agent that is returning errors"
    });

    expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
  });

  test("response mentions diagnostics concepts", async () => {
    const agentMetadata = await run({
      prompt: "Debug my hosted agent in Azure AI Foundry"
    });

    expect(doesAssistantMessageIncludeKeyword(agentMetadata, "agent")).toBe(true);
  });
});
