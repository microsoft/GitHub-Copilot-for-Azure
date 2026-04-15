/**
 * Integration Tests for azure-java-legacy-sdk-migration
 *
 * Tests skill invocation with Java SDK migration prompts.
 *
 * NOTE: End-to-end migration test is NOT included because the skill requires
 * a real Maven/Gradle Java project with legacy Azure SDK dependencies.
 * These tests verify that the agent correctly routes prompts to the skill.
 *
 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 */

import {
  shouldSkipIntegrationTests,
  getIntegrationSkipReason,
  useAgentRunner,
} from "../utils/agent-runner";
import { softCheckSkill, isSkillInvoked, shouldEarlyTerminateForSkillInvocation, withTestResult } from "../utils/evaluate";

const SKILL_NAME = "azure-java-legacy-sdk-migration";

const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

describeIntegration(`${SKILL_NAME}_ - Integration Tests`, () => {
  const agent = useAgentRunner();

  describe("skill-invocation", () => {
    test("invokes skill for legacy Azure Java SDK migration prompt", () => withTestResult(async () => {
      const agentMetadata = await agent.run({
        prompt: "Migrate my Java project from legacy Azure SDK (com.microsoft.azure) to modern Azure SDK (com.azure)",
        nonInteractive: true,
        followUp: ["Continue with recommended options until complete."],
        shouldEarlyTerminate: (agentMetadata) => shouldEarlyTerminateForSkillInvocation(agentMetadata, SKILL_NAME)
      });

      softCheckSkill(agentMetadata, SKILL_NAME);
      expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
    }));

    test("invokes skill for upgrading legacy Azure Java libraries prompt", () => withTestResult(async () => {
      const agentMetadata = await agent.run({
        prompt: "Upgrade legacy Azure SDKs for Java to the latest modern Azure SDK packages",
        nonInteractive: true,
        followUp: ["Continue with recommended options until complete."],
        shouldEarlyTerminate: (agentMetadata) => shouldEarlyTerminateForSkillInvocation(agentMetadata, SKILL_NAME)
      });

      softCheckSkill(agentMetadata, SKILL_NAME);
      expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
    }));
  });
});
