/**
 * Integration Tests for azure-resource-lookup
 * 
 * Tests skill behavior with a real Copilot agent session.
 * Prompts sourced from Azure MCP Server README, especially
 * App Service and cross-subscription queries that struggle.
 *
 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 * 3. az login && az account set --subscription <sub>
 */

import {
  useAgentRunner,
  isSkillInvoked,
  doesAssistantMessageIncludeKeyword,
  shouldSkipIntegrationTests
} from "../utils/agent-runner";

const SKILL_NAME = "azure-resource-lookup";

const describeIntegration = shouldSkipIntegrationTests() ? describe.skip : describe;

describeIntegration(`${SKILL_NAME}_ - Integration Tests`, () => {
  const agent = useAgentRunner();

  // Cross-subscription resource queries (ARG sweet spot)
  test("handles cross-subscription resource inventory", async () => {
    const agentMetadata = await agent.run({
      prompt: "How many resources do I have by type across all subscriptions?"
    });

    const hasResourceInfo = doesAssistantMessageIncludeKeyword(agentMetadata, "resource");
    expect(hasResourceInfo).toBe(true);
  });

  test("finds resources by location", async () => {
    const agentMetadata = await agent.run({
      prompt: "Show me resources by location across subscriptions"
    });

    const hasLocationInfo = doesAssistantMessageIncludeKeyword(agentMetadata, "location");
    expect(hasLocationInfo).toBe(true);
  });

  // Orphaned resource discovery
  test("finds orphaned disks", async () => {
    const agentMetadata = await agent.run({
      prompt: "Find orphaned or unattached disks in my subscription"
    });

    const hasDiskInfo = doesAssistantMessageIncludeKeyword(agentMetadata, "disk");
    expect(hasDiskInfo).toBe(true);
  });

  // Tag compliance queries
  test("finds resources missing tags", async () => {
    const agentMetadata = await agent.run({
      prompt: "Find resources missing required tags in my subscription"
    });

    const hasTagInfo = doesAssistantMessageIncludeKeyword(agentMetadata, "tag");
    expect(hasTagInfo).toBe(true);
  });

  // App Service prompts (known to struggle per test results)
  test("lists websites in subscription", async () => {
    const agentMetadata = await agent.run({
      prompt: "List the websites in my subscription"
    });

    const hasWebInfo =
      doesAssistantMessageIncludeKeyword(agentMetadata, "web") ||
      doesAssistantMessageIncludeKeyword(agentMetadata, "app") ||
      doesAssistantMessageIncludeKeyword(agentMetadata, "site");
    expect(hasWebInfo).toBe(true);
  });

  // Resource health queries
  test("checks resource health status", async () => {
    const agentMetadata = await agent.run({
      prompt: "Find resources in unhealthy or degraded state"
    });

    const hasHealthInfo =
      doesAssistantMessageIncludeKeyword(agentMetadata, "health") ||
      doesAssistantMessageIncludeKeyword(agentMetadata, "available") ||
      doesAssistantMessageIncludeKeyword(agentMetadata, "resource");
    expect(hasHealthInfo).toBe(true);
  });

  // Skill invocation test
  test("skill should be invoked for resource listing prompts", async () => {
    const agentMetadata = await agent.run({
      prompt: "List the websites in my subscription"
    });

    const skillInvoked = isSkillInvoked(agentMetadata, SKILL_NAME);
    expect(skillInvoked).toBe(true);
  });
});
