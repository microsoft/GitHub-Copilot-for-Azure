/**
 * Trigger Tests for customize-deployment
 * 
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 */

import { TriggerMatcher } from '../../../../utils/trigger-matcher';
import { loadSkill, LoadedSkill } from '../../../../utils/skill-loader';

const SKILL_NAME = 'microsoft-foundry/models/deploy-model/customize';

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe('Should Trigger', () => {
    // Prompts that SHOULD trigger this skill
    const shouldTriggerPrompts: string[] = [
      // Core customization phrases
      'I want to customize the deployment for gpt-4o',
      'customize model deployment',
      'deploy with custom settings',
      
      // Version selection
      'Deploy gpt-4o but I want to choose the version myself',
      'let me choose the version',
      'select specific model version',
      
      // SKU selection
      'deploy with specific SKU',
      'select SKU for deployment',
      'use Standard SKU',
      'use GlobalStandard',
      'use ProvisionedManaged',
      
      // Capacity configuration
      'set capacity for deployment',
      'configure capacity',
      'deploy with 50K TPM capacity',
      'set custom capacity',
      
      // Content filter / RAI policy
      'configure content filter',
      'select RAI policy',
      'set content filtering policy',
      
      // Advanced options
      'deployment with advanced options',
      'detailed deployment configuration',
      'configure dynamic quota',
      'enable priority processing',
      'set up spillover',
      
      // PTU deployments
      'deploy with PTU',
      'PTU deployment',
      'provisioned throughput deployment',
      'deploy with provisioned capacity',
    ];

    test.each(shouldTriggerPrompts)(
      'triggers on: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
        expect(result.confidence).toBeGreaterThan(0.5);
      }
    );
  });

  describe('Should NOT Trigger', () => {
    // Prompts that should NOT trigger this skill
    const shouldNotTriggerPrompts: string[] = [
      // General unrelated
      'What is the weather today?',
      'Help me write a poem',
      'Explain quantum computing',
      
      // Wrong cloud provider
      'Deploy to AWS Lambda',
      'Configure GCP Cloud Functions',
      
      // Quick deployment scenarios (should use deploy-model-optimal-region)
      'Deploy gpt-4o quickly',
      'Deploy to optimal region',
      'find best region for deployment',
      'deploy gpt-4o fast',
      'quick deployment to best region',
      
      // Non-deployment Azure tasks
      'Create Azure resource group',
      'Set up virtual network',
      'Configure Azure Storage',
      
      // Other Azure AI tasks
      'Create AI Foundry project',
      'Deploy an agent',
      'Create knowledge index',
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
    test('case insensitive matching', () => {
      const result = triggerMatcher.shouldTrigger('CUSTOMIZE DEPLOYMENT FOR GPT-4O');
      expect(result.triggered).toBe(true);
    });

    test('partial phrase matching', () => {
      const result = triggerMatcher.shouldTrigger('I need to customize the gpt-4o deployment settings');
      expect(result.triggered).toBe(true);
    });

    test('multiple trigger phrases in one prompt', () => {
      const result = triggerMatcher.shouldTrigger('Deploy gpt-4o with custom SKU and capacity settings');
      expect(result.triggered).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.7);
    });
  });
});
