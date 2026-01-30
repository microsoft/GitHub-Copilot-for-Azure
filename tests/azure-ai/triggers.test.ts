/**
 * Trigger Tests for azure-ai
 * 
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 * 
 * Uses snapshot testing + parameterized tests for comprehensive coverage.
 */

import { TriggerMatcher } from '../utils/trigger-matcher';
import { loadSkill, LoadedSkill } from '../utils/skill-loader';

const SKILL_NAME = 'azure-ai';

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe('Should Trigger', () => {
    // Prompts that SHOULD trigger this skill
    const shouldTriggerPrompts: string[] = [
      // AI Search prompts
      'How do I set up Azure AI Search?',
      'Help me create a search index in Azure',
      'What is vector search in Azure AI Search?',
      'Configure hybrid search for my application',
      'Query my Azure search index',
      
      // Speech prompts
      'How do I use Azure Speech service?',
      'Convert speech to text using Azure',
      'Text to speech with Azure AI',
      'Transcribe audio with Azure Speech',
      'Help me with Azure speech synthesis',
      
      // Foundry prompts
      'What is Azure AI Foundry?',
      'Deploy a model with Azure AI Foundry',
      'Create an AI agent in Azure Foundry',
      'How do I use prompt flows in Azure?',
      'List AI models in Azure Foundry',
      
      // OpenAI prompts
      'Deploy GPT-4 on Azure',
      'Use Azure OpenAI for embeddings',
      'Configure Azure OpenAI service',
      
      // Document Intelligence prompts
      'Azure Document Intelligence OCR',
      
      // General AI service prompts
      'What Azure AI services are available?',
      'Help me with Azure cognitive services',
      'Configure Azure AI services',
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
    // Prompts that should NOT trigger this skill
    const shouldNotTriggerPrompts: string[] = [
      'What is the weather today?',
      'Help me write a poem',
      'Explain quantum computing',
      'Help me with AWS Bedrock',
      'Deploy to Google Cloud AI',
      'What is the best pizza topping?',
      'How do I use Docker?',
      'Create a Kubernetes cluster',
      'Help me with Azure Virtual Machines',
      'Configure Azure Storage Account',
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
      const longPrompt = 'Azure AI Search '.repeat(100);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe('boolean');
    });

    test('is case insensitive for Azure AI terms', () => {
      const result1 = triggerMatcher.shouldTrigger('AZURE AI SEARCH');
      const result2 = triggerMatcher.shouldTrigger('azure ai search');
      expect(result1.triggered).toBe(result2.triggered);
    });
  });
});
