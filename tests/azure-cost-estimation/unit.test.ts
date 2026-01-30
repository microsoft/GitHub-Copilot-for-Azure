/**
 * Unit Tests for azure-cost-estimation
 * 
 * Test isolated skill logic and validation rules.
 */

import { loadSkill, LoadedSkill } from '../utils/skill-loader';

const SKILL_NAME = 'azure-cost-estimation';

describe(`${SKILL_NAME} - Unit Tests`, () => {
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
  });

  describe('Skill Metadata', () => {
    test('has valid SKILL.md with required fields', () => {
      expect(skill.metadata).toBeDefined();
      expect(skill.metadata.name).toBe(SKILL_NAME);
      expect(skill.metadata.description).toBeDefined();
      expect(skill.metadata.description.length).toBeGreaterThan(10);
    });

    test('description is concise and actionable', () => {
      // Descriptions should be 50-500 chars for readability
      expect(skill.metadata.description.length).toBeGreaterThan(50);
      expect(skill.metadata.description.length).toBeLessThan(500);
    });

    test('description contains trigger phrases', () => {
      // Descriptions should contain keywords that help with skill activation
      const description = skill.metadata.description.toLowerCase();
      const hasTriggerPhrases = 
        description.includes('use this') ||
        description.includes('use when') ||
        description.includes('helps') ||
        description.includes('activate') ||
        description.includes('trigger') ||
        description.includes('estimate') ||
        description.includes('cost');
      expect(hasTriggerPhrases).toBe(true);
    });
  });

  describe('Skill Content', () => {
    test('has substantive content', () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(100);
    });

    test('contains expected sections', () => {
      // Check for key sections in the cost estimation skill
      expect(skill.content).toContain('## Pattern');
      expect(skill.content).toContain('Azure Retail Prices API');
    });

    test('documents Bicep and ARM template support', () => {
      expect(skill.content).toContain('Bicep');
      expect(skill.content).toContain('ARM');
    });

    test('documents cost calculation methods', () => {
      const content = skill.content.toLowerCase();
      expect(content).toContain('monthly');
      expect(content).toContain('cost');
    });

    test('documents supported resource types', () => {
      const content = skill.content;
      // Check for common Azure resource types
      expect(content).toMatch(/Virtual Machines|virtualMachines/);
      expect(content).toMatch(/Storage|storageAccounts/);
    });

    test('includes pricing API information', () => {
      expect(skill.content).toContain('prices.azure.com');
    });

    test('includes usage workflow', () => {
      const content = skill.content.toLowerCase();
      const hasWorkflowOrUsage = content.includes('workflow') || content.includes('usage');
      expect(hasWorkflowOrUsage).toBe(true);
    });
  });
});
