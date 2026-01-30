/**
 * Trigger Tests for azure-deploy
 * 
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 * 
 * Uses snapshot testing + parameterized tests for comprehensive coverage.
 */

import { TriggerMatcher } from '../utils/trigger-matcher';
import { loadSkill, LoadedSkill } from '../utils/skill-loader';

const SKILL_NAME = 'azure-deploy';

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe('Should Trigger', () => {
    // Parameterized tests - prompts that SHOULD trigger this skill
    const shouldTriggerPrompts: string[] = [
      'Deploy my application to Azure using azd up',
      'Publish my web app to Azure and configure the environment',
      'How do I deploy to Azure?',
      'Deploy my app to Azure',
      'Host my application on Azure',
      'Publish to Azure',
      'Run my application on Azure',
      'How do I use azd to deploy to Azure?',
      'Execute azd up to deploy my project to Azure',
      'Deploy using Azure Developer CLI',
      'How do I publish my web app to Azure?',
      'I want to host my app on Azure',
      'Help me deploy to Azure with azd',
      'Run azd deploy for my application',
      'How do I deploy my Node.js app to Azure?',
      'Deploy my Python application to Azure',
      'Publish my .NET application to Azure',
      'Host my React app on Azure',
      'Deploy my application using azure.yaml',
      'Run deployment to Azure cloud',
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
    // Parameterized tests - prompts that should NOT trigger this skill
    const shouldNotTriggerPrompts: string[] = [
      'What is the weather today?',
      'Help me write a poem',
      'Explain quantum computing',
      'Help me with AWS Lambda',
      'Deploy to Heroku',
      'How do I use Docker?',
      'Set up GitHub Actions',
      'Configure AWS CloudFormation',
      'Deploy to Google Cloud Platform',
      'What is Kubernetes?',
      'Help me with Terraform',
      'Configure Jenkins pipeline',
      'What is the best pizza topping?',
      'How do I learn JavaScript?',
      'Create a new Azure resource',
      'Show me Azure pricing',
      'What Azure services are available?',
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
      const longPrompt = 'Deploy to Azure '.repeat(1000);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      // Should not throw, may or may not trigger
      expect(typeof result.triggered).toBe('boolean');
    });

    test('is case insensitive for Azure and deploy terms', () => {
      const result1 = triggerMatcher.shouldTrigger('DEPLOY TO AZURE');
      const result2 = triggerMatcher.shouldTrigger('deploy to azure');
      expect(result1.triggered).toBe(result2.triggered);
    });

    test('handles prompts with special characters', () => {
      const result = triggerMatcher.shouldTrigger('Deploy my app to Azure! @#$%');
      // Should not throw, may or may not trigger
      expect(typeof result.triggered).toBe('boolean');
    });

    test('handles prompts with multiple spaces', () => {
      const result = triggerMatcher.shouldTrigger('Deploy    to    Azure');
      // Should not throw, may or may not trigger
      expect(typeof result.triggered).toBe('boolean');
    });
  });

  describe('Specific Deployment Scenarios', () => {
    test('triggers on azd-specific deployment commands', () => {
      const azdPrompts = [
        'Deploy my app to Azure with azd up',
        'Execute azd deploy on Azure',
        'Use azd provision for Azure deployment',
        'How to use azd for Azure deployment?',
      ];

      azdPrompts.forEach(prompt => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
      });
    });
  });
});
