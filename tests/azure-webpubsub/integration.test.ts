/**
 * Integration Tests for azure-webpubsub
 *
 * Tests skill behavior with a real Copilot agent session.
 * These tests require Copilot CLI to be installed and authenticated.
 */

import {
  useAgentRunner,
  doesAssistantMessageIncludeKeyword,
  getIntegrationSkipReason,
  shouldSkipIntegrationTests,
} from "../utils/agent-runner";
import {
  isSkillInvoked,
  softCheckSkill,
  shouldEarlyTerminateForSkillInvocation,
  withTestResult,
} from "../utils/evaluate";

const SKILL_NAME = "azure-webpubsub";
const RUNS_PER_PROMPT = 3;
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
    test("invokes azure-webpubsub skill for negotiate guidance", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;

        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt:
              "I am adding Azure Web PubSub to a browser chat app. How should I build the /negotiate endpoint so the browser gets a client URL without exposing connection strings or broad roles?",
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
    });

    test("invokes azure-webpubsub skill for upstream versus publish decision", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;

        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt:
              "For Azure Web PubSub, when should I use upstream handlers versus WebPubSubServiceClient? I need to decide whether every client event must hit server logic or whether the server only publishes and manages groups.",
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
    });

    test("invokes azure-webpubsub skill for Socket.IO path", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;

        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt:
              "My app already uses Socket.IO rooms and I want to move to Azure Web PubSub. Should I keep the Socket.IO path or switch to the native WebPubSub client SDK?",
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
    });
  });

  describe("response-quality", () => {
    test("negotiate guidance keeps auth boundary on the server", async () => {
      await withTestResult(async () => {
        const prompt =
          "Show me the right production posture for an Azure Web PubSub /negotiate endpoint for browser clients. I need to know where user identity, roles, and the access token should be decided.";

        let invoked = false;
        let hasRelevantContent = false;

        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({ prompt });

          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invoked = true;
            hasRelevantContent =
              doesAssistantMessageIncludeKeyword(agentMetadata, "/negotiate", { caseSensitive: false }) &&
              doesAssistantMessageIncludeKeyword(agentMetadata, "server", { caseSensitive: false }) &&
              (doesAssistantMessageIncludeKeyword(agentMetadata, "role", { caseSensitive: false }) ||
                doesAssistantMessageIncludeKeyword(agentMetadata, "token", { caseSensitive: false }) ||
                doesAssistantMessageIncludeKeyword(agentMetadata, "identity", { caseSensitive: false }));

            if (hasRelevantContent) {
              break;
            }
          }
        }

        expect(invoked).toBe(true);
        expect(hasRelevantContent).toBe(true);
      });
    });

    test("server role guidance distinguishes upstream from service client", async () => {
      await withTestResult(async () => {
        const prompt =
          "Explain the server role choices in Azure Web PubSub. I need to understand the difference between upstream and WebPubSubServiceClient for a system where the server publishes messages and may also need one handler per event.";

        let invoked = false;
        let hasRelevantContent = false;

        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({ prompt });

          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invoked = true;
            hasRelevantContent =
              doesAssistantMessageIncludeKeyword(agentMetadata, "upstream", { caseSensitive: false }) &&
              doesAssistantMessageIncludeKeyword(agentMetadata, "WebPubSubServiceClient", { caseSensitive: false }) &&
              (doesAssistantMessageIncludeKeyword(agentMetadata, "publish", { caseSensitive: false }) ||
                doesAssistantMessageIncludeKeyword(agentMetadata, "group", { caseSensitive: false }) ||
                doesAssistantMessageIncludeKeyword(agentMetadata, "event", { caseSensitive: false }));

            if (hasRelevantContent) {
              break;
            }
          }
        }

        expect(invoked).toBe(true);
        expect(hasRelevantContent).toBe(true);
      });
    });
  });
});
