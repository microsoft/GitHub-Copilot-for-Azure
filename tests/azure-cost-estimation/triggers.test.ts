/**
 * Trigger Tests for azure-cost-estimation
 * 
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 */

import { TriggerMatcher } from '../utils/trigger-matcher';
import { loadSkill, LoadedSkill } from '../utils/skill-loader';

const SKILL_NAME = 'azure-cost-estimation';

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
      'How much will this deployment cost?',
      'Estimate the cost of this Bicep template',
      "What's the monthly cost of this infrastructure?",
      'Compare pricing across regions',
      'Show me the cost breakdown for my Azure resources',
      'Analyze costs before I deploy',
      "What will my Azure bill be for this?",
      'Is this deployment within my budget?',
      'Estimate Azure costs for my infrastructure',
      'Calculate Azure infrastructure costs from my ARM template',
      'What are the pricing estimates for this template?',
      'How much will it cost to run this in Azure?',
      'Show me cost comparison between regions for this template',
      'Estimate monthly Azure spending for my Bicep file',
      'What are the costs for deploying this infrastructure?',
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
      'How do I use AWS Lambda?',
      'Deploy my application to Heroku',
      'What is the best pizza topping?',
      'Configure logging in Spring Boot',
      'Help me with Google Cloud Platform pricing',
      'How do I debug my Node.js application?',
      'Explain Docker containers',
      'Create a React component',
      'Set up CI/CD pipeline',
      'Write unit tests for my function',
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
      const longPrompt = 'Azure cost estimation '.repeat(1000);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      // Should not throw, may or may not trigger
      expect(typeof result.triggered).toBe('boolean');
    });

    test('is case insensitive for cost-related terms', () => {
      const lowerResult = triggerMatcher.shouldTrigger('how much will this cost?');
      const upperResult = triggerMatcher.shouldTrigger('HOW MUCH WILL THIS COST?');
      const mixedResult = triggerMatcher.shouldTrigger('How Much Will This Cost?');
      
      // All should have same trigger state
      expect(lowerResult.triggered).toBe(upperResult.triggered);
      expect(lowerResult.triggered).toBe(mixedResult.triggered);
    });
  });
});
