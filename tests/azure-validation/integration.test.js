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

const agentRunner = require('../utils/agent-runner');

const SKILL_NAME = 'azure-validation';

// Use centralized skip logic from agent-runner
const describeIntegration = agentRunner.shouldSkipIntegrationTests() ? describe.skip : describe;

describeIntegration('azure-validation integration tests', () => {
  describe('skill invocation', () => {
    test('invokes skill for storage account naming validation', async () => {

      const agentMetadata = await agentRunner.run({
        prompt: 'Is mycompanyproductionstorage a valid Azure storage account name?'
      });

      expect(agentRunner.isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
    }, 60000);

    test('invokes skill for key vault naming validation', async () => {
      const agentMetadata = await agentRunner.run({
        prompt: 'Validate my Azure key vault name: my-application-keyvault-prod'
      });

      expect(agentRunner.isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
    }, 60000);

    test('invokes skill for Bicep validation requests', async () => {
      const agentMetadata = await agentRunner.run({
        prompt: 'Can you validate my Bicep template before I deploy it?'
      });

      expect(agentRunner.isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
    }, 60000);

    test('invokes skill for pre-deployment checks', async () => {
      const agentMetadata = await agentRunner.run({
        prompt: 'What should I validate before deploying to Azure?'
      });

      expect(agentRunner.isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
    }, 60000);
  });

  describe('response quality', () => {
    test('mentions character limits for storage accounts', async () => {
      const agentMetadata = await agentRunner.run({
        prompt: 'What are the naming rules for Azure storage accounts?'
      });

      expect(agentRunner.doesAssistantMessageIncludeKeyword(agentMetadata, '24')).toBe(true);
    }, 60000);

    test('explains naming constraints for container registry', async () => {
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
      const agentMetadata = await agentRunner.run({
        prompt: 'Check my Azure quota before deployment'
      });

      const toolCalls = agentRunner.getToolCalls(agentMetadata);
      if (toolCalls && toolCalls.length > 0) {
        expect(agentRunner.areToolCallsSuccess(agentMetadata, 'skill')).toBe(true);
      }
    }, 60000);
  });
});
