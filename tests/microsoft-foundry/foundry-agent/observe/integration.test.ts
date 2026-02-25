/**
 * Integration Tests for observe
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

describeIntegration(`${SKILL_NAME}_observe - Integration Tests`, () => {
  const agent = useAgentRunner();

  test("invokes skill for evaluate agent prompt", async () => {
    const agentMetadata = await agent.run({
      prompt: "Evaluate my Foundry agent and check its quality"
    });

    const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
    expect(isSkillUsed).toBe(true);
  });

  test("invokes skill for agent observability prompt", async () => {
    const agentMetadata = await agent.run({
      prompt: "Set up monitoring and evaluation for my Foundry agent"
    });

    const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
    expect(isSkillUsed).toBe(true);
  });
});
