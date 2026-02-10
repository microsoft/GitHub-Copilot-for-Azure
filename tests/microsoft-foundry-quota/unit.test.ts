/**
 * Unit Tests for microsoft-foundry-quota
 *
 * Test isolated skill logic and validation for the quota sub-skill.
 * Following progressive disclosure best practices from the skills development guide.
 */

import { loadSkill, LoadedSkill } from '../utils/skill-loader';
import * as fs from 'fs/promises';
import * as path from 'path';

const SKILL_NAME = 'microsoft-foundry';
const QUOTA_SUBSKILL_PATH = 'quota/quota.md';

describe('microsoft-foundry-quota - Unit Tests', () => {
  let skill: LoadedSkill;
  let quotaContent: string;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    const quotaPath = path.join(
      __dirname,
      '../../plugin/skills/microsoft-foundry/quota/quota.md'
    );
    quotaContent = await fs.readFile(quotaPath, 'utf-8');
  });

  describe('Parent Skill Integration', () => {
    test('parent skill references quota sub-skill', () => {
      expect(skill.content).toContain('quota');
      expect(skill.content).toContain('quota/quota.md');
    });

    test('parent skill description follows best practices', () => {
      const description = skill.metadata.description;

      // Should have USE FOR section
      expect(description).toContain('USE FOR:');
      expect(description).toMatch(/quota|capacity|tpm/i);

      // Should have DO NOT USE FOR section
      expect(description).toContain('DO NOT USE FOR:');
    });

    test('parent skill has DO NOT USE FOR routing guidance', () => {
      const description = skill.metadata.description;
      expect(description).toContain('DO NOT USE FOR:');
    });

    test('quota is in sub-skills table', () => {
      expect(skill.content).toContain('## Sub-Skills');
      expect(skill.content).toMatch(/\*\*quota\*\*/i);
    });
  });

  describe('Quota Skill Content - Progressive Disclosure', () => {
    test('has quota orchestration file (lean, focused)', () => {
      expect(quotaContent).toBeDefined();
      expect(quotaContent.length).toBeGreaterThan(500);
      // Should be under 5000 tokens (within guidelines)
    });

    test('follows orchestration pattern (how not what)', () => {
      expect(quotaContent).toContain('orchestrates quota');
      expect(quotaContent).toContain('MCP Tools');
    });

    test('contains Quick Reference table', () => {
      expect(quotaContent).toContain('## Quick Reference');
      expect(quotaContent).toContain('Operation Type');
      expect(quotaContent).toContain('Primary Method');
      expect(quotaContent).toContain('Microsoft.CognitiveServices/accounts');
    });

    test('contains When to Use section', () => {
      expect(quotaContent).toContain('## When to Use');
      expect(quotaContent).toContain('View quota usage');
      expect(quotaContent).toContain('Plan deployments');
      expect(quotaContent).toContain('Request increases');
      expect(quotaContent).toContain('Troubleshoot failures');
    });

    test('explains quota types concisely', () => {
      expect(quotaContent).toContain('## Understanding Quotas');
      expect(quotaContent).toContain('Deployment Quota (TPM)');
      expect(quotaContent).toContain('Region Quota');
      expect(quotaContent).toContain('Deployment Slots');
    });

    test('includes MCP Tools table', () => {
      expect(quotaContent).toContain('## MCP Tools');
      expect(quotaContent).toContain('foundry_models_deployments_list');
      expect(quotaContent).toContain('foundry_resource_get');
    });
  });

  describe('Core Workflows - Orchestration Focus', () => {
    test('contains all 7 required workflows', () => {
      expect(quotaContent).toContain('## Core Workflows');
      expect(quotaContent).toContain('### 1. View Current Quota Usage');
      expect(quotaContent).toContain('### 2. Find Best Region for Model Deployment');
      expect(quotaContent).toContain('### 3. Check Quota Before Deployment');
      expect(quotaContent).toContain('### 4. Request Quota Increase');
      expect(quotaContent).toContain('### 5. Monitor Quota Across Deployments');
      expect(quotaContent).toContain('### 6. Deploy with Provisioned Throughput Units (PTU)');
      expect(quotaContent).toContain('### 7. Troubleshoot Quota Errors');
    });

    test('each workflow has command patterns', () => {
      expect(quotaContent).toContain('Show my Microsoft Foundry quota usage');
      expect(quotaContent).toContain('Do I have enough quota');
      expect(quotaContent).toContain('Request quota increase');
      expect(quotaContent).toContain('Show all my Foundry deployments');
      expect(quotaContent).toContain('Fix QuotaExceeded error');
    });

    test('workflows use Azure CLI as primary method', () => {
      expect(quotaContent).toContain('az rest');
      expect(quotaContent).toContain('az cognitiveservices');
    });

    test('workflows provide MCP tool alternatives', () => {
      expect(quotaContent).toContain('Alternative');
      expect(quotaContent).toContain('foundry_models_deployments_list');
    });

    test('workflows have concise steps and examples', () => {
      // Should have numbered steps
      expect(quotaContent).toMatch(/1\./);
      expect(quotaContent).toMatch(/2\./);

      // All content should be inline, no placeholder references
      expect(quotaContent).not.toContain('references/workflows.md');
      expect(quotaContent).not.toContain('references/best-practices.md');
    });
  });

  describe('Error Handling', () => {
    test('lists common errors in table format', () => {
      expect(quotaContent).toContain('Common Errors');
      expect(quotaContent).toContain('QuotaExceeded');
      expect(quotaContent).toContain('InsufficientQuota');
      expect(quotaContent).toContain('DeploymentLimitReached');
      expect(quotaContent).toContain('429 Rate Limit');
    });

    test('provides resolution steps', () => {
      expect(quotaContent).toContain('Resolution Steps');
      expect(quotaContent).toMatch(/option a|option b|option c|option d/i);
    });

    test('contains error troubleshooting inline without references', () => {
      // Removed placeholder reference to non-existent troubleshooting.md
      expect(quotaContent).not.toContain('references/troubleshooting.md');
      expect(quotaContent).toContain('### 7. Troubleshoot Quota Errors');
    });
  });

  describe('PTU Capacity Planning', () => {
    test('provides official capacity calculator methods only', () => {
      // Removed unofficial formulas and non-existent CLI command, only official methods remain
      expect(quotaContent).toContain('PTU Capacity Planning');
      expect(quotaContent).toContain('Method 1: Microsoft Foundry Portal');
      expect(quotaContent).toContain('Method 2: Using Azure REST API');
      // Method 3 removed because az cognitiveservices account calculate-model-capacity doesn't exist
    });

    test('includes agent instruction to not use unofficial formulas', () => {
      expect(quotaContent).toContain('Agent Instruction');
      expect(quotaContent).toMatch(/Do NOT generate.*estimated PTU formulas/s);
    });

    test('removed unofficial capacity planning section', () => {
      // We removed "Capacity Planning" section with unofficial formulas
      expect(quotaContent).not.toContain('Formula for TPM Requirements');
      expect(quotaContent).not.toContain('references/best-practices.md');
    });
  });

  describe('Quick Commands Section', () => {
    test('includes commonly used commands', () => {
      expect(quotaContent).toContain('## Quick Commands');
    });

    test('commands include proper parameters', () => {
      expect(quotaContent).toMatch(/--resource-group\s+<[^>]+>/);
      expect(quotaContent).toMatch(/--name\s+<[^>]+>/);
    });

    test('uses Azure CLI native query and output formatting', () => {
      expect(quotaContent).toContain('--query');
      expect(quotaContent).toContain('--output table');
    });
  });

  describe('Progressive Disclosure - References', () => {
    test('removed placeholder references to non-existent files', () => {
      // We intentionally removed references to files that don't exist
      expect(quotaContent).not.toContain('references/workflows.md');
      expect(quotaContent).not.toContain('references/troubleshooting.md');
      expect(quotaContent).not.toContain('references/best-practices.md');
    });

    test('contains all essential guidance inline', () => {
      // All content is now inline in the main quota.md file
      expect(quotaContent).toContain('## Core Workflows');
      expect(quotaContent).toContain('## External Resources');
      expect(quotaContent).toContain('learn.microsoft.com');
    });
  });

  describe('External Resources', () => {
    test('links to Microsoft documentation', () => {
      expect(quotaContent).toContain('## External Resources');
      expect(quotaContent).toMatch(/learn\.microsoft\.com/);
    });

    test('includes relevant Azure docs', () => {
      expect(quotaContent).toMatch(/quota|provisioned.*throughput|rate.*limits/i);
    });
  });

  describe('Formatting and Structure', () => {
    test('uses proper markdown headers hierarchy', () => {
      expect(quotaContent).toMatch(/^## /m);
      expect(quotaContent).toMatch(/^### /m);
    });

    test('uses tables for structured information', () => {
      expect(quotaContent).toMatch(/\|.*\|.*\|/);
    });

    test('uses code blocks for commands', () => {
      expect(quotaContent).toContain('```bash');
      expect(quotaContent).toContain('```');
    });

    test('uses blockquotes for important notes', () => {
      expect(quotaContent).toMatch(/^>/m);
    });
  });

  describe('Best Practices Compliance', () => {
    test('prioritizes Azure CLI for control plane operations', () => {
      // For control plane operations, Azure CLI should be primary method
      expect(quotaContent).toContain('Primary Method');
      expect(quotaContent).toContain('Azure CLI');
      expect(quotaContent).toContain('Optional MCP Tools');
    });

    test('follows skill = how, tools = what pattern', () => {
      expect(quotaContent).toContain('orchestrates');
      expect(quotaContent).toContain('MCP Tools');
    });

    test('provides routing clarity', () => {
      // Should explain when to use this sub-skill vs direct MCP calls
      expect(quotaContent).toContain('When to Use');
    });

    test('contains all content inline without placeholder references', () => {
      // Removed placeholder references to non-existent files
      // All essential content is now inline
      const referenceCount = (quotaContent.match(/references\//g) || []).length;
      expect(referenceCount).toBe(0);
    });
  });
});
