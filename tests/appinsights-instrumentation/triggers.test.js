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
    // Parameterized tests - prompts that SHOULD trigger this skill
    const shouldTriggerPrompts = [
      'How do I instrument my webapp with AppInsights?',
      'Add telemetry to my application using Azure AppInsights',
      'Configure Azure Application Insights for my Node.js app',
      'I want to send telemetry data to Azure App Insights',
      'Help me set up instrumentation for my webapp',
      'Enable monitoring for my application with AppInsights',
      'Add Azure App Insights instrumentation to my Python application',
      'How do I auto-instrument my app in Azure App Service?',
      'Configure telemetry for my Azure hosted app',
      'Set up Application Insights instrumentation',
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
    const shouldNotTriggerPrompts = [
      'What is the weather today?',
      'Help me write a poem',
      'Explain quantum computing',
      'How do I deploy to AWS Lambda?',
      'Configure my database connection',
      'Help me debug my code',
      'What are the best practices for REST APIs?',
      'How do I write unit tests?',
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
      const longPrompt = 'Azure AppInsights '.repeat(1000);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      // Should not throw, may or may not trigger
      expect(typeof result.triggered).toBe('boolean');
    });

    test('is case insensitive for AppInsights', () => {
      const lowerCase = triggerMatcher.shouldTrigger('help me instrument my app with appinsights');
      const upperCase = triggerMatcher.shouldTrigger('help me instrument my app with APPINSIGHTS');
      const mixedCase = triggerMatcher.shouldTrigger('help me instrument my app with AppInsights');
      
      // All should have same trigger status
      expect(lowerCase.triggered).toBe(upperCase.triggered);
      expect(lowerCase.triggered).toBe(mixedCase.triggered);
    });

    test('recognizes alternative spellings', () => {
      // Test variations of Application Insights
      const appInsights = triggerMatcher.shouldTrigger('Configure App Insights for telemetry');
      const applicationInsights = triggerMatcher.shouldTrigger('Configure Application Insights for telemetry');
      
      // Both should trigger
      expect(appInsights.triggered).toBe(true);
      expect(applicationInsights.triggered).toBe(true);
    });
  });

  describe('Framework-Specific Triggers', () => {
    test('triggers on ASP.NET Core instrumentation requests', () => {
      const result = triggerMatcher.shouldTrigger('How do I instrument my ASP.NET Core app with App Insights?');
      expect(result.triggered).toBe(true);
    });

    test('triggers on Node.js instrumentation requests', () => {
      const result = triggerMatcher.shouldTrigger('Add telemetry to my Node.js application with AppInsights');
      expect(result.triggered).toBe(true);
    });

    test('triggers on Python instrumentation requests', () => {
      const result = triggerMatcher.shouldTrigger('Instrument my Python webapp with Azure AppInsights');
      expect(result.triggered).toBe(true);
    });
  });
});
