/**
 * Integration Tests for azure-cost-optimization
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
  shouldSkipIntegrationTests,
  getIntegrationSkipReason,
  doesAssistantMessageIncludeKeyword
} from "../utils/agent-runner";
import { shouldEarlyTerminateForSkillInvocation, softCheckSkill, isSkillInvoked } from "../utils/evaluate";

const SKILL_NAME = "azure-cost-optimization";
const RUNS_PER_PROMPT = 5;

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
    test("invokes azure-cost-optimization skill for cost savings prompt", async () => {
      let skillInvoked = false;
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "How can I reduce my Azure spending and find cost savings in my subscription?",
            shouldEarlyTerminate: (metadata) => shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME)
          });
          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) { skillInvoked = true; break; }
        } catch (e: unknown) {
          if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
            console.log("⏭️  SDK not loadable, skipping test");
            return;
          }
          throw e;
        }
      }
      expect(skillInvoked).toBe(true);
    });

    test("invokes azure-cost-optimization skill for orphaned resources prompt", async () => {
      let skillInvoked = false;
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Find orphaned and unused resources in my Azure subscription that I can delete",
            shouldEarlyTerminate: (metadata) => shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME)
          });
          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) { skillInvoked = true; break; }
        } catch (e: unknown) {
          if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
            console.log("⏭️  SDK not loadable, skipping test");
            return;
          }
          throw e;
        }
      }
      expect(skillInvoked).toBe(true);
    });

    test("invokes skill for VM rightsizing prompt", async () => {
      let skillInvoked = false;
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Rightsize my Azure VMs to reduce costs",
            shouldEarlyTerminate: (metadata) => shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME)
          });
          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) { skillInvoked = true; break; }
        } catch (e: unknown) {
          if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
            console.log("⏭️  SDK not loadable, skipping test");
            return;
          }
          throw e;
        }
      }
      expect(skillInvoked).toBe(true);
    });

    test("invokes skill for Redis cost optimization prompt", async () => {
      let skillInvoked = false;
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "How can I optimize my Azure Redis costs?",
            shouldEarlyTerminate: (metadata) => shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME)
          });
          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) { skillInvoked = true; break; }
        } catch (e: unknown) {
          if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
            console.log("⏭️  SDK not loadable, skipping test");
            return;
          }
          throw e;
        }
      }
      expect(skillInvoked).toBe(true);
    });

    test("invokes skill for storage cost optimization prompt", async () => {
      let skillInvoked = false;
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Find unused storage accounts to reduce my Azure costs",
            shouldEarlyTerminate: (metadata) => shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME)
          });
          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) { skillInvoked = true; break; }
        } catch (e: unknown) {
          if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
            console.log("⏭️  SDK not loadable, skipping test");
            return;
          }
          throw e;
        }
      }
      expect(skillInvoked).toBe(true);
    });

    test("invokes skill for AKS cost analysis add-on prompt", async () => {
      let skillInvoked = false;
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Enable AKS Cost Analysis add-on on my cluster to get namespace-level cost visibility",
            shouldEarlyTerminate: (metadata) => shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME)
          });
          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) { skillInvoked = true; break; }
        } catch (e: unknown) {
          if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
            console.log("⏭️  SDK not loadable, skipping test");
            return;
          }
          throw e;
        }
      }
      expect(skillInvoked).toBe(true);
    });

    test("invokes skill for AKS cost anomaly investigation prompt", async () => {
      let skillInvoked = false;
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Investigate a cost spike in my AKS cluster and set up a budget alert",
            shouldEarlyTerminate: (metadata) => shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME)
          });
          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) { skillInvoked = true; break; }
        } catch (e: unknown) {
          if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
            console.log("⏭️  SDK not loadable, skipping test");
            return;
          }
          throw e;
        }
      }
      expect(skillInvoked).toBe(true);
    });
  });

  test("response mentions Cost Management for cost analysis", async () => {
    try {
      const agentMetadata = await agent.run({
        prompt: "Analyze my Azure costs and show me where I can save money"
      });

      const mentionsCostManagement = doesAssistantMessageIncludeKeyword(agentMetadata, "Cost Management") ||
        doesAssistantMessageIncludeKeyword(agentMetadata, "az costmanagement");
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
