/**
 * Unit Tests for microsoft-foundry:resource/create
 *
 * Test isolated skill logic and validation for the resource/create sub-skill.
 * Following progressive disclosure best practices from the skills development guide.
 */

import { loadSkill, LoadedSkill } from '../../../utils/skill-loader';
import * as fs from 'fs/promises';
import * as path from 'path';

const SKILL_NAME = 'microsoft-foundry';
const RESOURCE_CREATE_SUBSKILL_PATH = 'resource/create/create-foundry-resource.md';

describe('microsoft-foundry:resource/create - Unit Tests', () => {
  let skill: LoadedSkill;
  let resourceCreateContent: string;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    const resourceCreatePath = path.join(
      __dirname,
      '../../../../plugin/skills/microsoft-foundry/resource/create/create-foundry-resource.md'
    );
    resourceCreateContent = await fs.readFile(resourceCreatePath, 'utf-8');
  });

  describe('Parent Skill Integration', () => {
    test('parent skill references resource/create sub-skill', () => {
      expect(skill.content).toContain('resource/create');
      expect(skill.content).toContain('create-foundry-resource.md');
    });

    test('parent skill description includes resource creation triggers', () => {
      const description = skill.metadata.description;
      expect(description).toContain('USE FOR:');
      expect(description).toMatch(/create Foundry resource|create AI Services|multi-service resource/i);
    });

    test('resource/create is in sub-skills table', () => {
      expect(skill.content).toContain('## Sub-Skills');
      expect(skill.content).toMatch(/\*\*resource\/create\*\*/i);
    });
  });

  describe('Skill Metadata', () => {
    test('has valid frontmatter with required fields', () => {
      expect(resourceCreateContent).toMatch(/^---\n/);
      expect(resourceCreateContent).toContain('name: microsoft-foundry:resource/create');
      expect(resourceCreateContent).toContain('description:');
    });

    test('description includes USE FOR and DO NOT USE FOR', () => {
      expect(resourceCreateContent).toContain('USE FOR:');
      expect(resourceCreateContent).toContain('DO NOT USE FOR:');
    });

    test('description mentions key triggers', () => {
      expect(resourceCreateContent).toMatch(/create Foundry resource|create AI Services|multi-service resource|AIServices kind/i);
    });
  });

  describe('Skill Content - Progressive Disclosure', () => {
    test('has lean main file with references', () => {
      expect(resourceCreateContent).toBeDefined();
      expect(resourceCreateContent.length).toBeGreaterThan(500);
      // Main file should reference workflows
      expect(resourceCreateContent).toContain('references/workflows.md');
    });

    test('contains Quick Reference table', () => {
      expect(resourceCreateContent).toContain('## Quick Reference');
      expect(resourceCreateContent).toContain('Classification');
      expect(resourceCreateContent).toContain('WORKFLOW SKILL');
      expect(resourceCreateContent).toContain('Control Plane');
    });

    test('specifies correct resource type', () => {
      expect(resourceCreateContent).toContain('Microsoft.CognitiveServices/accounts');
      expect(resourceCreateContent).toContain('AIServices');
    });

    test('contains When to Use section', () => {
      expect(resourceCreateContent).toContain('## When to Use');
      expect(resourceCreateContent).toContain('Create Foundry resource');
    });

    test('contains Prerequisites section', () => {
      expect(resourceCreateContent).toContain('## Prerequisites');
      expect(resourceCreateContent).toContain('Azure subscription');
      expect(resourceCreateContent).toContain('Azure CLI');
      expect(resourceCreateContent).toContain('RBAC roles');
    });

    test('references RBAC skill for permissions', () => {
      expect(resourceCreateContent).toContain('microsoft-foundry:rbac');
    });
  });

  describe('Core Workflows', () => {
    test('contains all 4 required workflows', () => {
      expect(resourceCreateContent).toContain('## Core Workflows');
      expect(resourceCreateContent).toContain('### 1. Create Resource Group');
      expect(resourceCreateContent).toContain('### 2. Create Foundry Resource');
      expect(resourceCreateContent).toContain('### 3. Monitor Resource Usage');
      expect(resourceCreateContent).toContain('### 4. Register Resource Provider');
    });

    test('each workflow has command patterns', () => {
      expect(resourceCreateContent).toContain('Create a resource group');
      expect(resourceCreateContent).toContain('Create a new Azure AI Services resource');
      expect(resourceCreateContent).toContain('Check usage');
      expect(resourceCreateContent).toContain('Register Cognitive Services provider');
    });

    test('workflows use Azure CLI commands', () => {
      expect(resourceCreateContent).toContain('az cognitiveservices account create');
      expect(resourceCreateContent).toContain('az group create');
      expect(resourceCreateContent).toContain('az provider register');
    });

    test('workflows reference detailed documentation', () => {
      expect(resourceCreateContent).toContain('references/workflows.md#1-create-resource-group');
      expect(resourceCreateContent).toContain('references/workflows.md#2-create-foundry-resource');
    });
  });

  describe('Important Notes Section', () => {
    test('explains resource kind requirement', () => {
      expect(resourceCreateContent).toContain('### Resource Kind');
      expect(resourceCreateContent).toContain('--kind AIServices');
    });

    test('explains SKU selection', () => {
      expect(resourceCreateContent).toContain('### SKU Selection');
      expect(resourceCreateContent).toMatch(/S0|F0/);
    });

    test('mentions regional availability', () => {
      expect(resourceCreateContent).toContain('Regional Availability');
    });
  });

  describe('Quick Commands Section', () => {
    test('includes commonly used commands', () => {
      expect(resourceCreateContent).toContain('## Quick Commands');
      expect(resourceCreateContent).toContain('az account list-locations');
      expect(resourceCreateContent).toContain('az cognitiveservices account create');
    });

    test('commands include proper parameters', () => {
      expect(resourceCreateContent).toMatch(/--kind AIServices/);
      expect(resourceCreateContent).toMatch(/--resource-group/);
      expect(resourceCreateContent).toMatch(/--name/);
    });

    test('includes verification commands', () => {
      expect(resourceCreateContent).toContain('az cognitiveservices account show');
      expect(resourceCreateContent).toContain('az cognitiveservices account list');
    });
  });

  describe('Troubleshooting Section', () => {
    test('lists common errors in table format', () => {
      expect(resourceCreateContent).toContain('Common Errors');
      expect(resourceCreateContent).toContain('InsufficientPermissions');
      expect(resourceCreateContent).toContain('ResourceProviderNotRegistered');
      expect(resourceCreateContent).toContain('LocationNotAvailableForResourceType');
    });

    test('provides solutions for errors', () => {
      expect(resourceCreateContent).toMatch(/Solution|Use microsoft-foundry:rbac/);
    });
  });

  describe('External Resources', () => {
    test('links to Microsoft documentation', () => {
      expect(resourceCreateContent).toContain('## External Resources');
      expect(resourceCreateContent).toMatch(/learn\.microsoft\.com/);
    });

    test('includes relevant Azure docs', () => {
      expect(resourceCreateContent).toMatch(/multi-service resource|Azure AI Services/i);
    });
  });

  describe('Best Practices Compliance', () => {
    test('prioritizes Azure CLI for control plane operations', () => {
      expect(resourceCreateContent).toContain('Primary Method');
      expect(resourceCreateContent).toContain('Azure CLI');
      expect(resourceCreateContent).toContain('Control Plane');
    });

    test('follows skill = how, tools = what pattern', () => {
      expect(resourceCreateContent).toContain('orchestrates');
      expect(resourceCreateContent).toContain('WORKFLOW SKILL');
    });

    test('provides routing clarity', () => {
      expect(resourceCreateContent).toContain('When to Use');
      expect(resourceCreateContent).toContain('Do NOT use for');
    });

    test('uses progressive disclosure with references', () => {
      const referenceCount = (resourceCreateContent.match(/references\/workflows\.md/g) || []).length;
      expect(referenceCount).toBeGreaterThan(0);
    });
  });
});
