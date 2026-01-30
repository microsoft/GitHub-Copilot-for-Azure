/**
 * Trigger Tests for azure-validate
 * 
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 */

import { TriggerMatcher } from '../utils/trigger-matcher';
import { loadSkill, LoadedSkill } from '../utils/skill-loader';

const SKILL_NAME = 'azure-validate';

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe('Should Trigger', () => {
    const shouldTriggerPrompts: string[] = [
      // Deployment readiness checks
      'Check if my app is ready to deploy to Azure',
      'Validate my azure.yaml configuration',
      'Run preflight checks before Azure deployment',
      'Test my deployment preview',
      'Troubleshoot deployment errors',
      'Verify my infrastructure configuration before deploying',
      'Is my app ready for Azure deployment?',
      'Validate my Bicep configuration',
      'Preview what changes will be made to Azure',
      // Preflight validation (formerly azure-deployment-preflight)
      'Validate my Bicep template before deploying to Azure',
      'Run a what-if analysis to preview changes before deploying my infrastructure',
      'Check my deployment permissions before running azd up',
      'Preview Azure infrastructure changes with what-if deployment',
      'Verify my Bicep files are valid before provisioning',
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
      const longPrompt = 'Azure validate deployment ready '.repeat(100);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe('boolean');
    });

    test('is case insensitive for Azure terms', () => {
      const result1 = triggerMatcher.shouldTrigger('VALIDATE AZURE DEPLOYMENT');
      const result2 = triggerMatcher.shouldTrigger('validate azure deployment');
      expect(result1.triggered).toBe(result2.triggered);
    });
  });
});
