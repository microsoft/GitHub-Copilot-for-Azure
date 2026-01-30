/**
 * Trigger Tests for azure-prepare
 * 
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 */

import { TriggerMatcher } from '../utils/trigger-matcher';
import { loadSkill, LoadedSkill } from '../utils/skill-loader';

const SKILL_NAME = 'azure-prepare';

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe('Should Trigger', () => {
    const shouldTriggerPrompts: string[] = [
      // New Azure applications
      'Create a new Azure application',
      'Set up a new project for Azure deployment',
      'Prepare my application for Azure hosting',
      'I want to deploy my app to Azure',
      // Adding Azure services/components
      'Add Azure services to my existing app',
      'Add a new component to my Azure application',
      'Add new services to my existing Azure application',
      'I want to add Azure Functions to my app',
      // Modernizing applications
      'Modernize my application for Azure',
      'Modernize applications for Azure hosting',
      'Update my application for Azure deployment',
      // Infrastructure generation
      'Generate azure.yaml for my project',
      'Create Bicep files for my application',
      'Set up Azure infrastructure for my project',
      'Generate Terraform for Azure deployment',
      // Preparation workflows
      'Prepare my code for Azure deployment',
      'How do I prepare my app for Azure?',
      'Prepare applications for Azure hosting',
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
      'What is the weather today?',
      'Help me write a poem',
      'Explain quantum computing',
      'Help me with AWS Lambda functions',
      'What is the best pizza topping?',
      'How do I use Docker locally?',
      'Configure my local development environment',
      'Set up my Python virtual environment',
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
      const longPrompt = 'Azure prepare deployment infrastructure '.repeat(100);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe('boolean');
    });

    test('is case insensitive for Azure terms', () => {
      const result1 = triggerMatcher.shouldTrigger('PREPARE FOR AZURE DEPLOYMENT');
      const result2 = triggerMatcher.shouldTrigger('prepare for azure deployment');
      expect(result1.triggered).toBe(result2.triggered);
    });
  });
});
