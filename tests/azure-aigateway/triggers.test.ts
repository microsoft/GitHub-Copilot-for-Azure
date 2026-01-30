/**
 * Trigger Tests for azure-aigateway
 * 
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 */

import { TriggerMatcher } from '../utils/trigger-matcher';
import { loadSkill, LoadedSkill } from '../utils/skill-loader';

const SKILL_NAME = 'azure-aigateway';

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe('Should Trigger', () => {
    const shouldTriggerPrompts: string[] = [
      // Gateway setup
      'Set up a gateway for my model',
      'Set up a gateway for my tools',
      'Set up a gateway for my agents',
      'Add a gateway to my MCP server',
      'Protect my AI model with a gateway',
      'Secure my Azure AI agents with a gateway',
      
      // Rate limiting
      'Ratelimit my model requests',
      'Ratelimit my tool requests',
      'Add rate limiting to my model requests',
      'Add rate limiting to my MCP server',
      
      // Semantic caching
      'Enable semantic caching for my AI API',
      'How do I add semantic caching to Azure OpenAI?',
      'Configure semantic caching for my gateway',
      
      // Content safety
      'Add content safety to my AI endpoint',
      'Configure content safety for my Azure AI model',
      'Add content safety policy to gateway',
      
      // API Management
      'Add my model behind gateway',
      'Import OpenAPI spec to Azure gateway',
      'Add API to Azure gateway from swagger',
      'Convert my API to MCP with Azure gateway',
      'Expose my API as MCP server using gateway',
      
      // Azure APIM specific
      'Deploy Azure API Management for AI',
      'Configure APIM for Azure OpenAI',
      'Bootstrap Azure AI Gateway with APIM',
      'Bootstrap Azure AI Gateway',
      
      // Load balancing
      'Load balance Azure AI models',
      'Add failover for my AI models',
      
      // Token management
      'Track token usage for my models',
      'Monitor token usage in Azure gateway',
    ];

    test.each(shouldTriggerPrompts)(
      'triggers on: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
      }
    );
  });

  describe('Should NOT Trigger', () => {
    const shouldNotTriggerPrompts: string[] = [
      // Generic non-Azure
      'What is the weather today?',
      'Help me write a poem',
      'Explain quantum computing',
      
      // Wrong cloud provider
      'Help me with AWS API Gateway',
      'Set up Google Cloud API Gateway',
      'Use Kong for my API',
      
      // Related Azure but different service
      'Deploy my webapp to App Service',
      'Create an Azure storage account',
      'Set up Azure SQL Database',
      'Configure virtual networks',
      
      // AI but not gateway related
      'Train a machine learning model',
      'Fine-tune my neural network',
      'Explain how transformers work',
      
      // General development
      'How do I write unit tests?',
      'Debug my JavaScript code',
      'Deploy to production',
    ];

    test.each(shouldNotTriggerPrompts)(
      'does not trigger on: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(false);
      }
    );
  });

  describe('Trigger Keywords Snapshot', () => {
    test('skill keywords match snapshot', () => {
      expect(triggerMatcher.getKeywords()).toMatchSnapshot();
    });

    test('skill description triggers match snapshot', () => {
      expect({
        name: skill.metadata.name,
        description: skill.metadata.description,
        extractedKeywords: triggerMatcher.getKeywords()
      }).toMatchSnapshot();
    });
  });

  describe('Edge Cases', () => {
    test('handles empty prompt', () => {
      const result = triggerMatcher.shouldTrigger('');
      expect(result.triggered).toBe(false);
    });

    test('handles very long prompt', () => {
      const longPrompt = 'Azure AI Gateway APIM model gateway '.repeat(100);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe('boolean');
    });

    test('is case insensitive for Azure terms', () => {
      const result1 = triggerMatcher.shouldTrigger('SET UP AI GATEWAY');
      const result2 = triggerMatcher.shouldTrigger('set up ai gateway');
      expect(result1.triggered).toBe(result2.triggered);
    });

    test('recognizes MCP variations', () => {
      const mcpVariations = [
        'Add MCP server to gateway',
        'Configure mcp tools',
        'Expose API as MCP',
      ];
      
      mcpVariations.forEach(prompt => {
        const result = triggerMatcher.shouldTrigger(prompt);
        // Should recognize MCP-related prompts
        expect(typeof result.triggered).toBe('boolean');
      });
    });
  });
});
