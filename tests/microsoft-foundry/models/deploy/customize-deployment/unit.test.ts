/**
 * Unit Tests for customize (customize-deployment)
 * 
 * Test isolated skill logic and validation rules.
 */

import { loadSkill, LoadedSkill } from '../../../../utils/skill-loader';

const SKILL_NAME = 'microsoft-foundry/models/deploy-model/customize';

describe(`customize (customize-deployment) - Unit Tests`, () => {
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
  });

  describe('Skill Metadata', () => {
    test('has valid SKILL.md with required fields', () => {
      expect(skill.metadata).toBeDefined();
      expect(skill.metadata.name).toBe('customize');
      expect(skill.metadata.description).toBeDefined();
      expect(skill.metadata.description.length).toBeGreaterThan(10);
    });

    test('description is appropriately sized', () => {
      expect(skill.metadata.description.length).toBeGreaterThan(150);
      expect(skill.metadata.description.length).toBeLessThan(1024);
    });

    test('description contains USE FOR triggers', () => {
      expect(skill.metadata.description).toMatch(/USE FOR:/i);
    });

    test('description contains DO NOT USE FOR anti-triggers', () => {
      expect(skill.metadata.description).toMatch(/DO NOT USE FOR:/i);
    });
  });

  describe('Skill Content', () => {
    test('has substantive content', () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(100);
    });

    test('contains expected sections', () => {
      expect(skill.content).toContain('## Quick Reference');
      expect(skill.content).toContain('## Prerequisites');
    });

    test('documents customization options', () => {
      expect(skill.content).toContain('SKU');
      expect(skill.content).toContain('capacity');
      expect(skill.content).toContain('RAI');
    });

    test('documents PTU deployment support', () => {
      expect(skill.content).toContain('PTU');
      expect(skill.content).toContain('ProvisionedManaged');
    });

    test('contains comparison with preset mode', () => {
      expect(skill.content).toContain('## When to Use');
    });
  });
});
