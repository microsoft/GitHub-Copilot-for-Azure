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
  getIntegrationSkipReason
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
  
  test('invokes azure-validation skill for storage naming question', async () => {
    let agentMetadata;
    try {
      agentMetadata = await run({
        prompt: 'What are the naming rules for Azure storage accounts?'
      });
    } catch (e: any) {
      if (e.message?.includes('Failed to load @github/copilot-sdk')) {
        console.log('⏭️  SDK not loadable, skipping test');
        return;
      }
      throw e;
    }

    const isSkillUsed = isSkillInvoked(agentMetadata, 'azure-validation');
    
    // Should mention key constraints
    const mentions24Chars = doesAssistantMessageIncludeKeyword(agentMetadata, '24');
    const mentionsLowercase = doesAssistantMessageIncludeKeyword(agentMetadata, 'lowercase');

    expect(isSkillUsed).toBe(true);
    expect(mentions24Chars).toBe(true);
    expect(mentionsLowercase).toBe(true);
  });

  test('provides Key Vault naming constraints', async () => {
    let agentMetadata;
    try {
      agentMetadata = await run({
        prompt: 'What are the naming constraints for Azure Key Vault?'
      });
    } catch (e: any) {
      if (e.message?.includes('Failed to load @github/copilot-sdk')) {
        console.log('⏭️  SDK not loadable, skipping test');
        return;
      }
      throw e;
    }

    const isSkillUsed = isSkillInvoked(agentMetadata, 'azure-validation');
    const mentionsKeyVault = doesAssistantMessageIncludeKeyword(agentMetadata, 'Key Vault');

    expect(isSkillUsed).toBe(true);
    expect(mentionsKeyVault).toBe(true);
  });

  test('validates a specific storage account name', async () => {
    let agentMetadata;
    try {
      agentMetadata = await run({
        prompt: 'Is "MyStorageAccount123" a valid Azure storage account name?'
      });
    } catch (e: any) {
      if (e.message?.includes('Failed to load @github/copilot-sdk')) {
        console.log('⏭️  SDK not loadable, skipping test');
        return;
      }
      throw e;
    }

    const isSkillUsed = isSkillInvoked(agentMetadata, 'azure-validation');
    // Should mention it's invalid due to uppercase
    const mentionsInvalid = doesAssistantMessageIncludeKeyword(agentMetadata, 'invalid') ||
                           doesAssistantMessageIncludeKeyword(agentMetadata, 'lowercase') ||
                           doesAssistantMessageIncludeKeyword(agentMetadata, 'not valid');

    expect(isSkillUsed).toBe(true);
    expect(mentionsInvalid).toBe(true);
  });
});