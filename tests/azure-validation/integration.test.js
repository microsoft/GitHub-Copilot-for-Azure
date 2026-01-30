/**
 * Integration tests for the azure-validation skill.
 * These tests use the real Copilot agent to verify skill behavior.
 * 
 * Prerequisites:
 * - Copilot CLI authenticated (gh copilot auth)
 * - GitHub token with appropriate scopes
 * 
 * Run: npm run test:integration -- --testPathPattern=azure-validation
 */

// Check if SDK is available before loading agent-runner
let agentRunner = null;
let sdkAvailable = false;

try {
  // Test if SDK can be resolved
  require.resolve('@github/copilot-sdk');
  agentRunner = require('../utils/agent-runner');
  sdkAvailable = true;
} catch {
  sdkAvailable = false;
}

const SKILL_NAME = 'azure-validation';

// Helper to check if tests should skip
const shouldSkip = () => !sdkAvailable || process.env.CI === 'true' || process.env.SKIP_INTEGRATION_TESTS === 'true';

describe('azure-validation integration tests', () => {
  // Skip all tests if integration testing requirements not met
  beforeAll(() => {
    if (shouldSkip()) {
      console.log('Skipping integration tests - SDK not available, CI environment, or SKIP_INTEGRATION_TESTS set');
    }
  });

  describe('skill invocation', () => {
    test('invokes skill for storage account naming validation', async () => {
      if (shouldSkip()) return;

      const agentMetadata = await agentRunner.run({
        prompt: 'Is mycompanyproductionstorage a valid Azure storage account name?'
      });

      expect(agentRunner.isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
    }, 60000);

    test('invokes skill for key vault naming validation', async () => {
      if (shouldSkip()) return;

      const agentMetadata = await agentRunner.run({
        prompt: 'Validate my Azure key vault name: my-application-keyvault-prod'
      });

      expect(agentRunner.isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
    }, 60000);

    test('invokes skill for Bicep validation requests', async () => {
      if (shouldSkip()) return;

      const agentMetadata = await agentRunner.run({
        prompt: 'Can you validate my Bicep template before I deploy it?'
      });

      expect(agentRunner.isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
    }, 60000);

    test('invokes skill for pre-deployment checks', async () => {
      if (shouldSkip()) return;

      const agentMetadata = await agentRunner.run({
        prompt: 'What should I validate before deploying to Azure?'
      });

      expect(agentRunner.isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
    }, 60000);
  });

  describe('response quality', () => {
    test('mentions character limits for storage accounts', async () => {
      if (shouldSkip()) return;

      const agentMetadata = await agentRunner.run({
        prompt: 'What are the naming rules for Azure storage accounts?'
      });

      expect(agentRunner.doesAssistantMessageIncludeKeyword(agentMetadata, '24')).toBe(true);
    }, 60000);

    test('explains naming constraints for container registry', async () => {
      if (shouldSkip()) return;

      const agentMetadata = await agentRunner.run({
        prompt: 'Validate my ACR name: my-container-registry'
      });

      // Should mention hyphens are not allowed
      expect(
        agentRunner.doesAssistantMessageIncludeKeyword(agentMetadata, 'hyphen') ||
        agentRunner.doesAssistantMessageIncludeKeyword(agentMetadata, 'alphanumeric')
      ).toBe(true);
    }, 60000);
  });

  describe('tool calls', () => {
    test('tool calls succeed for quota check prompts', async () => {
      if (shouldSkip()) return;

      const agentMetadata = await agentRunner.run({
        prompt: 'Check my Azure quota before deployment'
      });

      const toolCalls = agentRunner.getToolCalls(agentMetadata);
      if (toolCalls && toolCalls.length > 0) {
        expect(agentRunner.areToolCallsSuccess(agentMetadata)).toBe(true);
      }
    }, 60000);
  });
});
