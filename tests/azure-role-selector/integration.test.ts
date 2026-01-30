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
  run, 
  isSkillInvoked, 
  areToolCallsSuccess, 
  doesAssistantMessageIncludeKeyword,
  shouldSkipIntegrationTests 
} from '../utils/agent-runner';

const SKILL_NAME: string = 'azure-role-selector';

// Skip integration tests in CI or when SKIP_INTEGRATION_TESTS is set
const describeIntegration = shouldSkipIntegrationTests() ? describe.skip : describe;

describeIntegration(`${SKILL_NAME} - Integration Tests`, () => {
  
  test('invokes azure-role-selector skill for AcrPull prompt', async () => {
    const agentMetadata = await run({
      prompt: 'What role should I assign to my managed identity to read images in an Azure Container Registry?'
    });

    const isAzureRoleSelectorSkillUsed = isSkillInvoked(agentMetadata, 'azure-role-selector');
    const isAcrPullRoleMentioned = doesAssistantMessageIncludeKeyword(agentMetadata, 'AcrPull');
    const areDocumentationToolCallsSuccess = areToolCallsSuccess(agentMetadata, 'azure-documentation');

    expect(isAzureRoleSelectorSkillUsed).toBe(true);
    expect(isAcrPullRoleMentioned).toBe(true);
    expect(areDocumentationToolCallsSuccess).toBe(true);
  });

  test('recommends Storage Blob Data Reader for blob read access', async () => {
    const agentMetadata = await run({
      prompt: 'What Azure role should I use to give my app read-only access to blob storage?'
    });

    const isSkillUsed = isSkillInvoked(agentMetadata, 'azure-role-selector');
    const mentionsStorageRole = doesAssistantMessageIncludeKeyword(agentMetadata, 'Storage Blob Data Reader');

    expect(isSkillUsed).toBe(true);
    expect(mentionsStorageRole).toBe(true);
  });

  test('recommends Key Vault Secrets User for secret access', async () => {
    const agentMetadata = await run({
      prompt: 'What role do I need to read secrets from Azure Key Vault?'
    });

    const isSkillUsed = isSkillInvoked(agentMetadata, 'azure-role-selector');
    const mentionsKeyVaultRole = doesAssistantMessageIncludeKeyword(agentMetadata, 'Key Vault');

    expect(isSkillUsed).toBe(true);
    expect(mentionsKeyVaultRole).toBe(true);
  });

});
