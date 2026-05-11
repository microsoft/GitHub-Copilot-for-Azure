/**
 * Integration Tests — Skill Invocation & Standalone
 *
 * Validates that azure-app-onboard is routed correctly for key prompt patterns.
 * Includes a standalone (no-workspace) test with depth assertions for cost + service coverage.
 */

import {
  shouldSkipIntegrationTests,
  getIntegrationSkipReason,
  useAgentRunner,
} from "../utils/agent-runner";
import {
  isSkillInvoked,
  softCheckSkill,
  shouldEarlyTerminateForSkillInvocation,
  withTestResult,
  getAllAssistantMessages,
} from "../utils/evaluate";
import {
  SKILL_NAME,
  RUNS_PER_PROMPT,
  invocationRateThreshold,
  testTimeoutMs,
  assertApprovalGateReached,
  shouldEarlyTerminateOnRoutingFailure,
} from "./app-onboard-test-helpers";

const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

describeIntegration(`${SKILL_NAME}_ - Invocation Tests`, () => {
  const agent = useAgentRunner();

  describe("skill-invocation", () => {
    test("invokes azure-app-onboard for startup MVP prompt (standalone, no workspace)", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "I'm a startup founder and need to deploy my MVP on Azure",
            followUp: [
              "I want to avoid surprise charges — what will this cost?",
              "Don't just deploy it — show me what you're going to do first.",
              "No, don't deploy. That's all I needed.",
            ],
            nonInteractive: true,
            shouldEarlyTerminate: shouldEarlyTerminateOnRoutingFailure,
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invocationCount += 1;
            assertApprovalGateReached(agentMetadata);

            // Service count — should recommend multiple Azure services
            const messages = getAllAssistantMessages(agentMetadata).toLowerCase();
            const serviceCount =
              (messages.includes("app service") ? 1 : 0) +
              (messages.includes("container apps") ? 1 : 0) +
              (/azure sql|postgres|cosmos|database/i.test(messages) ? 1 : 0) +
              (/entra|active directory/i.test(messages) ? 1 : 0) +
              (messages.includes("key vault") ? 1 : 0) +
              (/redis|cache/i.test(messages) ? 1 : 0) +
              (/app insights|application insights|log analytics/i.test(messages) ? 1 : 0);
            if (serviceCount < 2) {
              agentMetadata.testComments.push(`⚠️ SERVICE COUNT LOW: only ${serviceCount} distinct Azure services mentioned (expected ≥2)`);
            }
            expect(serviceCount).toBeGreaterThanOrEqual(2);

            // Cost depth — agent must provide actual pricing, not just mention "cost"
            const hasDollarAmounts = /\$\d/.test(messages);
            const hasSkuCodes = /\b(f1|b1|b2|s1|p1v2|d1)\b/i.test(messages);
            const hasMonthlyPricing = /per month|monthly|\/month/i.test(messages);
            const hasCostDepth = hasDollarAmounts || (hasSkuCodes && hasMonthlyPricing);
            if (!hasCostDepth) {
              agentMetadata.testComments.push("⚠️ COST DEPTH MISSING: agent mentioned cost but did not provide dollar amounts or SKU-level pricing");
            }
            expect(hasCostDepth).toBe(true);
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    }, testTimeoutMs);

    test("invokes azure-app-onboard for first-time deployment prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "I have no Azure experience but need to host my web app",
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
    }, testTimeoutMs);

    test("invokes azure-app-onboard for onboarding prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "Can you walk me through getting my first app on Azure?",
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
    }, testTimeoutMs);
  });
});
