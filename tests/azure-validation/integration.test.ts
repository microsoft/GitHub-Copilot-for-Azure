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
  shouldSkipIntegrationTests,
  getIntegrationSkipReason,
  canLoadCopilotSdk
} from '../utils/agent-runner';

const SKILL_NAME = 'azure-validation';

// Check if integration tests should be skipped at module level
const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

// Log skip reason if skipping
if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

describeIntegration(`${SKILL_NAME} - Integration Tests`, () => {
  let sdkAvailable = false;

  beforeAll(async () => {
    sdkAvailable = await canLoadCopilotSdk();
    if (!sdkAvailable) {
      console.log('⏭️  Copilot SDK could not be loaded - skipping integration tests');
    }
  });

  test('invokes azure-validation skill for storage naming question', async () => {
    if (!sdkAvailable) {
      console.log('SDK not available, skipping test');
      return;
    }
    
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
    if (!sdkAvailable) {
      console.log('SDK not available, skipping test');
      return;
    }
    
    const agentMetadata = await run({
      prompt: 'What are the naming constraints for Azure Key Vault?'
    });

    const isSkillUsed = isSkillInvoked(agentMetadata, 'azure-validation');
    const mentionsKeyVault = doesAssistantMessageIncludeKeyword(agentMetadata, 'Key Vault');

    expect(isSkillUsed).toBe(true);
    expect(mentionsKeyVault).toBe(true);
  });

  test('validates a specific storage account name', async () => {
    if (!sdkAvailable) {
      console.log('SDK not available, skipping test');
      return;
    }
    
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