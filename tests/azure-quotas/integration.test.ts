/**
 * Integration Tests for azure-quotas
 *
 * Tests skill behavior with a real Copilot agent session.
 * Runs prompts multiple times to measure skill invocation rate.
 *
 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 */

import {
  useAgentRunner,
  AgentMetadata,
  doesAssistantMessageIncludeKeyword,
  shouldSkipIntegrationTests,
  getIntegrationSkipReason
} from "../utils/agent-runner";
import { softCheckSkill, isSkillInvoked, shouldEarlyTerminateForSkillInvocation } from "../utils/evaluate";

/**
 * Check if any tool call arguments contain a keyword.
 * Useful when the agent executes commands via powershell
 * rather than suggesting them in the assistant message.
 */
function doToolCallArgsIncludeKeyword(
  agentMetadata: AgentMetadata,
  keyword: string
): boolean {
  return agentMetadata.events
    .filter(event => event.type === "tool.execution_start")
    .some(event => {
      const args = JSON.stringify(event.data.arguments).toLowerCase();
      return args.includes(keyword.toLowerCase());
    });
}

const SKILL_NAME = "azure-quotas";
const RUNS_PER_PROMPT = 5;
const invocationRateThreshold = 0.8;

const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

describeIntegration(`${SKILL_NAME}_ - Integration Tests`, () => {
  const agent = useAgentRunner();

  describe("skill-invocation", () => {
    test("invokes azure-quotas skill for quota check prompt", async () => {
      let invocationCount = 0;
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "How do I check my Azure compute quota limits in East US?",
            shouldEarlyTerminate: (metadata) => shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME)
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invocationCount += 1;
          }
        } catch (e: unknown) {
          if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
            console.log("⏭️  SDK not loadable, skipping test");
            return;
          }
          throw e;
        }
      }
      expect(invocationCount / RUNS_PER_PROMPT).toBeGreaterThanOrEqual(invocationRateThreshold);
    });

    test("invokes azure-quotas skill for quota increase prompt", async () => {
      let invocationCount = 0;
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "I need to request a quota increase for VM vCPUs in my subscription",
            shouldEarlyTerminate: (metadata) => shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME)
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invocationCount += 1;
          }
        } catch (e: unknown) {
          if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
            console.log("⏭️  SDK not loadable, skipping test");
            return;
          }
          throw e;
        }
      }
      expect(invocationCount / RUNS_PER_PROMPT).toBeGreaterThanOrEqual(invocationRateThreshold);
    });
  });

  describe("azure-quotas", () => {
    test("provides quota check commands for compute resources", async () => {
      let agentMetadata;
      try {
        agentMetadata = await agent.run({
          prompt: "Check my Azure VM quota limits and current usage in East US"
        });
      } catch (e: unknown) {
        if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
          console.log("⏭️  SDK not loadable, skipping test");
          return;
        }
        throw e;
      }

      const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
      // Agent may suggest CLI commands in the response or execute them via powershell tool
      const mentionsQuotaCmd = doesAssistantMessageIncludeKeyword(agentMetadata, "az quota")
        || doToolCallArgsIncludeKeyword(agentMetadata, "az quota");
      const mentionsScope = doesAssistantMessageIncludeKeyword(agentMetadata, "/subscriptions/")
        || doToolCallArgsIncludeKeyword(agentMetadata, "/subscriptions/");

      expect(isSkillUsed).toBe(true);
      expect(mentionsQuotaCmd).toBe(true);
      expect(mentionsScope).toBe(true);
    });

    test("provides quota increase workflow", async () => {
      let agentMetadata;
      try {
        agentMetadata = await agent.run({
          prompt: "How do I request an Azure quota increase for Standard_DS_v3 VMs?"
        });
      } catch (e: unknown) {
        if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
          console.log("⏭️  SDK not loadable, skipping test");
          return;
        }
        throw e;
      }

      const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
      const mentionsUpdate = doesAssistantMessageIncludeKeyword(agentMetadata, "az quota update");

      expect(isSkillUsed).toBe(true);
      expect(mentionsUpdate).toBe(true);
    });

    test("handles region comparison query", async () => {
      let agentMetadata;
      try {
        agentMetadata = await agent.run({
          prompt: "Compare Azure compute quota availability across East US, West US 2, and Central US"
        });
      } catch (e: unknown) {
        if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
          console.log("⏭️  SDK not loadable, skipping test");
          return;
        }
        throw e;
      }

      const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
      // Agent may suggest CLI commands in the response or execute them via powershell tool
      const mentionsQuotaCmd = doesAssistantMessageIncludeKeyword(agentMetadata, "az quota")
        || doToolCallArgsIncludeKeyword(agentMetadata, "az quota");

      expect(isSkillUsed).toBe(true);
      expect(mentionsQuotaCmd).toBe(true);
    });

    test("mentions extension installation requirement", async () => {
      let agentMetadata;
      try {
        agentMetadata = await agent.run({
          prompt: "What are my Azure service quotas and how do I check them?"
        });
      } catch (e: unknown) {
        if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
          console.log("⏭️  SDK not loadable, skipping test");
          return;
        }
        throw e;
      }

      const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
      const mentionsExtension = doesAssistantMessageIncludeKeyword(agentMetadata, "az extension add");

      expect(isSkillUsed).toBe(true);
      expect(mentionsExtension).toBe(true);
    });
  });
});
