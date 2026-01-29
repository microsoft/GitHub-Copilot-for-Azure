/**
 * Integration Tests for azure-validation
 */

const { createMcpMock } = require('../utils/mcp-mock');
const { loadSkill } = require('../utils/skill-loader');

const SKILL_NAME = 'azure-validation';

describe(`${SKILL_NAME} - Integration Tests`, () => {
  let skill;
  let mcpMock;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
  });

  beforeEach(() => {
    mcpMock = createMcpMock();
  });

  afterEach(() => {
    mcpMock.reset();
  });

  describe('Bicep Schema Tool Usage', () => {
    test('can mock bicep schema for storage account', async () => {
      mcpMock.mockResponse('azure__bicepschema', {
        type: 'Microsoft.Storage/storageAccounts',
        apiVersion: '2023-01-01',
        properties: {
          name: {
            type: 'string',
            minLength: 3,
            maxLength: 24,
            pattern: '^[a-z0-9]+$'
          }
        }
      });

      const result = await mcpMock.call('azure__bicepschema', {
        'resource-type': 'Microsoft.Storage/storageAccounts'
      });

      expect(result.type).toBe('Microsoft.Storage/storageAccounts');
      expect(result.properties.name.maxLength).toBe(24);
      expect(mcpMock.wasCalled('azure__bicepschema')).toBe(true);
    });

    test('can mock bicep schema for key vault', async () => {
      mcpMock.mockResponse('azure__bicepschema', {
        type: 'Microsoft.KeyVault/vaults',
        properties: {
          name: { maxLength: 24 }
        }
      });

      const result = await mcpMock.call('azure__bicepschema');
      expect(result.type).toBe('Microsoft.KeyVault/vaults');
    });
  });

  describe('Deploy Tool Usage', () => {
    test('can mock deploy IaC rules response', async () => {
      mcpMock.mockResponse('azure__deploy', {
        rules: [
          'Use lowercase for resource names',
          'Follow naming conventions',
          'Validate before deploying'
        ]
      });

      const result = await mcpMock.call('azure__deploy', {
        command: 'deploy_iac_rules_get',
        'deployment-tool': 'AZD',
        'iac-type': 'bicep'
      });

      expect(result.rules).toContain('Use lowercase for resource names');
      expect(mcpMock.getCallCount('azure__deploy')).toBe(1);
    });
  });

  describe('Error Handling', () => {
    test('handles bicep schema service unavailable', async () => {
      mcpMock.mockError('azure__bicepschema', new Error('Service unavailable'));

      await expect(mcpMock.call('azure__bicepschema'))
        .rejects.toThrow('Service unavailable');
    });

    test('handles missing resource type', async () => {
      mcpMock.mockResponse('azure__bicepschema', {
        error: 'Resource type not found'
      });

      const result = await mcpMock.call('azure__bicepschema', {
        'resource-type': 'Microsoft.Invalid/type'
      });

      expect(result.error).toBe('Resource type not found');
    });
  });

  describe('Mock Call Tracking', () => {
    test('tracks multiple calls to same tool', async () => {
      mcpMock.mockResponse('azure__bicepschema', { type: 'test' });

      await mcpMock.call('azure__bicepschema', { query: 'first' });
      await mcpMock.call('azure__bicepschema', { query: 'second' });
      await mcpMock.call('azure__bicepschema', { query: 'third' });

      expect(mcpMock.getCallCount('azure__bicepschema')).toBe(3);
      
      const calls = mcpMock.getCalls('azure__bicepschema');
      expect(calls[0].params.query).toBe('first');
      expect(calls[2].params.query).toBe('third');
    });

    test('reset clears call history', async () => {
      mcpMock.mockResponse('azure__bicepschema', { type: 'test' });
      await mcpMock.call('azure__bicepschema');
      
      expect(mcpMock.wasCalled('azure__bicepschema')).toBe(true);
      
      mcpMock.reset();
      
      expect(mcpMock.wasCalled('azure__bicepschema')).toBe(false);
    });
  });
});
