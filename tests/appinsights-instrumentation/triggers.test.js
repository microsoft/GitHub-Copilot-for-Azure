/**
 * Trigger Tests for appinsights-instrumentation
 * 
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 */

const { TriggerMatcher } = require('../utils/trigger-matcher');
const { loadSkill } = require('../utils/skill-loader');

const SKILL_NAME = 'appinsights-instrumentation';

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher;
  let skill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe('Should Trigger', () => {
    const shouldTriggerPrompts = [
      'How do I add Application Insights to my app?',
      'Set up telemetry for my ASP.NET Core application',
      'Add monitoring to my Node.js webapp',
      'Instrument my app with App Insights',
      'Configure Azure Monitor for my web application',
      'I want to track requests and exceptions in my app',
      'How do I send telemetry data to Azure?',
      'Enable distributed tracing in my application',
      'Add observability to my Azure hosted app',
      'Enable APM with Application Insights',
    ];

    test.each(shouldTriggerPrompts)(
      'triggers on: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
        expect(result.confidence).toBeGreaterThan(0);
      }
    );
  });

  describe('Should NOT Trigger', () => {
    const shouldNotTriggerPrompts = [
      'What is the weather today?',
      'Help me write a poem',
      'Explain quantum computing',
      'Query logs with KQL',  // use azure-observability
      'Create a dashboard in Azure Monitor',  // use azure-observability
      'Help me with AWS CloudWatch',  // wrong cloud
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
      const longPrompt = 'telemetry '.repeat(1000);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe('boolean');
    });

    test('is case insensitive', () => {
      const lower = triggerMatcher.shouldTrigger('add application insights');
      const upper = triggerMatcher.shouldTrigger('ADD APPLICATION INSIGHTS');
      expect(lower.triggered).toBe(upper.triggered);
    });
  });
});
