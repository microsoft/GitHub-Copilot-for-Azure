/**
 * Integration Tests for azure-validation
 * 
 * Tests skill behavior with a real Copilot agent session.
 * 
 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 */

import { 
  run, 
  isSkillInvoked, 
  doesAssistantMessageIncludeKeyword,
  shouldSkipIntegrationTests 
} from '../utils/agent-runner';

const SKILL_NAME = 'azure-validation';

// Skip integration tests in CI or when SKIP_INTEGRATION_TESTS is set
const describeIntegration = shouldSkipIntegrationTests() ? describe.skip : describe;

describeIntegration(`${SKILL_NAME} - Integration Tests`, () => {
  
  test('invokes azure-validation skill for storage naming question', async () => {
    const agentMetadata = await run({
      prompt: 'What are the naming rules for Azure storage accounts?'
    });

    const isSkillUsed = isSkillInvoked(agentMetadata, 'azure-validation');
    
    // Should mention key constraints
    const mentions24Chars = doesAssistantMessageIncludeKeyword(agentMetadata, '24');
    const mentionsLowercase = doesAssistantMessageIncludeKeyword(agentMetadata, 'lowercase');

    expect(isSkillUsed).toBe(true);
    expect(mentions24Chars).toBe(true);
    expect(mentionsLowercase).toBe(true);
  });

  test('provides Key Vault naming constraints', async () => {
    const agentMetadata = await run({
      prompt: 'What are the naming constraints for Azure Key Vault?'
    });

    const isSkillUsed = isSkillInvoked(agentMetadata, 'azure-validation');
    const mentionsKeyVault = doesAssistantMessageIncludeKeyword(agentMetadata, 'Key Vault');

    expect(isSkillUsed).toBe(true);
    expect(mentionsKeyVault).toBe(true);
  });

  test('validates a specific storage account name', async () => {
    const agentMetadata = await run({
      prompt: 'Is "MyStorageAccount123" a valid Azure storage account name?'
    });

    const isSkillUsed = isSkillInvoked(agentMetadata, 'azure-validation');
    // Should mention it's invalid due to uppercase
    const mentionsInvalid = doesAssistantMessageIncludeKeyword(agentMetadata, 'invalid') ||
                           doesAssistantMessageIncludeKeyword(agentMetadata, 'lowercase') ||
                           doesAssistantMessageIncludeKeyword(agentMetadata, 'not valid');

    expect(isSkillUsed).toBe(true);
    expect(mentionsInvalid).toBe(true);
  });
});