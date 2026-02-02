/**
 * Trigger Tests for azure-keyvault-expiration-audit
 * 
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 */

import { TriggerMatcher } from '../utils/trigger-matcher';
import { loadSkill, LoadedSkill } from '../utils/skill-loader';

const SKILL_NAME = 'azure-keyvault-expiration-audit';

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe('Should Trigger', () => {
    const shouldTriggerPrompts: string[] = [
      'Show me expired certificates in my Key Vault',
      'Check what secrets are expiring in the next 30 days',
      'Audit my Key Vault for compliance',
      'Find secrets without expiration dates',
      'Generate a security report for my Key Vault expirations',
      'Which keys have expired in production Key Vault?',
      'Check certificate expiration dates in my vault',
      'List expiring secrets and keys in Azure Key Vault',
    ];

    test.each(shouldTriggerPrompts)(
      'triggers on: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
        // Trigger matcher requires >= 2 keywords or >= 20% confidence
        expect(result.matchedKeywords.length).toBeGreaterThanOrEqual(2);
      }
    );
  });

  describe('Should NOT Trigger', () => {
    // Prompts that should NOT trigger - avoid matching >= 2 keywords
    const shouldNotTriggerPrompts: string[] = [
      'What is the weather today?',
      'Help me write a poem',
      'Explain quantum computing',
      'Help me with AWS Secrets Manager',
      'Write a Python script',
      'How do I use Docker?',
      'Deploy to Kubernetes cluster',
      'Set up a database connection',
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
      const longPrompt = 'Key Vault expiration '.repeat(100);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe('boolean');
    });

    test('is case insensitive', () => {
      const result1 = triggerMatcher.shouldTrigger('EXPIRED CERTIFICATES KEY VAULT');
      const result2 = triggerMatcher.shouldTrigger('expired certificates key vault');
      expect(result1.triggered).toBe(result2.triggered);
    });
  });
});
