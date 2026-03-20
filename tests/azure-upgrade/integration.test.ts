/**
 * Integration Tests for azure-upgrade
 *
 * Tests skill invocation with migration-related prompts.
 * 
 * NOTE: End-to-end migration test is NOT included due to test environment limitations.
 * 
 * The azure-upgrade skill's core command requires an existing source Consumption function app:
 *   az functionapp flex-migration start \
 *     --source-name <SOURCE_APP_NAME> \
 *     --source-resource-group <SOURCE_RESOURCE_GROUP> \
 *     --name <NEW_APP_NAME> \
 *     --resource-group <RESOURCE_GROUP>
 * 
 * Challenge: Creating a valid Consumption function app in test environments is blocked by:
 * - Azure Policy requirements (no shared key access on storage accounts)
 * - Complex identity-based storage configuration (RBAC, managed identity setup)
 * - Deployment failures when using standard `az functionapp create` commands

 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 */

import {
  shouldSkipIntegrationTests,
  getIntegrationSkipReason,
  useAgentRunner,
} from "../utils/agent-runner";
import { softCheckSkill, isSkillInvoked, shouldEarlyTerminateForSkillInvocation } from "../utils/evaluate";

const SKILL_NAME = "azure-upgrade";

// Check if integration tests should be skipped at module level
const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

// Log skip reason if skipping
if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

describeIntegration(`${SKILL_NAME}_ - Integration Tests`, () => {
  const agent = useAgentRunner();

  describe("skill-invocation", () => {
    test("invokes azure-upgrade skill for Functions Consumption to Flex migration prompt", async () => {
      try {
        const agentMetadata = await agent.run({
          prompt: "Migrate my Azure Functions app from Consumption to Flex Consumption plan",
          nonInteractive: true,
          followUp: ["Go with recommended options."],
          shouldEarlyTerminate: (agentMetadata) => shouldEarlyTerminateForSkillInvocation(agentMetadata, SKILL_NAME)
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
      } catch (e: unknown) {
        if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
          console.log("⏭️  SDK not loadable, skipping test");
          return;
        }
        throw e;
      }
    });

    test("invokes azure-upgrade skill for upgrading Functions plan prompt", async () => {
      try {
        const agentMetadata = await agent.run({
          prompt: "Upgrade my Azure Functions hosting plan to Flex Consumption",
          nonInteractive: true,
          followUp: ["Go with recommended options."],
          shouldEarlyTerminate: (agentMetadata) => shouldEarlyTerminateForSkillInvocation(agentMetadata, SKILL_NAME)
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
      } catch (e: unknown) {
        if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
          console.log("⏭️  SDK not loadable, skipping test");
          return;
        }
        throw e;
      }
    });
  });

});
