/**
 * Integration Tests for {SKILL_NAME}
 * 
 * Tests skill behavior with mocked MCP tools and external dependencies.
 * Copy this file to /tests/{skill-name}/integration.test.js
 */

const { createMcpMock } = require('../utils/mcp-mock');
const { loadSkill } = require('../utils/skill-loader');
const { loadFixtures } = require('../utils/fixtures');

// Replace with your skill name
const SKILL_NAME = 'your-skill-name';

describe(`${SKILL_NAME} - Integration Tests`, () => {
  let skill;
  let mcpMock;
  let fixtures;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    fixtures = loadFixtures(SKILL_NAME);
  });

  beforeEach(() => {
    mcpMock = createMcpMock();
  });

  afterEach(() => {
    mcpMock.reset();
  });

  describe('MCP Tool Interactions', () => {
    test('example: mocking azure__bicepschema response', async () => {
      // Setup mock response
      mcpMock.mockResponse('azure__bicepschema', {
        schema: {
          type: 'Microsoft.Storage/storageAccounts',
          properties: {
            name: { type: 'string', minLength: 3, maxLength: 24 }
          }
        }
      });

      // Your test logic here
      // const result = await skill.someFunction(mcpMock);
      // expect(result).toBeDefined();

      // Verify mock was called
      // expect(mcpMock.getCalls('azure__bicepschema')).toHaveLength(1);
    });

    test('handles MCP tool errors gracefully', async () => {
      mcpMock.mockError('azure__bicepschema', new Error('Service unavailable'));

      // Your error handling test here
      // expect(() => skill.someFunction(mcpMock)).not.toThrow();
    });
  });

  describe('Fixture-Based Tests', () => {
    test('processes sample input correctly', () => {
      // Use fixtures for realistic test data
      // const input = fixtures.sampleInput;
      // const expected = fixtures.expectedOutput;
      // const result = skill.process(input);
      // expect(result).toEqual(expected);
    });
  });

  // Add skill-specific integration tests below
});
