/**
 * Integration Tests for github-copilot
 *
 * Tests skill behavior with a real Copilot agent session.
 * Verifies the skill triggers on the canonical demo prompt.
 *
 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 */

import {
  run,
  isSkillInvoked,
  doesAssistantMessageIncludeKeyword,
  shouldSkipIntegrationTests,
  getIntegrationSkipReason,
} from "../utils/agent-runner";

const SKILL_NAME = "github-copilot";

const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();
if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

describeIntegration(`${SKILL_NAME} - Integration Tests`, () => {
  test("invokes skill for canonical demo prompt", async () => {
    const agentMetadata = await run({
      prompt: "Build a repo quality rater with the Copilot SDK — analyze code and give a 5-star rating.",
    });

    expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
  });

  test("response mentions SDK or extension patterns", async () => {
    const agentMetadata = await run({
      prompt: "Create a Copilot Extension that summarizes issues",
    });

    expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
    const hasSdkRef = doesAssistantMessageIncludeKeyword(agentMetadata, "preview-sdk") ||
      doesAssistantMessageIncludeKeyword(agentMetadata, "copilot-extensions");
    expect(hasSdkRef).toBe(true);
  });
});
