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
  isSkillInvoked,
  getToolCalls,
  shouldSkipIntegrationTests,
  getIntegrationSkipReason
} from "../utils/agent-runner";
import type { AgentMetadata } from "../utils/agent-runner";
import * as fs from "fs";

const SKILL_NAME = "azure-resource-visualizer";
const RUNS_PER_PROMPT = 5;
const EXPECTED_INVOCATION_RATE = 0.6; // 60% minimum invocation rate

// Check if integration tests should be skipped at module level
const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

// Log skip reason if skipping
if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;
const visualizerTestTimeoutMs = 1800000;

/**
 * Check if a file-creation tool call produced an architecture markdown file
 * containing a Mermaid diagram (graph TB or graph LR).
 */
function hasArchitectureDiagramFile(agentMetadata: AgentMetadata): boolean {
  const fileToolCalls = getToolCalls(agentMetadata, "create");
  return fileToolCalls.some(event => {
    const args = JSON.stringify(event.data);
    const hasArchitectureFile = /architecture.*\.md/i.test(args);
    const hasMermaidDiagram = /graph\s+(TB|LR)/i.test(args);
    return hasArchitectureFile && hasMermaidDiagram;
  });
}

describeIntegration(`${SKILL_NAME} - Integration Tests`, () => {
  const agent = useAgentRunner();

  describe("skill-invocation", () => {
    test("invokes azure-resource-visualizer skill for architecture diagram prompt", async () => {
      let successCount = 0;

      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Generate a Mermaid diagram showing my Azure resource group architecture",
            shouldEarlyTerminate: (metadata) => isSkillInvoked(metadata, SKILL_NAME)
          });

          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            successCount++;
          }
        } catch (e: unknown) {
          if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
            console.log("⏭️  SDK not loadable, skipping test");
            return;
          }
          throw e;
        }
      }

      const invocationRate = successCount / RUNS_PER_PROMPT;
      console.log(`${SKILL_NAME} invocation rate for architecture diagram prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`);
      fs.appendFileSync(`./result-${SKILL_NAME}.txt`, `${SKILL_NAME} invocation rate for architecture diagram prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`);
      expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    });

    test("invokes azure-resource-visualizer skill for resource relationships prompt", async () => {
      let successCount = 0;

      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Visualize how my Azure resources are connected and show their relationships",
            shouldEarlyTerminate: (metadata) => isSkillInvoked(metadata, SKILL_NAME)
          });

          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            successCount++;
          }
        } catch (e: unknown) {
          if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
            console.log("⏭️  SDK not loadable, skipping test");
            return;
          }
          throw e;
        }
      }

      const invocationRate = successCount / RUNS_PER_PROMPT;
      console.log(`${SKILL_NAME} invocation rate for resource relationships prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`);
      fs.appendFileSync(`./result-${SKILL_NAME}.txt`, `${SKILL_NAME} invocation rate for resource relationships prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`);
      expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    });
  });

  // Need to be logged into az for these tests.
  // az login
  const FOLLOW_UP_PROMPT = ["Go with recommended options."];

  describe("resource-group-visualization", () => {
    test("generates architecture diagram for a resource group", async () => {
      const agentMetadata = await agent.run({
        prompt: "Generate a Mermaid diagram showing my Azure resource group architecture",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT
      });

      const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
      const hasDiagramFile = hasArchitectureDiagramFile(agentMetadata);

      expect(isSkillUsed).toBe(true);
      expect(hasDiagramFile).toBe(true);
    }, visualizerTestTimeoutMs);

    test("visualizes resource connections and relationships", async () => {
      const agentMetadata = await agent.run({
        prompt: "Visualize how my Azure resources are connected and show their relationships",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT
      });

      const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
      const hasDiagramFile = hasArchitectureDiagramFile(agentMetadata);

      expect(isSkillUsed).toBe(true);
      expect(hasDiagramFile).toBe(true);
    }, visualizerTestTimeoutMs);
  });
});
