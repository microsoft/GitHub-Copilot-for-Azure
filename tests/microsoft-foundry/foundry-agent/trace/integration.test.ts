/**
 * Integration Tests for trace
 *
 * Tests skill behavior with a real Copilot agent session.
 * These tests require Copilot CLI to be installed and authenticated.
 */

import {
  useAgentRunner,
  isSkillInvoked,
  shouldSkipIntegrationTests
} from "../../../utils/agent-runner";

const SKILL_NAME = "microsoft-foundry";

const describeIntegration = shouldSkipIntegrationTests() ? describe.skip : describe;

describeIntegration(`${SKILL_NAME}_trace - Integration Tests`, () => {
  const agent = useAgentRunner();

  test("invokes skill for trace analysis prompt", async () => {
    const agentMetadata = await agent.run({
      prompt: "Analyze traces for my Foundry agent in App Insights"
    });

    const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
    expect(isSkillUsed).toBe(true);
  });

  test("invokes skill for failing traces prompt", async () => {
    const agentMetadata = await agent.run({
      prompt: "Find failing traces and errors for my Foundry agent"
    });

    const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
    expect(isSkillUsed).toBe(true);
  });
});
