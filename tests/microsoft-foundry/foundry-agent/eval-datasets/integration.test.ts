/**
 * Integration Tests for eval-datasets
 */

import {
  useAgentRunner,
  shouldSkipIntegrationTests
} from "../../../utils/agent-runner";
import { isSkillInvoked } from "../../../utils/evaluate";

const SKILL_NAME = "microsoft-foundry";

const describeIntegration = shouldSkipIntegrationTests() ? describe.skip : describe;

describeIntegration(`${SKILL_NAME}_eval-datasets - Integration Tests`, () => {
  const agent = useAgentRunner();

  test("invokes skill for trace-to-dataset prompt", async () => {
    const agentMetadata = await agent.run({
      prompt: "Create an evaluation dataset from my Foundry agent traces"
    });

    expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
  });

  test("invokes skill for dataset versioning prompt", async () => {
    const agentMetadata = await agent.run({
      prompt: "Version my Foundry evaluation dataset and compare regressions"
    });

    expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
  });
});
