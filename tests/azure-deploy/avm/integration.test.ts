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
} from "../../utils/agent-runner";
import {
  softCheckSkill,
  getAllAssistantMessages,
  getAllToolText,
} from "../../utils/evaluate";

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
          // Verify the response explicitly mentions AVM and patterns (critical requirement)
          expectKeywordsPresent(
            output,
            ["avm", "pattern"],
            2,
            "avm-module-priority (critical terms)",
          );
          // Verify the response discusses AVM module hierarchy and Bicep deploy guidance
          expectKeywordsPresent(
            output,
            ["resource", "module", "bicep"],
            2,
            "avm-module-priority (hierarchy/bicep)",
          );
          // Enforce AVM selection hierarchy ordering: patterns before resource/utility
          const patternIdx = output.indexOf("pattern");
          const resourceIdx = output.indexOf("resource");
          const utilityIdx = output.indexOf("utility");
          if (patternIdx !== -1) {
            const fallbackIndices = [resourceIdx, utilityIdx].filter((i) => i !== -1);
            if (fallbackIndices.length > 0) {
              expect(patternIdx).toBeLessThan(Math.min(...fallbackIndices));
            }
          }
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
            ["avm", "resource", "utility", "fallback", "fall back", "fall-back", "module"],
            5,
            "avm-fallback-behavior",
          );
          // Verify that AVM resource modules are recommended before AVM utility modules
          const resourceIndex = output.indexOf("resource");
          const utilityIndex = output.indexOf("utility");
          expect(resourceIndex).toBeGreaterThanOrEqual(0);
          expect(utilityIndex).toBeGreaterThanOrEqual(0);
          expect(resourceIndex).toBeLessThan(utilityIndex);
          // Verify no suggestion to use non-AVM modules (expanded patterns)
          // Context-aware: skip matches preceded by negation words (e.g., "never fall back to non-AVM")
          const nonAvmPatterns = [
            /non[- ]?avm/gi,
            /without avm/gi,
            /skip avm/gi,
            /ignore avm/gi,
            /outside.*?avm/gi,
            /bypass.*?avm/gi,
          ];
          const negationPrefixes = ["never", "don't", "do not", "avoid", "must not", "should not", "shouldn't"];
          let suggestsNonAvm = false;
          for (const pattern of nonAvmPatterns) {
            let match: RegExpExecArray | null;
            while ((match = pattern.exec(output)) !== null) {
              const start = Math.max(0, match.index - 40);
              const preceding = output.substring(start, match.index);
              const end = Math.min(output.length, match.index + match[0].length + 40);
              const following = output.substring(match.index + match[0].length, end);
              const isNegated =
                negationPrefixes.some((neg) => preceding.includes(neg)) ||
                negationPrefixes.some((neg) => following.includes(neg));
              if (!isNegated) {
                suggestsNonAvm = true;
                break;
              }
            }
            if (suggestsNonAvm) break;
          }
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
          // Verify the response explicitly discusses AZD pattern modules
          expectKeywordsPresent(
            output,
            ["azd", "pattern"],
            2,
            "avm-azd-pattern-preference-core",
          );
          // Verify broader AVM/Bicep/container/module deployment context is present
          expectKeywordsPresent(
            output,
            ["avm", "container", "bicep", "module"],
            3,
            "avm-azd-pattern-preference-context",
          );
          // Verify AZD pattern modules are discussed before resource modules
          const normalizedOutput = output.toLowerCase();
          const patModMatch = normalizedOutput.match(/(?:avm\s+|azd\s+)?pattern modules?/);
          const resModMatch = normalizedOutput.match(/(?:avm\s+)?resource modules?/);
          const patModIdx = patModMatch?.index ?? -1;
          const resModIdx = resModMatch?.index ?? -1;
          if (patModIdx !== -1 && resModIdx !== -1) {
            expect(patModIdx).toBeLessThan(resModIdx);
          }
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
