/**
 * Trigger Tests for azure-deployment-preflight
 * 
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 * 
 * Uses snapshot testing + parameterized tests for comprehensive coverage.
 */

import { TriggerMatcher } from '../utils/trigger-matcher';
import { loadSkill, LoadedSkill } from '../utils/skill-loader';

const SKILL_NAME = 'azure-deployment-preflight';

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe('Should Trigger', () => {
    const shouldTriggerPrompts: string[] = [
      'Validate my Bicep template before deploying to Azure',
      'Run a what-if analysis to preview changes before deploying my infrastructure',
      'Check my deployment permissions before running azd provision',
      'Preflight validation for my Azure deployment',
      'Preview what changes will be made to my Azure resources',
      'Validate my Bicep files before deployment',
      'Run preflight checks on my Azure infrastructure',
      'What will happen if I deploy this Bicep template?',
      'Check if my deployment will succeed before running it',
      'Verify my Azure deployment before executing',
      'Validate azure.yaml configuration before provisioning',
      'Run deployment validation on my Bicep templates',
      'Preview Azure resource changes before deployment',
      'Check deployment syntax and permissions',
      'Run what-if analysis on my infrastructure code',
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
      'Help me with AWS CloudFormation validation',
      'Deploy my application to Heroku',
      'What is the best pizza topping?',
      'How do I use Docker?',
      'Show me Node.js best practices',
      'Help me debug my Python code',
      'What are the latest news?',
      'Configure my PostgreSQL database',
      'Help me with Terraform on GCP',
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
      const longPrompt = 'Azure Bicep deployment validation preflight what-if '.repeat(100);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe('boolean');
    });

    test('is case insensitive for Azure and deployment terms', () => {
      const result1 = triggerMatcher.shouldTrigger('VALIDATE MY BICEP DEPLOYMENT');
      const result2 = triggerMatcher.shouldTrigger('validate my bicep deployment');
      expect(result1.triggered).toBe(result2.triggered);
    });

    test('triggers on azd-specific prompts', () => {
      const result = triggerMatcher.shouldTrigger('Validate before running azd provision');
      expect(result.triggered).toBe(true);
    });

    test('triggers on what-if specific prompts', () => {
      const result = triggerMatcher.shouldTrigger('Run what-if on my infrastructure');
      expect(result.triggered).toBe(true);
    });
  });
});
