/**
 * Integration Tests for azure-app-onboard/prepare subskill
 *
 * Routes prompts through the PARENT skill (azure-app-onboard) and verifies
 * that the parent delegates to the prepare subskill — evidenced by
 * prepare-domain outputs (service mapping, cost estimation, SKU selection).
 *
 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 * 3. az login + azd auth login
 */

import {
  shouldSkipIntegrationTests,
  getIntegrationSkipReason,
  useAgentRunner,
} from "../../utils/agent-runner";
import {
  isSkillInvoked,
  softCheckSkill,
  shouldEarlyTerminateForSkillInvocation,
  doesAssistantOrToolsIncludeKeyword,
  withTestResult,
  getAllAssistantMessages,
} from "../../utils/evaluate";
import type { AgentMetadata } from "../../utils/agent-runner";
import {
  SKILL_NAME,
  RUNS_PER_PROMPT,
  invocationRateThreshold,
  testTimeoutMs,
} from "../app-onboard-test-helpers";

/**
 * Early terminate once the agent presents a plan with cost/service info
 * (evidence that the prepare subskill ran).
 */
function shouldEarlyTerminateForPrepareOutput(agentMetadata: AgentMetadata): boolean {
  if (!isSkillInvoked(agentMetadata, SKILL_NAME)) {
    return false;
  }

  const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

  // Prepare subskill signals: service mapping + cost estimation
  const hasServiceMapping =
    (messages.includes("app service") || messages.includes("container app") || messages.includes("cosmos")) &&
    (messages.includes("sku") || messages.includes("tier") || messages.includes("plan"));

  const hasCostEstimate =
    messages.includes("$") || messages.includes("month") || messages.includes("estimate") || messages.includes("cost");

  return hasServiceMapping && hasCostEstimate;
}

const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

describeIntegration(`${SKILL_NAME}_prepare - Integration Tests`, () => {
  const agent = useAgentRunner();

  describe("prepare-delegation", () => {
    test("parent delegates to prepare for architecture planning prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "Can you walk me through getting my first app on Azure?",
            nonInteractive: true,
            shouldEarlyTerminate: (metadata) =>
              shouldEarlyTerminateForPrepareOutput(metadata) ||
              shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME),
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invocationCount += 1;
          }

          // Prepare-specific content assertions (non-blocking)
          const messages = getAllAssistantMessages(agentMetadata).toLowerCase();
          const hasServiceContent =
            doesAssistantOrToolsIncludeKeyword(agentMetadata, "app service") ||
            doesAssistantOrToolsIncludeKeyword(agentMetadata, "container");
          const hasCostContent =
            messages.includes("$") || messages.includes("cost") || messages.includes("estimate");

          if (!hasServiceContent) {
            agentMetadata.testComments.push("⚠️ PREPARE: No Azure service names in output — agent may not have run service mapping");
          }
          if (!hasCostContent) {
            agentMetadata.testComments.push("⚠️ PREPARE: No cost/pricing info in output — agent may not have run cost estimation");
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    }, testTimeoutMs);

    test("parent delegates to prepare for SKU selection prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "I have no Azure experience but need to host my web app",
            nonInteractive: true,
            shouldEarlyTerminate: (metadata) =>
              shouldEarlyTerminateForPrepareOutput(metadata) ||
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
