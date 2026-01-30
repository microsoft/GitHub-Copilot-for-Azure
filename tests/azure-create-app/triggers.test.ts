/**
 * Trigger Tests for azure-create-app
 * 
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 */

import { TriggerMatcher } from '../utils/trigger-matcher';
import { loadSkill, LoadedSkill } from '../utils/skill-loader';

const SKILL_NAME = 'azure-create-app';

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe('Should Trigger', () => {
    const shouldTriggerPrompts: string[] = [
      'How do I prepare my app for Azure deployment?',
      'Create azure.yaml for my project',
      'Set up azd for my application',
      'Generate infrastructure files for Azure',
      'Configure my app for Azure deployment',
      'Make this application Azure-ready',
      'I want to deploy to Azure, how do I start?',
      'Initialize azd for my Azure project',
      'Generate Bicep templates for my app',
      'Set up Azure Developer CLI configuration',
      'Create azure.yaml and infrastructure',
      'Prepare for Azure with azd init',
      'How do I configure my project for Azure?',
      'Generate Azure deployment configuration',
      'Set up my app to use Azure services',
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
      'Help me with AWS CloudFormation',
      'How do I set up Heroku?',
      'What is the best pizza topping?',
      'How do I use Docker Compose?',
      'Configure Google Cloud Platform project',
      'Help me with Kubernetes manifests',
      'What is machine learning?',
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
      // This snapshot helps detect unintended changes to trigger behavior
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
      const longPrompt = 'Azure deployment configuration azd init '.repeat(100);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      // Should not throw, may or may not trigger
      expect(typeof result.triggered).toBe('boolean');
    });

    test('is case insensitive for Azure terms', () => {
      const result1 = triggerMatcher.shouldTrigger('Create AZURE.YAML for my project');
      const result2 = triggerMatcher.shouldTrigger('create azure.yaml for my project');
      expect(result1.triggered).toBe(result2.triggered);
    });
  });
});
