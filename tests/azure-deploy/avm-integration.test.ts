/**
 * Integration Tests for AVM (Azure Verified Modules) Flow
 *
 * Tests that the agent correctly enforces the AVM module selection hierarchy:
 * 1. AVM+AZD Pattern Modules (highest priority)
 * 2. AVM Resource Modules (fallback)
 * 3. AVM Utility Modules (final fallback)
 * 4. Never fall back to non-AVM modules
 *
 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 */

import {
  shouldSkipIntegrationTests,
  getIntegrationSkipReason,
  useAgentRunner
} from "../utils/agent-runner";
import {
  softCheckSkill,
  getAllAssistantMessages,
  getAllToolText,
} from "../utils/evaluate";

const SKILL_NAME = "azure-deploy";
const RUNS_PER_PROMPT = 1;

const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

if (skipTests && skipReason) {
  console.log(`⏭️  Skipping AVM integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

/** Combine all agent output text (assistant messages + tool calls) for keyword checks */
function getAgentOutputText(agentMetadata: Parameters<typeof getAllAssistantMessages>[0]): string {
  return `${getAllAssistantMessages(agentMetadata)} ${getAllToolText(agentMetadata)}`.toLowerCase();
}

/** Check that agent output mentions at least N of the expected keywords (case-insensitive) */
function expectKeywordsPresent(
  output: string,
  keywords: string[],
  minRequired: number,
  context: string,
): void {
  const found = keywords.filter((kw) => output.includes(kw.toLowerCase()));
  if (found.length < minRequired) {
    console.warn(
      `⚠️  [${context}] Expected at least ${minRequired} of [${keywords.join(", ")}] ` +
      `in output, found ${found.length}: [${found.join(", ")}]`,
    );
  }
  expect(found.length).toBeGreaterThanOrEqual(minRequired);
}

describeIntegration(`${SKILL_NAME}_avm-flow - Integration Tests`, () => {
  const agent = useAgentRunner();

  describe("avm-module-priority", () => {
    test("prefers AVM+AZD pattern modules for Bicep deploy guidance", async () => {
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt:
              "My app is already prepared and validated. " +
              "Give me deploy guidance and module preference order for Bicep. " +
              "Prefer AVM+AZD patterns where available, with fallback to AVM resource modules and AVM utility modules.",
            nonInteractive: true,
          });

          softCheckSkill(agentMetadata, SKILL_NAME);

          const output = getAgentOutputText(agentMetadata);
          // Verify the response discusses AVM module hierarchy
          expectKeywordsPresent(
            output,
            ["avm", "pattern", "resource", "module", "bicep"],
            3,
            "avm-module-priority",
          );
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
      }
    });
  });

  describe("avm-fallback-behavior", () => {
    test("stays within AVM modules when no pattern module exists", async () => {
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt:
              "I'm deploying with Bicep and there is no AVM+AZD pattern module for my scenario. " +
              "What module order should I follow if no pattern module exists and fallback must stay AVM resource modules then AVM utility modules?",
            nonInteractive: true,
          });

          softCheckSkill(agentMetadata, SKILL_NAME);

          const output = getAgentOutputText(agentMetadata);
          // Verify the response discusses AVM fallback within AVM ecosystem
          expectKeywordsPresent(
            output,
            ["avm", "resource", "utility", "fallback", "module"],
            3,
            "avm-fallback-behavior",
          );
          // Verify no suggestion to use non-AVM modules
          const nonAvmPatterns = ["non-avm", "without avm", "skip avm", "ignore avm"];
          const suggestsNonAvm = nonAvmPatterns.some((p) => output.includes(p));
          if (suggestsNonAvm) {
            console.warn("⚠️  Agent may have suggested non-AVM fallback");
          }
          expect(suggestsNonAvm).toBe(false);
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
      }
    });
  });

  describe("avm-azd-pattern-preference", () => {
    test("prioritizes AZD pattern modules for azd infrastructure setup", async () => {
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt:
              "Set up azd infrastructure with Bicep for a container app. " +
              "Use AVM modules and prefer AZD pattern modules over resource modules.",
            nonInteractive: true,
          });

          softCheckSkill(agentMetadata, SKILL_NAME);

          const output = getAgentOutputText(agentMetadata);
          // Verify the response discusses AZD pattern modules
          expectKeywordsPresent(
            output,
            ["azd", "avm", "pattern", "container", "bicep", "module"],
            3,
            "avm-azd-pattern-preference",
          );
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
      }
    });
  });
});
