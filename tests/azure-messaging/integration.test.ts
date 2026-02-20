/**
 * Integration Tests for azure-messaging
 *
 * Tests skill behavior with a real Copilot agent session.
 * Prompts are derived from real customer-reported issues in
 * https://github.com/Azure/azure-sdk-for-python/issues?q=label:Messaging+label:customer-reported
 *
 * Runs prompts multiple times to measure skill invocation rate.
 */

import {
  useAgentRunner,
  isSkillInvoked,
  doesAssistantMessageIncludeKeyword,
  shouldSkipIntegrationTests,
  getIntegrationSkipReason
} from "../utils/agent-runner";
import * as fs from "fs";

const SKILL_NAME = "azure-messaging";
const RUNS_PER_PROMPT = 3;
const EXPECTED_INVOCATION_RATE = 0.6; // 60% minimum invocation rate

const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

/**
 * Helper to run a prompt multiple times and assert invocation rate.
 */
function defineInvocationTest(
  agent: ReturnType<typeof useAgentRunner>,
  testLabel: string,
  prompt: string
) {
  test(testLabel, async () => {
    let successCount = 0;

    for (let i = 0; i < RUNS_PER_PROMPT; i++) {
      try {
        const agentMetadata = await agent.run({
          prompt,
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
    const logLine = `${SKILL_NAME} invocation rate for ${testLabel}: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`;
    console.log(logLine);
    fs.appendFileSync(`./result-${SKILL_NAME}.txt`, logLine + "\n");
    expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
  });
}

describeIntegration(`${SKILL_NAME}_ - Integration Tests`, () => {
  const agent = useAgentRunner();

  describe("customer-reported-issues", () => {
    // #41220 — Event Hub connection inactive timeout
    defineInvocationTest(
      agent,
      "event-hub-connection-inactive-timeout",
      "My Python Event Hub producer client logs 'Connection closed with error: amqp:connection:forced, The connection was inactive for more than the allowed 240000 milliseconds'. I didn't set idle_timeout. Why is the connection being closed?"
    );

    // #38973 — Service Bus K8s pods idle after AMQP connection reset
    defineInvocationTest(
      agent,
      "servicebus-k8s-pods-idle-after-amqp-error",
      "My Kubernetes pods running azure-servicebus Python SDK stop processing messages after logging 'Connection keep-alive for SendClientAsync failed: AMQPConnectionError, Connection reset by peer'. The pods never reconnect and stay idle until restarted."
    );

    // #38627 — Service Bus amqp:link:detach-forced causing slow sends
    defineInvocationTest(
      agent,
      "servicebus-link-detach-forced-slow-send",
      "Using azure-servicebus Python SDK, my sender.send_messages takes 7 seconds every 10 minutes. The error shows 'amqp:link:detach-forced, IdleTimerExpired: Idle timeout: 00:10:00'. How do I prevent this delay?"
    );

    // #37340 — Service Bus message lock renewal too slow for large batches
    defineInvocationTest(
      agent,
      "servicebus-lock-renewal-batch-timeout",
      "I'm receiving a batch of 400 messages from a Service Bus queue with a 4-minute lock duration. The lock renewal starts only 10 seconds before expiry and there's a 0.5s sleep between each renewal, so most message locks expire before they can be renewed."
    );

    // #40156 — Service Bus receive_messages returns fewer messages in loop
    defineInvocationTest(
      agent,
      "servicebus-receive-messages-limited-in-loop",
      "When I call receiver.receive_messages(max_message_count=100) in a loop with the azure-servicebus Python SDK, after the first call returns 100 messages, subsequent calls only return 1 message even though there are 100+ messages in the queue."
    );

    // #35266 — Service Bus slow sender reconnection after idle timeout
    defineInvocationTest(
      agent,
      "servicebus-slow-sender-reconnect",
      "Using azure-servicebus Python SDK, creating a sender takes 1-2 seconds initially, but after the connection is closed due to idle timeout (660 seconds), recreating the sender takes 8-10 seconds. Why is reconnection so slow?"
    );

    // #38629 — Service Bus session-enabled queue receiver immediate detach
    defineInvocationTest(
      agent,
      "servicebus-session-receiver-detach",
      "My ServiceBusReceiver with session_id=NEXT_AVAILABLE_SESSION connects and authenticates successfully, but the link immediately detaches with a 'Session error'. I've tried increasing timeouts and changing TransportType but the session receiver keeps failing."
    );

    // #41024 — Event Hub duplicate events with in-memory checkpoint
    defineInvocationTest(
      agent,
      "eventhub-duplicate-events-in-memory-checkpoint",
      "My EventHubConsumerClient using in-memory checkpoint starts consuming duplicate old events after running for 2-3 hours. The offsets reset to old values without any exception. Using azure-eventhub Python SDK 5.7.0 with receive_batch and update_checkpoint."
    );
  });

  describe("response-content-validation", () => {
    test("session-lock-diagnosis", async () => {
      const prompt =
        "I'm using azure-servicebus Python SDK with session-enabled queues. After processing a few messages, I get 'SessionLockLostError: The session lock has expired on the session'. My processing takes about 2 minutes but the session lock duration is 30 seconds. How do I fix this?";

      let invoked = false;
      let hasRelevantContent = false;

      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt,
            shouldEarlyTerminate: (metadata) => isSkillInvoked(metadata, SKILL_NAME)
          });

          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invoked = true;
            // Validate response addresses session lock with actionable guidance
            hasRelevantContent =
              doesAssistantMessageIncludeKeyword(agentMetadata, "session", { caseSensitive: false }) &&
              doesAssistantMessageIncludeKeyword(agentMetadata, "lock", { caseSensitive: false }) &&
              (doesAssistantMessageIncludeKeyword(agentMetadata, "renew", { caseSensitive: false }) ||
               doesAssistantMessageIncludeKeyword(agentMetadata, "duration", { caseSensitive: false }) ||
               doesAssistantMessageIncludeKeyword(agentMetadata, "auto_lock_renewer", { caseSensitive: false }));
            if (hasRelevantContent) break;
          }
        } catch (e: unknown) {
          if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
            console.log("⏭️  SDK not loadable, skipping test");
            return;
          }
          throw e;
        }
      }

      const logLine = `${SKILL_NAME} session-lock-diagnosis: invoked=${invoked}, relevant_content=${hasRelevantContent}`;
      console.log(logLine);
      fs.appendFileSync(`./result-${SKILL_NAME}.txt`, logLine + "\n");
      expect(invoked).toBe(true);
      expect(hasRelevantContent).toBe(true);
    });

    test("sdk-configuration-guidance", async () => {
      const prompt =
        "How do I configure retry policy and prefetch count for the azure-eventhub Python SDK? My consumer client keeps timing out when the Event Hub is under heavy load.";

      let invoked = false;
      let hasRelevantContent = false;

      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt,
            shouldEarlyTerminate: (metadata) => isSkillInvoked(metadata, SKILL_NAME)
          });

          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invoked = true;
            // Validate response provides SDK configuration guidance
            hasRelevantContent =
              (doesAssistantMessageIncludeKeyword(agentMetadata, "retry", { caseSensitive: false }) ||
               doesAssistantMessageIncludeKeyword(agentMetadata, "prefetch", { caseSensitive: false })) &&
              (doesAssistantMessageIncludeKeyword(agentMetadata, "EventHubConsumerClient", { caseSensitive: false }) ||
               doesAssistantMessageIncludeKeyword(agentMetadata, "retry_total", { caseSensitive: false }) ||
               doesAssistantMessageIncludeKeyword(agentMetadata, "retry_backoff", { caseSensitive: false }) ||
               doesAssistantMessageIncludeKeyword(agentMetadata, "prefetch_count", { caseSensitive: false }));
            if (hasRelevantContent) break;
          }
        } catch (e: unknown) {
          if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
            console.log("⏭️  SDK not loadable, skipping test");
            return;
          }
          throw e;
        }
      }

      const logLine = `${SKILL_NAME} sdk-configuration-guidance: invoked=${invoked}, relevant_content=${hasRelevantContent}`;
      console.log(logLine);
      fs.appendFileSync(`./result-${SKILL_NAME}.txt`, logLine + "\n");
      expect(invoked).toBe(true);
      expect(hasRelevantContent).toBe(true);
    });
  });
});
