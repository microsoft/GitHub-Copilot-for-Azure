/**
 * End-to-end test for Azure Functions MCP tool calls
 * 
 * This test runs WITHOUT early termination to verify that 
 * functions_template_get MCP tool is called.
 */

import {
  useAgentRunner,
  shouldSkipIntegrationTests,
} from "../utils/agent-runner";
import { getToolCalls, isSkillInvoked, withTestResult } from "../utils/evaluate";

const SKILL_NAME = "azure-prepare";

const skipTests = shouldSkipIntegrationTests();
const describeIntegration = skipTests ? describe.skip : describe;

describeIntegration("Azure Functions MCP Tool Calls", () => {
  const agent = useAgentRunner();

  // Helper function to verify MCP tool calls
  const verifyMcpCalls = (agentMetadata: any, testName: string) => {
    // Verify skill was invoked
    expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

    // Get all tool calls
    const allToolCalls = agentMetadata.events
      ?.filter((e: any) => e.type === "tool.execution_start")
      ?.map((e: any) => ({
        name: e.data?.toolName,
        arguments: e.data?.arguments
      })) || [];

    // Check for functions_template MCP call
    const functionsCalls = allToolCalls.filter((tc: any) => 
      tc.name?.includes("functions") || 
      tc.name?.includes("azure-functions") ||
      JSON.stringify(tc.arguments || {}).includes("functions_template")
    );

    console.log(`\n=== ${testName}: Functions-related Tool Calls ===`);
    functionsCalls.forEach((tc: any) => {
      console.log(`- ${tc.name}: ${JSON.stringify(tc.arguments)}`);
    });

    // Check for CDN manifest fallback
    const webFetchCalls = allToolCalls.filter((tc: any) =>
      tc.name === "web_fetch" && 
      JSON.stringify(tc.arguments || {}).includes("cdn.functions.azure")
    );

    if (webFetchCalls.length > 0) {
      console.log(`\n=== ${testName}: CDN Manifest Fallback Calls ===`);
      webFetchCalls.forEach((tc: any) => {
        console.log(`- ${tc.name}: ${JSON.stringify(tc.arguments)}`);
      });
    }

    const hasFunctionsTemplateCall = functionsCalls.length > 0;
    const hasCdnFallback = webFetchCalls.length > 0;

    expect(hasFunctionsTemplateCall || hasCdnFallback).toBe(true);
    
    return { functionsCalls, webFetchCalls };
  };

  test("calls functions_template_get MCP tool for Python HTTP trigger", async () => {
    await withTestResult(async () => {
      const agentMetadata = await agent.run({
        prompt: "Create a Python Azure Functions HTTP API and prepare it for deployment to Azure.",
        nonInteractive: true,
        followUp: ["Proceed"],
      });
      verifyMcpCalls(agentMetadata, "HTTP trigger");
    });
  }, 600000);

  test("calls functions_template_get MCP tool for Python Timer trigger", async () => {
    await withTestResult(async () => {
      const agentMetadata = await agent.run({
        prompt: "Create a Python Azure Functions timer trigger that runs every 5 minutes and prepare it for deployment.",
        nonInteractive: true,
        followUp: ["Proceed"],
      });
      verifyMcpCalls(agentMetadata, "Timer trigger");
    });
  }, 600000);

  test("calls functions_template_get MCP tool for Python Service Bus trigger", async () => {
    await withTestResult(async () => {
      const agentMetadata = await agent.run({
        prompt: "Create a Python Azure Functions app with Service Bus queue trigger and prepare it for deployment.",
        nonInteractive: true,
        followUp: ["Proceed"],
      });
      verifyMcpCalls(agentMetadata, "Service Bus trigger");
    });
  }, 600000);

  test("calls functions_template_get MCP tool for Python Cosmos DB trigger", async () => {
    await withTestResult(async () => {
      const agentMetadata = await agent.run({
        prompt: "Create a Python Azure Functions app with Cosmos DB change feed trigger and prepare it for deployment.",
        nonInteractive: true,
        followUp: ["Proceed"],
      });
      verifyMcpCalls(agentMetadata, "Cosmos DB trigger");
    });
  }, 600000);

  test("calls functions_template_get MCP tool for Python Event Hub trigger", async () => {
    await withTestResult(async () => {
      const agentMetadata = await agent.run({
        prompt: "Create a Python Azure Functions app with Event Hub trigger for streaming events and prepare it for deployment.",
        nonInteractive: true,
        followUp: ["Proceed"],
      });
      verifyMcpCalls(agentMetadata, "Event Hub trigger");
    });
  }, 600000);

  test("calls functions_template_get MCP tool for Python Blob Storage trigger", async () => {
    await withTestResult(async () => {
      const agentMetadata = await agent.run({
        prompt: "Create a Python Azure Functions app with Blob storage trigger using Event Grid and prepare it for deployment.",
        nonInteractive: true,
        followUp: ["Proceed"],
      });
      verifyMcpCalls(agentMetadata, "Blob Storage trigger");
    });
  }, 600000);

  test("calls functions_template_get MCP tool for Python Durable Functions", async () => {
    await withTestResult(async () => {
      const agentMetadata = await agent.run({
        prompt: "Create a Python Azure Durable Functions app with orchestrator pattern and prepare it for deployment.",
        nonInteractive: true,
        followUp: ["Proceed"],
      });
      verifyMcpCalls(agentMetadata, "Durable Functions");
    });
  }, 600000);

  test("calls functions_template_get MCP tool for Python SQL trigger", async () => {
    await withTestResult(async () => {
      const agentMetadata = await agent.run({
        prompt: "Create a Python Azure Functions app with SQL database trigger and prepare it for deployment.",
        nonInteractive: true,
        followUp: ["Proceed"],
      });
      verifyMcpCalls(agentMetadata, "SQL trigger");
    });
  }, 600000);
});
