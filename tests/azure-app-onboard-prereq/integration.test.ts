/**
 * Integration Tests for azure-app-onboard-prereq — Skill Invocation
 *
 * Verifies the skill is correctly routed for repo-readiness prompts.
 * Functional, negative, and session lifecycle tests are in separate files
 * for parallel execution via Jest workers.
 *
 * @see integration-functional.test.ts  — happy-path + EOL scenarios
 * @see integration-negative.test.ts    — broken/unsupported/security repos
 * @see integration-session.test.ts     — session creation, resume, zero-code-path
 *
 * Prerequisites: npm install -g @github/copilot-cli && copilot auth
 */

import {
  SKILL_NAME,
  setupIntegrationSuite,
  isSkillInvoked,
  softCheckSkill,
  shouldEarlyTerminateForSkillInvocation,
  useAgentRunner,
} from "./prereq-test-helpers";

const { describeIntegration } = setupIntegrationSuite();

describeIntegration(`${SKILL_NAME} - Integration Tests (invocation)`, () => {
  const agent = useAgentRunner();

  test("invokes azure-app-onboard-prereq skill for repo-readiness prompt", async () => {
    try {
      const agentMetadata = await agent.run({
        prompt: "Scan my repo and tell me if my project can be deployed to Azure",
        nonInteractive: true,
        shouldEarlyTerminate: (metadata) =>
          shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME),
      });

      softCheckSkill(agentMetadata, SKILL_NAME);
      expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
    } catch (e: unknown) {
      if (
        e instanceof Error &&
        e.message?.includes("Failed to load @github/copilot-sdk")
      ) {
        console.log("⏭️  SDK not loadable, skipping test");
        return;
      }
      throw e;
    }
  });
});
