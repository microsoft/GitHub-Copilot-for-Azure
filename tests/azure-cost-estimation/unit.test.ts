/**
 * Unit Tests for azure-cost-estimation
 * 
 * Tests that verify the skill file structure, metadata, and content quality.
 */

import { loadSkill, LoadedSkill } from '../utils/skill-loader';

const SKILL_NAME = 'azure-cost-estimation';

describe(`${SKILL_NAME} - Unit Tests`, () => {
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
  });

  describe('Metadata Validation', () => {
    test('has correct skill name', () => {
      expect(skill.metadata.name).toBe(SKILL_NAME);
    });

    test('has valid description', () => {
      expect(skill.metadata.description).toBeTruthy();
      expect(skill.metadata.description.length).toBeGreaterThan(50);
    });

    test('description includes USE FOR triggers', () => {
      expect(skill.metadata.description).toContain('USE FOR:');
      expect(skill.metadata.description).toMatch(/cost estimation|pricing estimate/i);
    });

    test('description includes DO NOT USE FOR anti-triggers', () => {
      expect(skill.metadata.description).toContain('DO NOT USE FOR:');
    });

    test('mentions key technologies in description', () => {
      const desc = skill.metadata.description.toLowerCase();
      expect(desc).toMatch(/bicep|arm|template/);
      expect(desc).toMatch(/cost|pricing|estimate/);
    });
  });

  describe('Content Structure', () => {
    test('has Overview/Introduction section', () => {
      expect(skill.content).toMatch(/## Overview|# Azure Cost Estimation/);
    });

    test('has Skill Activation Triggers section', () => {
      expect(skill.content).toContain('## Skill Activation Triggers');
    });

    test('includes when to use guidance', () => {
      expect(skill.content.toLowerCase()).toMatch(/use this skill|when to use/);
    });

    test('has Prerequisites section', () => {
      expect(skill.content).toMatch(/## Pattern 0: Prerequisites|Prerequisites Check/);
    });

    test('has Template Detection pattern', () => {
      expect(skill.content).toContain('## Pattern 1: Template Detection');
    });

    test('has Resource Extraction pattern', () => {
      expect(skill.content).toContain('## Pattern 2: Resource Extraction');
    });

    test('has Price Lookup pattern', () => {
      expect(skill.content).toContain('## Pattern 3: Price Lookup');
    });
  });

  describe('Technical Requirements', () => {
    test('mentions required tools (Python)', () => {
      expect(skill.content).toMatch(/Python|python/);
    });

    test('mentions Azure Retail Prices API', () => {
      expect(skill.content).toMatch(/Retail Prices API|prices\.azure\.com/);
    });

    test('includes Bicep template handling', () => {
      expect(skill.content).toMatch(/Bicep|\.bicep/);
    });

    test('includes ARM template handling', () => {
      expect(skill.content).toMatch(/ARM template|\.json/);
    });

    test('includes code examples', () => {
      expect(skill.content).toMatch(/```(?:bash|powershell|python|bicep|json)/);
    });
  });

  describe('Cost Estimation Features', () => {
    test('mentions resource types that can be estimated', () => {
      const content = skill.content;
      const hasVMs = content.includes('Virtual Machine') || content.includes('virtualMachines');
      const hasStorage = content.includes('Storage') || content.includes('storageAccounts');
      const hasDatabase = content.includes('SQL Database') || content.includes('PostgreSQL');
      
      expect(hasVMs || hasStorage || hasDatabase).toBe(true);
    });

    test('mentions pricing considerations', () => {
      expect(skill.content.toLowerCase()).toMatch(/monthly|yearly|cost|price|pricing/);
    });

    test('includes resource type mappings or examples', () => {
      expect(skill.content).toMatch(/Microsoft\.(Compute|Storage|Sql|Web|App)/);
    });

    test('mentions regions/locations for pricing', () => {
      expect(skill.content.toLowerCase()).toMatch(/region|location|eastus|westus/);
    });
  });

  describe('Output and Reporting', () => {
    test('mentions cost breakdown or report', () => {
      expect(skill.content.toLowerCase()).toMatch(/breakdown|report|estimate|calculation/);
    });

    test('includes example output or format', () => {
      const hasTable = skill.content.includes('|') && skill.content.includes('---');
      const hasExample = skill.content.toLowerCase().includes('example');
      expect(hasTable || hasExample).toBe(true);
    });
  });

  describe('Safety and Best Practices', () => {
    test('mentions that API is public (no auth required)', () => {
      const content = skill.content.toLowerCase();
      const mentionsPublic = content.includes('no authentication') || 
                            content.includes('public api') ||
                            content.includes('no auth');
      expect(mentionsPublic).toBe(true);
    });

    test('includes filter examples for API queries', () => {
      expect(skill.content).toMatch(/\$filter|filter=/);
    });

    test('warns about estimation accuracy or limitations', () => {
      const content = skill.content.toLowerCase();
      const hasWarnings = content.includes('estimate') || 
                         content.includes('approximate') ||
                         content.includes('actual costs may vary');
      expect(hasWarnings).toBe(true);
    });
  });

  describe('Documentation Quality', () => {
    test('has reasonable content length', () => {
      expect(skill.content.length).toBeGreaterThan(1000);
    });

    test('does not have excessive length', () => {
      // Soft limit - should warn if too long but not fail
      if (skill.content.length > 15000) {
        console.warn(`⚠️  Skill content is long (${skill.content.length} chars). Consider breaking into reference files.`);
      }
      expect(skill.content.length).toBeLessThan(50000);
    });

    test('uses consistent markdown formatting', () => {
      const hasHeaders = skill.content.includes('#');
      const hasCodeBlocks = skill.content.includes('```');
      expect(hasHeaders && hasCodeBlocks).toBe(true);
    });

    test('includes both Bash and PowerShell examples', () => {
      const hasBash = skill.content.includes('```bash');
      const hasPowerShell = skill.content.includes('```powershell');
      expect(hasBash && hasPowerShell).toBe(true);
    });
  });
});
