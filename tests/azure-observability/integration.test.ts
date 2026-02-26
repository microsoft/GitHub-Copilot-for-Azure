/**
 * Integration Tests for azure-observability
 *
 * End-to-end tests that verify the skill responds correctly to real Azure
 * Monitor, Application Insights, and Log Analytics scenarios.
 *
 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 * 3. az login (for Azure Monitor/Log Analytics queries)
 */

import {
  useAgentRunner,
  shouldSkipIntegrationTests,
  getIntegrationSkipReason,
  doesAssistantMessageIncludeKeyword
} from "../utils/agent-runner";
import { softCheckSkill } from "../utils/evaluate";

const SKILL_NAME = "azure-observability";
const RUNS_PER_PROMPT = 5;

// Check if integration tests should be skipped at module level
const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

// Log skip reason if skipping
if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

describeIntegration(`${SKILL_NAME}_ - Integration Tests`, () => {
  const agent = useAgentRunner();

  describe("skill-invocation", () => {
    test("invokes azure-observability skill for Azure Monitor prompt", async () => {
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "How do I set up Azure Monitor to track metrics for my application?"
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

    test("invokes azure-observability skill for Log Analytics KQL prompt", async () => {
      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Query my Log Analytics workspace to find application errors using KQL"
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

  // Azure Monitor metrics scenarios
  describe("azure-monitor-metrics", () => {
    test("response mentions Azure Monitor for metrics query", async () => {
      try {
        const agentMetadata = await agent.run({
          prompt: "Show me CPU and memory metrics for my Azure resources over the last hour"
        });

        const mentionsMonitor =
          doesAssistantMessageIncludeKeyword(agentMetadata, "Azure Monitor") ||
          doesAssistantMessageIncludeKeyword(agentMetadata, "az monitor metrics") ||
          doesAssistantMessageIncludeKeyword(agentMetadata, "monitor_metrics_query");
        expect(mentionsMonitor).toBe(true);
      } catch (e: unknown) {
        if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
          console.log("⏭️  SDK not loadable, skipping test");
          return;
        }
        throw e;
      }
    });

    test("response provides CLI or MCP command for querying metrics", async () => {
      try {
        const agentMetadata = await agent.run({
          prompt: "What CLI command can I use to query CPU metrics for my App Service?"
        });

        const mentionsMetricsCommand =
          doesAssistantMessageIncludeKeyword(agentMetadata, "az monitor") ||
          doesAssistantMessageIncludeKeyword(agentMetadata, "metrics list") ||
          doesAssistantMessageIncludeKeyword(agentMetadata, "metric");
        expect(mentionsMetricsCommand).toBe(true);
      } catch (e: unknown) {
        if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
          console.log("⏭️  SDK not loadable, skipping test");
          return;
        }
        throw e;
      }
    });
  });

  // Log Analytics / KQL scenarios
  describe("log-analytics-kql", () => {
    test("response provides KQL query for log analysis", async () => {
      try {
        const agentMetadata = await agent.run({
          prompt: "Write a KQL query to find application exceptions in the last 24 hours"
        });

        const mentionsKql =
          doesAssistantMessageIncludeKeyword(agentMetadata, "KQL") ||
          doesAssistantMessageIncludeKeyword(agentMetadata, "AppExceptions") ||
          doesAssistantMessageIncludeKeyword(agentMetadata, "TimeGenerated") ||
          doesAssistantMessageIncludeKeyword(agentMetadata, "Log Analytics");
        expect(mentionsKql).toBe(true);
      } catch (e: unknown) {
        if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
          console.log("⏭️  SDK not loadable, skipping test");
          return;
        }
        throw e;
      }
    });

    test("response mentions Log Analytics workspace for log queries", async () => {
      try {
        const agentMetadata = await agent.run({
          prompt: "How do I query failed HTTP requests in my Log Analytics workspace?"
        });

        const mentionsLogAnalytics =
          doesAssistantMessageIncludeKeyword(agentMetadata, "Log Analytics") ||
          doesAssistantMessageIncludeKeyword(agentMetadata, "log-analytics") ||
          doesAssistantMessageIncludeKeyword(agentMetadata, "workspace");
        expect(mentionsLogAnalytics).toBe(true);
      } catch (e: unknown) {
        if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
          console.log("⏭️  SDK not loadable, skipping test");
          return;
        }
        throw e;
      }
    });
  });

  // Application Insights scenarios
  describe("application-insights", () => {
    test("response explains Application Insights for APM", async () => {
      try {
        const agentMetadata = await agent.run({
          prompt: "How do I view slow requests and dependencies in Application Insights?"
        });

        const mentionsAppInsights =
          doesAssistantMessageIncludeKeyword(agentMetadata, "Application Insights") ||
          doesAssistantMessageIncludeKeyword(agentMetadata, "AppRequests") ||
          doesAssistantMessageIncludeKeyword(agentMetadata, "DurationMs");
        expect(mentionsAppInsights).toBe(true);
      } catch (e: unknown) {
        if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
          console.log("⏭️  SDK not loadable, skipping test");
          return;
        }
        throw e;
      }
    });

    test("response mentions distributed tracing for Application Insights", async () => {
      try {
        const agentMetadata = await agent.run({
          prompt: "Show me distributed traces for my microservices in Application Insights"
        });

        const mentionsTracing =
          doesAssistantMessageIncludeKeyword(agentMetadata, "Application Insights") ||
          doesAssistantMessageIncludeKeyword(agentMetadata, "distributed tracing") ||
          doesAssistantMessageIncludeKeyword(agentMetadata, "trace");
        expect(mentionsTracing).toBe(true);
      } catch (e: unknown) {
        if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
          console.log("⏭️  SDK not loadable, skipping test");
          return;
        }
        throw e;
      }
    });
  });

  // Alert configuration scenarios
  describe("alert-configuration", () => {
    test("response provides guidance for creating alert rules", async () => {
      try {
        const agentMetadata = await agent.run({
          prompt: "Create an Azure Monitor alert when my app's error rate exceeds 5%"
        });

        const mentionsAlerts =
          doesAssistantMessageIncludeKeyword(agentMetadata, "alert") ||
          doesAssistantMessageIncludeKeyword(agentMetadata, "action group") ||
          doesAssistantMessageIncludeKeyword(agentMetadata, "az monitor metrics alert");
        expect(mentionsAlerts).toBe(true);
      } catch (e: unknown) {
        if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
          console.log("⏭️  SDK not loadable, skipping test");
          return;
        }
        throw e;
      }
    });
  });
});

