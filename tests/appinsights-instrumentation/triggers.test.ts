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
      'Instrument my webapp to send telemetry to App Insights',
      'How do I instrument my app with Azure App Insights?',
      'Add AppInsights instrumentation to my web application',
      'Add App Insights instrumentation to my Node.js app',
      'Configure Application Insights for my Python webapp',
      'Set up telemetry monitoring in Azure',
      'Instrument my application to send data to App Insights',
      'Add observability to my Azure web application',
      'How to enable App Insights auto-instrumentation?',
      'Configure telemetry for my Azure App Service',
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
      'How do I use AWS CloudWatch?',
      'Deploy my application to Heroku',
      'What is the best pizza topping?',
      'Configure logging in Spring Boot',
      'Set up Datadog monitoring',
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
