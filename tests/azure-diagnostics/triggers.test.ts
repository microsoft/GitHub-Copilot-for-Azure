/**
 * Trigger Tests for azure-diagnostics
 * 
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 * 
 * Uses snapshot testing + parameterized tests for comprehensive coverage.
 */

import { TriggerMatcher } from '../utils/trigger-matcher';
import { loadSkill, LoadedSkill } from '../utils/skill-loader';

const SKILL_NAME = 'azure-diagnostics';

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe('Should Trigger', () => {
    // Prompts that SHOULD trigger azure-diagnostics skill
    const shouldTriggerPrompts: string[] = [
      // Direct diagnostic requests
      'Debug my Azure Container App',
      'Troubleshoot production issues in my container app',
      'Diagnose errors in my Azure service',
      'Help me troubleshoot container apps on Azure',
      
      // Log analysis
      'Analyze logs with KQL for my app',
      'How do I analyze application logs?',
      'View application logs for my container',
      
      // Specific issues from frontmatter
      'Fix image pull failures in Container Apps',
      'My container app has image pull errors',
      'Resolve cold start issues',
      'Investigate health probe failures',
      'My health probes are failing',
      
      // Resource health
      'Check resource health of my container app',
      'Check the health of my Azure resources',
      
      // Root cause analysis
      'Find root cause of errors in my app',
      'My Azure Container App is not working',
      'Debug production problems',
    ];

    test.each(shouldTriggerPrompts)(
      'triggers on: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
        // Note: Confidence varies based on keyword density, not asserting specific threshold
      }
    );
  });

  describe('Should NOT Trigger', () => {
    // Prompts that should NOT trigger azure-diagnostics skill
    const shouldNotTriggerPrompts: string[] = [
      // Non-Azure topics
      'What is the weather today?',
      'Help me write a poem',
      'Explain quantum computing',
      'How do I bake a cake?',
      
      // Wrong cloud provider - without diagnostic keywords
      'Debug my AWS Lambda function',
      
      // Deployment tasks (not diagnostics)
      'Publish my app to Azure',
      'Create a new Container App',
      
      // Monitoring setup (not diagnostics)
      'Configure Application Insights',
      'Create alerts for my application',
      
      // Cost optimization (not diagnostics)
      'Reduce my Azure bill',
      'How can I save money on Azure?',
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
      const longPrompt = 'Azure Container Apps diagnostic troubleshooting '.repeat(100);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      // Should not throw, may or may not trigger
      expect(typeof result.triggered).toBe('boolean');
    });

    test('is case insensitive for diagnostic keywords', () => {
      const lowerResult = triggerMatcher.shouldTrigger('debug my azure container app');
      const upperResult = triggerMatcher.shouldTrigger('DEBUG MY AZURE CONTAINER APP');
      const mixedResult = triggerMatcher.shouldTrigger('Debug My Azure Container App');
      
      // All should have similar triggering behavior
      expect(lowerResult.triggered).toBe(upperResult.triggered);
      expect(lowerResult.triggered).toBe(mixedResult.triggered);
    });

    test('distinguishes between diagnostic and deployment keywords', () => {
      const diagnostic = triggerMatcher.shouldTrigger('troubleshoot my container app');
      const deployment = triggerMatcher.shouldTrigger('deploy my container app');
      
      // Diagnostic should trigger, deployment should not
      expect(diagnostic.triggered).toBe(true);
      expect(deployment.triggered).toBe(false);
    });
  });
});
