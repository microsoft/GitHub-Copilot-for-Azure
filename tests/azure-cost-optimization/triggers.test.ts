/**
 * Trigger Tests for azure-cost-optimization
 * 
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 */

import { TriggerMatcher } from '../utils/trigger-matcher';
import { loadSkill, LoadedSkill } from '../utils/skill-loader';

const SKILL_NAME = 'azure-cost-optimization';

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe('Should Trigger', () => {
    const shouldTriggerPrompts: string[] = [
      'Optimize Azure costs for my subscription',
      'How can I reduce my Azure spending?',
      'Generate a cost optimization report for Azure',
      'Find orphaned resources in Azure',
      'Help me rightsize my Azure VMs',
      'Analyze my Azure subscription for cost savings',
      'Identify where I\'m overspending in Azure',
      'Find unused resources in my Azure subscription',
      'Optimize Redis costs in Azure',
      'Generate cost savings recommendations for Azure',
      'Find ways to reduce my Azure bill',
      'Analyze Azure costs and suggest optimizations',
      'What are my biggest Azure cost drivers?',
      'Help me clean up unused Azure resources',
      'Rightsize my Azure containers',
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
      'How do I use AWS cost explorer?',
      'Reduce costs on Google Cloud Platform',
      'What is the best pizza topping?',
      'Deploy my application to Heroku',
      'Optimize my code performance',
      'Help me with AWS Lambda pricing',
      'Configure cost alerts in AWS',
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
      const longPrompt = 'Azure cost optimization savings '.repeat(100);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe('boolean');
    });

    test('is case insensitive for Azure cost terms', () => {
      const result1 = triggerMatcher.shouldTrigger('OPTIMIZE AZURE COSTS');
      const result2 = triggerMatcher.shouldTrigger('optimize azure costs');
      expect(result1.triggered).toBe(result2.triggered);
    });
  });
});
