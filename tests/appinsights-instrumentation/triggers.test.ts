/**
 * Trigger Tests for appinsights-instrumentation
 */

import { TriggerMatcher } from '../utils/trigger-matcher';
import { loadSkill, LoadedSkill } from '../utils/skill-loader';

const SKILL_NAME = 'appinsights-instrumentation';

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe('Should Trigger', () => {
    const shouldTriggerPrompts: string[] = [
      'How do I instrument my app with Azure App Insights?',
      'What is the App Insights SDK for Node.js?',
      'Show me Application Insights instrumentation examples',
      'How does App Insights telemetry work?',
      'What are App Insights best practices?',
      'Explain APM patterns for Application Insights',
      'App Insights SDK setup guide',
      'What telemetry does App Insights collect?',
      'Application Insights instrumentation patterns',
      'App Insights guidance for tracking requests',
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
    // Note: Prompts with "App Insights" or "telemetry" WILL trigger this skill
    // because those keywords are in the description. The skill body then
    // redirects to azure-prepare for component-adding tasks.
    const shouldNotTriggerPrompts: string[] = [
      'Deploy my application to production',
      'Create a new web API',
      'What is the weather today?',
      'Help me write a poem',
      'How do I use AWS CloudWatch?',
      'Set up Datadog for my server',
      'Query my database',
      'Fix this TypeScript error',
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
      const longPrompt = 'Azure Application Insights instrumentation telemetry '.repeat(100);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe('boolean');
    });

    test('is case insensitive for Azure and App Insights terms', () => {
      const result1 = triggerMatcher.shouldTrigger('APPLICATION INSIGHTS INSTRUMENTATION');
      const result2 = triggerMatcher.shouldTrigger('application insights instrumentation');
      expect(result1.triggered).toBe(result2.triggered);
    });
  });
});
