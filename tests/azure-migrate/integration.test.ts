/**
 * Integration Tests for azure-migrate
 * 
 * Tests skill behavior with a real Copilot agent session.
 * Runs prompts multiple times to measure skill invocation rate.
 * 
 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 */

import {
  shouldSkipIntegrationTests,
  getIntegrationSkipReason,
  useAgentRunner,
  isSkillInvoked,
  areToolCallsSuccess,
  doesAssistantMessageIncludeKeyword
} from "../utils/agent-runner";
import { cloneRepo } from "../utils/git-clone";
import { softCheckSkill } from "../utils/evaluate";

const SKILL_NAME = "azure-migrate";
const RUNS_PER_PROMPT = 5;
const FACE_BLUR_REPO = "https://github.com/aws-samples/serverless-face-blur-service.git";

const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;
const migrationTestTimeoutMs = 2700000;
const FOLLOW_UP_PROMPT = ["Go with recommended options and proceed with Azure migration."];

describeIntegration(`${SKILL_NAME}_ - Integration Tests`, () => {
  const agent = useAgentRunner();

  describe("skill-invocation", () => {
    test("invokes azure-migrate skill for Lambda migration prompt", async () => {
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Migrate my AWS Lambda functions to Azure Functions"
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
        } catch (e: unknown) {
          if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
            console.log("⏭️  SDK not loadable, skipping test");
            return;
          }
          throw e;
        }
      }
    });

    test("invokes azure-migrate skill for assessment prompt", async () => {
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Assess my AWS Lambda project for Azure migration"
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
        } catch (e: unknown) {
          if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
            console.log("⏭️  SDK not loadable, skipping test");
            return;
          }
          throw e;
        }
      }
    });
  });

  describe("brownfield-lambda", () => {
    test("migrates serverless-face-blur-service Lambda to Azure", async () => {
      const agentMetadata = await agent.run({
        setup: async (workspace: string) => {
          await cloneRepo({
            repoUrl: FACE_BLUR_REPO,
            targetDir: workspace,
            depth: 1,
          });
        },
        prompt: "Migrate this Lambda to Azure",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT,
      });

      const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
      expect(isSkillUsed).toBe(true);

      const hasExpectedContent = doesAssistantMessageIncludeKeyword(
        agentMetadata,
        "migration"
      );
      expect(hasExpectedContent).toBe(true);
    }, migrationTestTimeoutMs);
  });
});
