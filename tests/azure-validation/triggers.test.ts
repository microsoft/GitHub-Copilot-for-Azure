/**
 * Trigger Tests for azure-validation
 */

import { TriggerMatcher } from '../utils/trigger-matcher';
import { loadSkill, LoadedSkill } from '../utils/skill-loader';

const SKILL_NAME = 'azure-validation';

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe('Should Trigger', () => {
    const shouldTriggerPrompts: string[] = [
      'Validate my Azure storage account name',
      'What are the naming constraints for Azure Key Vault?',
      'Pre-deployment validation for my Bicep template',
      'Help me validate Azure resource names before deploying',
      'What are the character limits for Azure resources?',
      'Check my Bicep file for naming errors',
      'Validate naming conventions for Azure deployment',
      'Run preflight checks before Azure deployment',
      'Azure storage naming validation rules',
      'Validate Azure Key Vault name length',
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
      'Help me with AWS S3 bucket naming',
      'Deploy my application to Heroku',
      'What is the best pizza topping?',
      'How do I use Docker?',
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
      const longPrompt = 'Azure validation storage account naming '.repeat(100);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe('boolean');
    });

    test('is case insensitive for Azure terms', () => {
      const result1 = triggerMatcher.shouldTrigger('AZURE VALIDATION');
      const result2 = triggerMatcher.shouldTrigger('azure validation');
      expect(result1.triggered).toBe(result2.triggered);
    });
  });
});
