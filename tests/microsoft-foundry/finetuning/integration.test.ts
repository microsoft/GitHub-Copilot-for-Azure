/**
 * Integration Tests for finetuning sub-skill
 *
 * Tests skill behavior with a real Copilot agent session.
 * Requires Copilot CLI to be installed and authenticated.
 */

import {
  useAgentRunner,
  doesAssistantMessageIncludeKeyword,
  shouldSkipIntegrationTests,
  getIntegrationSkipReason,
} from "../../utils/agent-runner";
import { isSkillInvoked, withTestResult } from "../../utils/evaluate";

const SKILL_NAME = "microsoft-foundry";

const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();
if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

describeIntegration(`${SKILL_NAME}_ - Integration Tests`, () => {
  const agent = useAgentRunner();

  test("invokes skill for fine-tuning prompt", () =>
    withTestResult(async () => {
      const agentMetadata = await agent.run({
        prompt: "Help me fine-tune gpt-4.1-mini on my dataset",
        shouldEarlyTerminate: (metadata) =>
          isSkillInvoked(metadata, SKILL_NAME) ||
          doesAssistantMessageIncludeKeyword(metadata, "fine-tun") ||
          doesAssistantMessageIncludeKeyword(metadata, "training"),
      });

      // Skill should be invoked OR response should mention fine-tuning
      const skillInvoked = isSkillInvoked(agentMetadata, SKILL_NAME);
      const mentionsFT = doesAssistantMessageIncludeKeyword(agentMetadata, "fine-tun") ||
        doesAssistantMessageIncludeKeyword(agentMetadata, "training");
      expect(skillInvoked || mentionsFT).toBe(true);
    }));

  test("response mentions fine-tuning concepts", () =>
    withTestResult(async () => {
      const agentMetadata = await agent.run({
        prompt: "Help me fine-tune gpt-4.1-mini on my dataset",
        shouldEarlyTerminate: (metadata) =>
          isSkillInvoked(metadata, SKILL_NAME) &&
          doesAssistantMessageIncludeKeyword(metadata, "training"),
      });

      expect(
        doesAssistantMessageIncludeKeyword(agentMetadata, "training")
      ).toBe(true);
    }));

  test("invokes skill for RFT grader prompt", () =>
    withTestResult(async () => {
      const agentMetadata = await agent.run({
        prompt:
          "Submit a reinforcement fine-tuning job with a Python grader",
        shouldEarlyTerminate: (metadata) =>
          isSkillInvoked(metadata, SKILL_NAME),
      });

      expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
    }));

  test("invokes skill for SFT distillation prompt", () =>
    withTestResult(async () => {
      const agentMetadata = await agent.run({
        prompt: "Distill gpt-4.1-mini into nano using supervised fine-tuning",
        shouldEarlyTerminate: (metadata) =>
          isSkillInvoked(metadata, SKILL_NAME),
      });

      expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
    }));
});
