/**
 * Unit Tests for azure-aigateway
 * 
 * Test isolated skill logic and validation rules.
 */

import { loadSkill, LoadedSkill } from '../utils/skill-loader';

const SKILL_NAME = 'azure-aigateway';

describe(`${SKILL_NAME} - Unit Tests`, () => {
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
  });

  describe('Skill Metadata', () => {
    test('has valid SKILL.md with required fields', () => {
      expect(skill.metadata).toBeDefined();
      expect(skill.metadata.name).toBe(SKILL_NAME);
      expect(skill.metadata.description).toBeDefined();
      expect(skill.metadata.description.length).toBeGreaterThan(10);
    });

    test('description is concise and actionable', () => {
      // Descriptions should be 50-500 chars for readability
      expect(skill.metadata.description.length).toBeGreaterThan(50);
      expect(skill.metadata.description.length).toBeLessThan(500);
    });

    test('description mentions AI Gateway and APIM', () => {
      const desc = skill.metadata.description.toLowerCase();
      expect(desc).toMatch(/api management|apim|gateway|ai gateway/);
    });
  });

  describe('Skill Content', () => {
    test('has substantive content', () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(500);
    });

    test('contains overview section', () => {
      expect(skill.content).toMatch(/## Overview/i);
    });

    test('documents Basicv2 SKU as default', () => {
      expect(skill.content).toContain('Basicv2');
      expect(skill.content).toMatch(/Default to.*Basicv2/i);
    });

    test('documents semantic caching pattern', () => {
      expect(skill.content).toContain('Semantic Caching');
      expect(skill.content).toContain('azure-openai-semantic-cache-lookup');
    });

    test('documents token rate limiting', () => {
      expect(skill.content).toContain('Token Rate Limiting');
      expect(skill.content).toContain('azure-openai-token-limit');
    });

    test('documents content safety', () => {
      expect(skill.content).toContain('Content Safety');
      expect(skill.content).toContain('llm-content-safety');
    });

    test('documents managed identity authentication', () => {
      expect(skill.content).toContain('Managed Identity');
      expect(skill.content).toContain('authentication-managed-identity');
    });

    test('documents load balancing with retry', () => {
      expect(skill.content).toContain('Load Balancing');
      expect(skill.content).toMatch(/retry/i);
    });

    test('documents MCP server conversion', () => {
      expect(skill.content).toMatch(/Convert.*API.*to.*MCP|MCP.*from.*API/i);
    });

    test('includes Azure AI Gateway repository link', () => {
      expect(skill.content).toContain('https://github.com/Azure-Samples/AI-Gateway');
    });

    test('references Microsoft Learn documentation', () => {
      expect(skill.content).toContain('learn.microsoft.com');
    });

    test('includes Bicep templates', () => {
      expect(skill.content).toMatch(/```bicep/);
    });

    test('includes policy XML examples', () => {
      expect(skill.content).toMatch(/```xml/);
    });

    test('documents deployment patterns', () => {
      expect(skill.content).toMatch(/Pattern \d+:/);
      // Should have multiple patterns
      const patternMatches = skill.content.match(/Pattern \d+:/g);
      expect(patternMatches).toBeDefined();
      expect(patternMatches!.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('APIM Configuration', () => {
    test('recommends Basicv2 SKU', () => {
      expect(skill.content).toMatch(/Basicv2.*SKU/);
    });

    test('documents SKU benefits', () => {
      expect(skill.content).toMatch(/Cheaper|cheaper/);
      expect(skill.content).toMatch(/Creates quickly|quick/i);
    });

    test('includes resource group creation', () => {
      expect(skill.content).toContain('az group create');
    });

    test('includes APIM service deployment', () => {
      expect(skill.content).toContain('Microsoft.ApiManagement/service');
    });
  });

  describe('Policy Configuration', () => {
    test('documents semantic caching parameters', () => {
      expect(skill.content).toContain('score-threshold');
      expect(skill.content).toContain('embeddings-backend-id');
      expect(skill.content).toContain('duration');
    });

    test('documents token limit parameters', () => {
      expect(skill.content).toContain('counter-key');
      expect(skill.content).toContain('tokens-per-minute');
      expect(skill.content).toContain('estimate-prompt-tokens');
    });

    test('documents content safety categories', () => {
      expect(skill.content).toContain('Hate');
      expect(skill.content).toContain('Sexual');
      expect(skill.content).toContain('SelfHarm');
      expect(skill.content).toContain('Violence');
    });

    test('documents rate limiting options', () => {
      expect(skill.content).toContain('rate-limit-by-key');
      expect(skill.content).toContain('calls');
      expect(skill.content).toContain('renewal-period');
    });
  });

  describe('Best Practices', () => {
    test('includes best practices section', () => {
      expect(skill.content).toMatch(/## Best Practices/i);
    });

    test('recommends managed identity over API keys', () => {
      expect(skill.content).toMatch(/managed identity.*API keys/i);
    });

    test('recommends token metrics', () => {
      expect(skill.content).toContain('azure-openai-emit-token-metric');
    });
  });

  describe('Troubleshooting', () => {
    test('includes troubleshooting section', () => {
      expect(skill.content).toMatch(/## Troubleshooting/i);
    });

    test('documents common issues', () => {
      expect(skill.content).toMatch(/Slow APIM creation|Token limit exceeded|Cache not working/);
    });
  });
});
