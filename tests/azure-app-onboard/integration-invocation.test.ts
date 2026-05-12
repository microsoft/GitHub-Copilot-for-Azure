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
        const runsForStandalone = 2; // standalone prompts need >1 run — routing is probabilistic without workspace context
        for (let i = 0; i < runsForStandalone; i++) {
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
          }
        }
        const rate = invocationCount / runsForStandalone;
        setSkillInvocationRate(rate);
        // Standalone prompts (no workspace) are inherently flakier — accept 50% rate
        expect(rate).toBeGreaterThanOrEqual(0.5);
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

    test("invokes azure-app-onboard for greenfield no-code prompt (no workspace)", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt:
              "I have no code yet — help me get started on Azure. I'm building a dashboard for our sales team, maybe 200 users. We'll need a database and some kind of login for our company. What Azure services do I need and what will it cost?",
            followUp: [
              "Don't just deploy it — show me what you're going to do first.",
              "No, don't deploy. That's all I needed.",
            ],
            nonInteractive: true,
            shouldEarlyTerminate: shouldEarlyTerminateOnRoutingFailure,
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invocationCount += 1;

            const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

            // Must mention auth service — user said "login for our company"
            const mentionsAuth =
              messages.includes("entra") || messages.includes("azure ad") ||
              messages.includes("active directory") || messages.includes("sso") ||
              messages.includes("identity") || messages.includes("oauth") ||
              messages.includes("microsoft identity");
            if (!mentionsAuth) {
              agentMetadata.testComments.push("❌ GREENFIELD: Did not mention auth/identity service (user explicitly asked for login)");
            }
            expect(mentionsAuth).toBe(true);

            // Must mention ≥2 distinct Azure services
            const serviceCount =
              (messages.includes("app service") ? 1 : 0) +
              (messages.includes("container apps") ? 1 : 0) +
              (messages.includes("functions") || messages.includes("azure functions") ? 1 : 0) +
              (messages.includes("static web") ? 1 : 0) +
              (/azure sql|cosmos|postgres/i.test(messages) ? 1 : 0) +
              (/entra|azure ad|active directory/i.test(messages) ? 1 : 0) +
              (messages.includes("key vault") ? 1 : 0);
            if (serviceCount < 2) {
              agentMetadata.testComments.push(`❌ GREENFIELD: Only ${serviceCount} Azure services mentioned (expected ≥2)`);
            }
            expect(serviceCount).toBeGreaterThanOrEqual(2);

            // Must drive toward planning
            const drivesTowardPlanning =
              messages.includes("architect") || messages.includes("plan") ||
              messages.includes("recommend") || messages.includes("suggest") ||
              messages.includes("tier") || messages.includes("cost") ||
              messages.includes("estimate");
            if (!drivesTowardPlanning) {
              agentMetadata.testComments.push("❌ GREENFIELD: Did not drive toward architecture planning");
            }
            expect(drivesTowardPlanning).toBe(true);

            // Must NOT re-ask questions the user already answered (200 users, company login)
            const reAsksUserCount =
              /how many users/i.test(messages) || /number of users/i.test(messages) ||
              /expected.*user.*count/i.test(messages);
            const reAsksLoginType =
              /what kind of (login|auth)/i.test(messages) || /what type of (login|auth)/i.test(messages) ||
              /do you need.*(login|auth)/i.test(messages);
            if (reAsksUserCount) {
              agentMetadata.testComments.push("❌ GREENFIELD: Re-asked about user count (user already said 200 users)");
            }
            if (reAsksLoginType) {
              agentMetadata.testComments.push("❌ GREENFIELD: Re-asked about login type (user already said company login)");
            }
            expect(reAsksUserCount).toBe(false);
            expect(reAsksLoginType).toBe(false);
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    }, testTimeoutMs);
  });
});
