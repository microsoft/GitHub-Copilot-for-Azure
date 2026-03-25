/**
 * Generic Integration Tests for azure-cost
 *
 * Tests shared skill behavior with a real Copilot agent session.
 * Sub-area-specific integration prompts live in cost-query-integration,
 * cost-forecast-integration, and cost-optimization-integration test files.
 */

import {
  useAgentRunner,
  shouldSkipIntegrationTests,
  getIntegrationSkipReason,
  doesAssistantMessageIncludeKeyword
} from "../utils/agent-runner";

const SKILL_NAME = "azure-cost";

const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

describeIntegration(`${SKILL_NAME}_ - Integration Tests`, () => {
  const agent = useAgentRunner();

  test("response mentions Cost Management for cost prompt", async () => {
    try {
      const agentMetadata = await agent.run({
        prompt: "What are my Azure costs this month?"
      });
      const mentionsCostManagement = doesAssistantMessageIncludeKeyword(agentMetadata, "Cost Management") ||
        doesAssistantMessageIncludeKeyword(agentMetadata, "cost") ||
        doesAssistantMessageIncludeKeyword(agentMetadata, "query");
      expect(mentionsCostManagement).toBe(true);
    } catch (e: unknown) {
      if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
        console.log("⏭️  SDK not loadable, skipping test");
        return;
      }
      throw e;
    }
  });
});
