/**
 * Integration Tests for azure-resource-visualizer
 * 
 * Tests skill behavior with a real Copilot agent session.
 * Runs prompts multiple times to measure skill invocation rate,
 * and end-to-end workflows with nonInteractive mode and follow-up prompts.
 * 
 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 * 3. az login (for Azure resource access)
 */

import {
  useAgentRunner,
  shouldSkipIntegrationTests,
  getIntegrationSkipReason
} from "../utils/agent-runner";
import { softCheckSkill, isSkillInvoked, doesWorkspaceFileIncludePattern } from "../utils/evaluate";

const SKILL_NAME = "azure-resource-visualizer";
const RUNS_PER_PROMPT = 5;

// Check if integration tests should be skipped at module level
const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

// Log skip reason if skipping
if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;
const visualizerTestTimeoutMs = 1800000;

describeIntegration(`${SKILL_NAME}_ - Integration Tests`, () => {
  const agent = useAgentRunner();

  describe("skill-invocation", () => {
    test("invokes azure-resource-visualizer skill for architecture diagram prompt", async () => {
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Generate a Mermaid diagram showing my Azure resource group architecture",
            shouldEarlyTerminate: (metadata) => isSkillInvoked(metadata, SKILL_NAME)
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

    test("invokes azure-resource-visualizer skill for resource relationships prompt", async () => {
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Visualize how my Azure resources are connected and show their relationships",
            shouldEarlyTerminate: (metadata) => isSkillInvoked(metadata, SKILL_NAME)
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

  // Need to be logged into az for these tests.
  // az login
  const FOLLOW_UP_PROMPT = ["Go with recommended options."];

  describe("resource-group-visualization", () => {
    test("generates architecture diagram for a resource group", async () => {
      let workspacePath: string | undefined;

      const agentMetadata = await agent.run({
        prompt: "Generate a Mermaid diagram showing my Azure resource group architecture. Save the diagram to an architecture.md file in the current working directory.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT,
        setup: async (workspace: string) => {
          workspacePath = workspace;
        }
      });

      const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
      expect(workspacePath).toBeDefined();
      const hasDiagramFile = doesWorkspaceFileIncludePattern(workspacePath!, /graph\s+(TB|LR)/i, /architecture.*\.md$/i);

      expect(isSkillUsed).toBe(true);
      expect(hasDiagramFile).toBe(true);
    }, visualizerTestTimeoutMs);

    test("visualizes resource connections and relationships", async () => {
      let workspacePath: string | undefined;

      const agentMetadata = await agent.run({
        prompt: "Visualize how my Azure resources are connected and show their relationships. Save the diagram to an architecture.md file in the current working directory.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT,
        setup: async (workspace: string) => {
          workspacePath = workspace;
        }
      });

      const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
      expect(workspacePath).toBeDefined();
      const hasDiagramFile = doesWorkspaceFileIncludePattern(workspacePath!, /graph\s+(TB|LR)/i, /architecture.*\.md$/i);

      expect(isSkillUsed).toBe(true);
      expect(hasDiagramFile).toBe(true);
    }, visualizerTestTimeoutMs);
  });
});
