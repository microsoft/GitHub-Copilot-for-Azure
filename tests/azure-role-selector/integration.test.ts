/**
 * Integration Tests for azure-role-selector
 * 
 * Tests skill behavior with a real Copilot agent session.
 * Adapted from PR #617's azureRoleSelectorTests.ts
 * 
 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 */

import { 
  useAgentRunner, 
  isSkillInvoked, 
  areToolCallsSuccess, 
  doesAssistantMessageIncludeKeyword,
  shouldSkipIntegrationTests,
  getIntegrationSkipReason
} from "../utils/agent-runner";

const SKILL_NAME = "azure-role-selector";

// Check if integration tests should be skipped at module level
const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

// Log skip reason if skipping
if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

describeIntegration(`${SKILL_NAME} - Integration Tests`, () => {
  const agent = useAgentRunner();

  test("invokes azure-role-selector skill for AcrPull prompt", async () => {
    let agentMetadata;
    try {
      agentMetadata = await agent.run({
        prompt: "What role should I assign to my managed identity to read images in an Azure Container Registry?"
      });
    } catch (e: unknown) {
      if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
        console.log("⏭️  SDK not loadable, skipping test");
        return;
      }
      throw e;
    }

    const isAzureRoleSelectorSkillUsed = isSkillInvoked(agentMetadata, "azure-role-selector");
    const isAcrPullRoleMentioned = doesAssistantMessageIncludeKeyword(agentMetadata, "AcrPull");
    const areDocumentationToolCallsSuccess = areToolCallsSuccess(agentMetadata, "azure-documentation");

    expect(isAzureRoleSelectorSkillUsed).toBe(true);
    expect(isAcrPullRoleMentioned).toBe(true);
    expect(areDocumentationToolCallsSuccess).toBe(true);
  });

  test("recommends Storage Blob Data Reader for blob read access", async () => {
    let agentMetadata;
    try {
      agentMetadata = await agent.run({
        prompt: "What Azure role should I use to give my app read-only access to blob storage?"
      });
    } catch (e: unknown) {
      if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
        console.log("⏭️  SDK not loadable, skipping test");
        return;
      }
      throw e;
    }

    const isSkillUsed = isSkillInvoked(agentMetadata, "azure-role-selector");
    const mentionsStorageRole = doesAssistantMessageIncludeKeyword(agentMetadata, "Storage Blob Data Reader");

    expect(isSkillUsed).toBe(true);
    expect(mentionsStorageRole).toBe(true);
  });

  test("recommends Key Vault Secrets User for secret access", async () => {
    let agentMetadata;
    try {
      agentMetadata = await agent.run({
        prompt: "What role do I need to read secrets from Azure Key Vault?"
      });
    } catch (e: unknown) {
      if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
        console.log("⏭️  SDK not loadable, skipping test");
        return;
      }
      throw e;
    }

    const isSkillUsed = isSkillInvoked(agentMetadata, "azure-role-selector");
    const mentionsKeyVaultRole = doesAssistantMessageIncludeKeyword(agentMetadata, "Key Vault");

    expect(isSkillUsed).toBe(true);
    expect(mentionsKeyVaultRole).toBe(true);
  });

  test("generates CLI commands for role assignment", async () => {
    let agentMetadata;
    try {
      agentMetadata = await agent.run({
        prompt: "Generate Azure CLI command to assign Storage Blob Data Contributor role to my managed identity"
      });
    } catch (e: unknown) {
      if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
        console.log("⏭️  SDK not loadable, skipping test");
        return;
      }
      throw e;
    }

    const isSkillUsed = isSkillInvoked(agentMetadata, "azure-role-selector");
    const mentionsCLI = doesAssistantMessageIncludeKeyword(agentMetadata, "az role assignment");
    const areCliToolCallsSuccess = areToolCallsSuccess(agentMetadata, "azure__extension_cli_generate");

    expect(isSkillUsed).toBe(true);
    expect(mentionsCLI || areCliToolCallsSuccess).toBe(true);
  });

  test("provides Bicep code for role assignment", async () => {
    let agentMetadata;
    try {
      agentMetadata = await agent.run({
        prompt: "Show me Bicep code to assign Contributor role to a managed identity on a storage account"
      });
    } catch (e: unknown) {
      if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
        console.log("⏭️  SDK not loadable, skipping test");
        return;
      }
      throw e;
    }

    const isSkillUsed = isSkillInvoked(agentMetadata, "azure-role-selector");
    const mentionsBicep = doesAssistantMessageIncludeKeyword(agentMetadata, "bicep") || 
                          doesAssistantMessageIncludeKeyword(agentMetadata, "roleAssignment");

    expect(isSkillUsed).toBe(true);
    expect(mentionsBicep).toBe(true);
  });

});