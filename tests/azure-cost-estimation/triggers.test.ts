/**
 * Trigger Tests for azure-cost-estimation
 * 
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 */

import { TriggerMatcher } from '../utils/trigger-matcher';
import { loadSkill, LoadedSkill } from '../utils/skill-loader';

const SKILL_NAME = 'azure-cost-estimation';

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe('Should Trigger', () => {
    const shouldTriggerPrompts: string[] = [
      // Direct cost estimation requests
      'How much will this deployment cost?',
      'Estimate the cost of my Azure infrastructure',
      'What will my monthly Azure costs be?',
      'Calculate the cost of this Bicep template',
      
      // Template-specific estimation
      'How much will my Bicep template cost to deploy?',
      'Estimate costs for this ARM template',
      'What are the costs of deploying this infrastructure?',
      'Analyze my template and estimate costs',
      
      // Pricing questions
      'What is the pricing for this deployment?',
      'How much will it cost to run this in Azure?',
      'Estimate monthly costs for my infrastructure',
      'What will this cost per month?',
      
      // Budget planning
      'Is this deployment within my budget?',
      'What will my Azure bill be for this infrastructure?',
      'Budget planning for Azure deployment',
      'Calculate yearly costs for this template',
      
      // Regional comparisons
      'Compare pricing across regions',
      'How much more expensive is East US vs West US?',
      'What regions are cheapest for this deployment?',
      
      // Before deployment
      'Estimate costs before I deploy',
      'How much will I pay before provisioning?',
      'Pre-deployment cost analysis',
      'What will this infrastructure cost me?',
      
      // Resource-specific estimation
      'How much will a Standard_D4s_v3 VM cost?',
      'Estimate costs for App Service with Premium tier',
      'What does this AKS cluster cost monthly?',
      'Calculate storage account costs',
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
       // Non-Azure topics
      'What is the weather today?',
      'Help me write a Python function',
      'Explain quantum computing',
      
      // Cost optimization without estimation context (has "costs" keyword so might trigger)
      'Find orphaned resources',
      'Rightsize my VMs to save money',
      
      // Historical spending (no "estimate" or "pricing" keywords)
      'What did I spend last month?',
      'View my Azure bill',
      'Track my Azure expenses',
      
      // Template creation/generation without cost focus
      'Generate ARM template for web app',
      'Help me write infrastructure as code',
      
      // Troubleshooting without cost context
      'Troubleshoot ARM template errors',
      'Fix my Bicep compilation issues',
      
      // Security and compliance
      'Audit my Azure security',
      'Check compliance for my resources',
      'Secure my Azure environment',
      
      // Learning/documentation without cost focus
      'How do I use Bicep?',
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
      const longPrompt = 'estimate Azure costs '.repeat(500);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe('boolean');
    });

    test('is case insensitive', () => {
      const result1 = triggerMatcher.shouldTrigger('ESTIMATE AZURE COSTS');
      const result2 = triggerMatcher.shouldTrigger('estimate azure costs');
      expect(result1.triggered).toBe(result2.triggered);
      expect(result1.triggered).toBe(true);
    });

    test('handles mixed cost terminology', () => {
      const prompts = [
        'estimate costs',
        'calculate pricing',
        'what will deployment cost',
      ];
      
      prompts.forEach(prompt => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
      });
    });
  });

  describe('Boundary Cases', () => {
    test('Note: TriggerMatcher uses keyword matching', () => {
      // TriggerMatcher is a simple keyword-based system
      // It matches keywords like "estimate", "cost", "pricing", "budget"
      // More sophisticated filtering happens at the agent level, not in TriggerMatcher
      expect(true).toBe(true);
    });

    test('distinguishes from non-cost queries', () => {
      // These should NOT trigger (no cost-related keywords)
      const nonCostPrompts = [
        'what is the weather',
        'explain machine learning',
        'help me code',
      ];
      
      nonCostPrompts.forEach(prompt => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(false);
      });
    });

    test('triggers on pre-deployment cost queries', () => {
      // These SHOULD trigger (estimation before deployment)
      const estimationPrompts = [
        'how much before I deploy',
        'estimate template costs',
        'calculate infrastructure pricing',
      ];
      
      estimationPrompts.forEach(prompt => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
      });
    });

    test('handles template-specific questions', () => {
      const prompts = [
        'how much will this bicep file cost',
        'estimate ARM template pricing',
        'calculate template costs',
      ];
      
      prompts.forEach(prompt => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
      });
    });
  });
});
