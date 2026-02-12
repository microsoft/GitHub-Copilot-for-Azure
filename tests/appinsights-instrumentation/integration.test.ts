/**
 * Integration Tests for appinsights-instrumentation
 * 
 * Tests skill behavior with a real Copilot agent session.
 * Runs prompts multiple times to measure skill invocation rate.
 * 
 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 * 
 * Run with: npm run test:integration -- --testPathPattern=appinsights-instrumentation
 */

import * as fs from "fs";
import * as path from "path";
import {
  run,
  isSkillInvoked,
  doesAssistantMessageIncludeKeyword,
  shouldSkipIntegrationTests,
  getIntegrationSkipReason
} from "../utils/agent-runner";
import { doesWorkspaceFileIncludePattern } from "../utils/evaluate";

const SKILL_NAME = "appinsights-instrumentation";
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

describeIntegration(`${SKILL_NAME} - Integration Tests`, () => {
  describe("skill-invocation", () => {
    test("invokes skill for App Insights instrumentation request", async () => {
      let successCount = 0;

      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await run({
            prompt: "How do I add Application Insights to my ASP.NET Core web app?"
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
      console.log(`${SKILL_NAME} invocation rate for App Insights instrumentation prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`);
      fs.appendFileSync(`./result-${SKILL_NAME}.txt`, `${SKILL_NAME} invocation rate for App Insights instrumentation prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`);
      expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    });

    test("invokes skill for Node.js telemetry request", async () => {
      let successCount = 0;

      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await run({
            setup: async (workspace: string) => {
              // Create a package.json to indicate Node.js project
              fs.writeFileSync(
                path.join(workspace, "package.json"),
                JSON.stringify({ name: "test-app", version: "1.0.0" })
              );
            },
            prompt: "Add telemetry to my Node.js application"
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
      console.log(`${SKILL_NAME} invocation rate for Node.js telemetry prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`);
      fs.appendFileSync(`./result-${SKILL_NAME}.txt`, `${SKILL_NAME} invocation rate for Node.js telemetry prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`);
      expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    });
  });

  test("response mentions auto-instrumentation for ASP.NET Core App Service app", async () => {
    const agentMetadata = await run({
      setup: async (workspace: string) => {
        fs.cpSync("./appinsights-instrumentation/resources/aspnetcore-app/", workspace, { recursive: true });
      },
      prompt: "Add App Insights instrumentation to my C# web application in Azure App Service",
    });

    // C# ASP.Net Core App Service apps are special since they can be auto-instrumented
    const mentionsAutoInstrumentation = doesAssistantMessageIncludeKeyword(
      agentMetadata,
      "auto-instrument"
    );
    expect(mentionsAutoInstrumentation).toBe(true);
  });

  test("mentions App Insights in response", async () => {
    let workspacePath: string | undefined;
    const agentMetadata = await run({
      setup: async (workspace: string) => {
        workspacePath = workspace;
        fs.cpSync("./appinsights-instrumentation/resources/python-app/", workspace, { recursive: true });
      },
      prompt: "Instrument my Python web app with Application Insights in Azure Container App",
      preserveWorkspace: true
    });

    const mentionsAppInsights = doesAssistantMessageIncludeKeyword(
      agentMetadata,
      "App Insights"
    );
    const mentionsApplicationInsights = doesAssistantMessageIncludeKeyword(
      agentMetadata,
      "Application Insights"
    );

    let hasInstrumentationCode = false;
    if (workspacePath) {
      const instrumentationPatterns = [
        // Python patterns
        /from\s+azure\.monitor\.opentelemetry\s+import\s+configure_azure_monitor/,
        /configure_azure_monitor\s*\(/,
      ];

      hasInstrumentationCode = instrumentationPatterns.some(pattern =>
        doesWorkspaceFileIncludePattern(workspacePath!, pattern, /\.(py)$/)
      );
    }

    expect(mentionsAppInsights || mentionsApplicationInsights).toBe(true);
    expect(hasInstrumentationCode).toBe(true);
  });
});
