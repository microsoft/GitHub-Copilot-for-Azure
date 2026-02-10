/**
 * Trigger Tests for microsoft-foundry:resource/create
 *
 * Tests that the parent skill triggers on resource creation prompts
 * since resource/create is a sub-skill of microsoft-foundry.
 */

import { TriggerMatcher } from '../../../utils/trigger-matcher';
import { loadSkill, LoadedSkill } from '../../../utils/skill-loader';

const SKILL_NAME = 'microsoft-foundry';

describe('microsoft-foundry:resource/create - Trigger Tests', () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe('Should Trigger - Resource Creation', () => {
    const resourceCreatePrompts: string[] = [
      'Create a new Foundry resource',
      'Create Azure AI Services resource',
      'Provision a multi-service resource',
      'Create AIServices kind resource',
      'Set up new AI Services account',
      'Create a resource group for Foundry',
      'Register Cognitive Services provider',
      'Create Azure Cognitive Services multi-service',
      'Provision AI Services with CLI',
      'Create new Azure AI Foundry resource',
      'Set up multi-service Cognitive Services resource',
    ];

    test.each(resourceCreatePrompts)(
      'triggers on resource creation prompt: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
      }
    );
  });

  describe('Should NOT Trigger', () => {
    const nonTriggerPrompts: string[] = [
      'What is the weather today?',
      'Help me write Python code',
      'How do I bake a cake?',
      'Set up a virtual machine',
      'How do I use Docker?',
      'Explain quantum computing',
    ];

    test.each(nonTriggerPrompts)(
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

    test('handles very long prompt with resource creation keywords', () => {
      const longPrompt = 'I want to create a new Azure AI Services Foundry resource '.repeat(50);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(result.triggered).toBe(true);
    });

    test('is case insensitive', () => {
      const upperResult = triggerMatcher.shouldTrigger('CREATE FOUNDRY RESOURCE');
      const lowerResult = triggerMatcher.shouldTrigger('create foundry resource');
      expect(upperResult.triggered).toBe(true);
      expect(lowerResult.triggered).toBe(true);
    });
  });
});
