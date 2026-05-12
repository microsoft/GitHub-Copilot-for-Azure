/**
 * Integration Tests for azure-reliability
 *
 * Tests skill behavior with a real Copilot agent session.
 * Runs prompts multiple times to measure skill invocation rate.
 *
 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 *
 * Note: These tests focus on skill invocation and assessment-output behavior.
 * They do NOT exercise live Azure Resource Graph queries or remediation
 * commands — those require an authenticated `az login` and a real resource
 * group with reliability gaps. To exercise the full assessment + remediation
 * flow, run the skill manually against a controlled test resource group.
 */

import {
  shouldSkipIntegrationTests,
  getIntegrationSkipReason,
  useAgentRunner,
  doesAssistantMessageIncludeKeyword,
} from "../utils/agent-runner";
import {
  isSkillInvoked,
  softCheckSkill,
  shouldEarlyTerminateForSkillInvocation,
  withTestResult,
} from "../utils/evaluate";

const SKILL_NAME = "azure-reliability";
const RUNS_PER_PROMPT = 3;
const invocationRateThreshold = 0.8;

// Centralized skip logic
const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();
if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}
const describeIntegration = skipTests ? describe.skip : describe;

const reliabilityTimeoutMs = 10 * 60 * 1000; // 10 minutes per test

describeIntegration(`${SKILL_NAME}_ - Integration Tests`, () => {
  const agent = useAgentRunner();

  // ──────────────────────────────────────────────────────────────────
  // Skill invocation rate — does the skill activate on relevant prompts?
  // ──────────────────────────────────────────────────────────────────
  describe("skill-invocation", () => {
    test(
      "invokes azure-reliability for direct assessment prompt",
      async () => {
        await withTestResult(async ({ setSkillInvocationRate }) => {
          let invocationCount = 0;
          for (let i = 0; i < RUNS_PER_PROMPT; i++) {
            const agentMetadata = await agent.run({
              prompt:
                "Assess the reliability of my Azure resource group rg-demo. Is it zone redundant?",
              nonInteractive: true,
              shouldEarlyTerminate: (metadata) =>
                shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME),
            });

            softCheckSkill(agentMetadata, SKILL_NAME);
            if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
              invocationCount += 1;
            }
          }
          const rate = invocationCount / RUNS_PER_PROMPT;
          setSkillInvocationRate(rate);
          expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
        });
      },
      reliabilityTimeoutMs
    );

    test(
      "invokes azure-reliability for zone redundancy enablement prompt",
      async () => {
        await withTestResult(async ({ setSkillInvocationRate }) => {
          let invocationCount = 0;
          for (let i = 0; i < RUNS_PER_PROMPT; i++) {
            const agentMetadata = await agent.run({
              prompt: "Make my Azure Functions app zone redundant.",
              nonInteractive: true,
              shouldEarlyTerminate: (metadata) =>
                shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME),
            });

            softCheckSkill(agentMetadata, SKILL_NAME);
            if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
              invocationCount += 1;
            }
          }
          const rate = invocationCount / RUNS_PER_PROMPT;
          setSkillInvocationRate(rate);
          expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
        });
      },
      reliabilityTimeoutMs
    );

    test(
      "invokes azure-reliability for multi-region failover prompt",
      async () => {
        await withTestResult(async ({ setSkillInvocationRate }) => {
          let invocationCount = 0;
          for (let i = 0; i < RUNS_PER_PROMPT; i++) {
            const agentMetadata = await agent.run({
              prompt:
                "I want to set up multi-region failover for my Azure app with Azure Front Door.",
              nonInteractive: true,
              shouldEarlyTerminate: (metadata) =>
                shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME),
            });

            softCheckSkill(agentMetadata, SKILL_NAME);
            if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
              invocationCount += 1;
            }
          }
          const rate = invocationCount / RUNS_PER_PROMPT;
          setSkillInvocationRate(rate);
          expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
        });
      },
      reliabilityTimeoutMs
    );

    test(
      "invokes azure-reliability for storage redundancy prompt",
      async () => {
        await withTestResult(async ({ setSkillInvocationRate }) => {
          let invocationCount = 0;
          for (let i = 0; i < RUNS_PER_PROMPT; i++) {
            const agentMetadata = await agent.run({
              prompt:
                "Is my Azure storage account zone redundant? Upgrade it to ZRS if not.",
              nonInteractive: true,
              shouldEarlyTerminate: (metadata) =>
                shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME),
            });

            softCheckSkill(agentMetadata, SKILL_NAME);
            if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
              invocationCount += 1;
            }
          }
          const rate = invocationCount / RUNS_PER_PROMPT;
          setSkillInvocationRate(rate);
          expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
        });
      },
      reliabilityTimeoutMs
    );
  });

  // ──────────────────────────────────────────────────────────────────
  // Behavior — does the skill produce expected guidance?
  // ──────────────────────────────────────────────────────────────────
  describe("response-quality", () => {
    test(
      "asks for resource group / scope before running checks",
      async () => {
        await withTestResult(async () => {
          const agentMetadata = await agent.run({
            prompt:
              "Check the reliability of my Azure resources. (Don't actually run any az commands — just describe what you'd do.)",
            nonInteractive: true,
          });

          // Skill should clarify scope (RG / subscription / app name) before scanning
          const mentionsScope =
            doesAssistantMessageIncludeKeyword(agentMetadata, "resource group") ||
            doesAssistantMessageIncludeKeyword(agentMetadata, "subscription") ||
            doesAssistantMessageIncludeKeyword(agentMetadata, "scope");
          expect(mentionsScope).toBe(true);
        });
      },
      reliabilityTimeoutMs
    );

    test(
      "explains the staged remediation flow when asked to fix reliability",
      async () => {
        await withTestResult(async () => {
          const agentMetadata = await agent.run({
            prompt:
              "My Azure Functions app is not zone redundant and uses LRS storage. Walk me through fixing it (don't actually run anything).",
            nonInteractive: true,
          });

          // Should mention quick wins first, then storage migration confirmation
          const mentionsQuickWins =
            doesAssistantMessageIncludeKeyword(agentMetadata, "quick win") ||
            doesAssistantMessageIncludeKeyword(agentMetadata, "zone redundant");
          const mentionsStorageConfirm =
            doesAssistantMessageIncludeKeyword(agentMetadata, "storage migration") ||
            doesAssistantMessageIncludeKeyword(agentMetadata, "ZRS") ||
            doesAssistantMessageIncludeKeyword(agentMetadata, "Standard_ZRS");
          expect(mentionsQuickWins).toBe(true);
          expect(mentionsStorageConfirm).toBe(true);
        });
      },
      reliabilityTimeoutMs
    );

    test(
      "treats multi-region as opt-in (asks before generating Front Door)",
      async () => {
        await withTestResult(async () => {
          const agentMetadata = await agent.run({
            prompt:
              "My Azure Functions app is already zone redundant with ZRS storage. What's next? (Don't run anything.)",
            nonInteractive: true,
          });

          // Should offer multi-region as an explicit yes/no/later question
          const mentionsMultiRegion =
            doesAssistantMessageIncludeKeyword(agentMetadata, "multi-region") ||
            doesAssistantMessageIncludeKeyword(agentMetadata, "Front Door") ||
            doesAssistantMessageIncludeKeyword(agentMetadata, "failover");
          expect(mentionsMultiRegion).toBe(true);
        });
      },
      reliabilityTimeoutMs
    );
  });
});
