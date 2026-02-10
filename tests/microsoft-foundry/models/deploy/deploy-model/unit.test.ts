/**
 * Unit Tests for deploy-model (router)
 * 
 * Test isolated skill logic and validation rules.
 */

import { loadSkill, LoadedSkill } from '../../../../utils/skill-loader';

const SKILL_NAME = 'microsoft-foundry/models/deploy-model';

describe(`${SKILL_NAME} - Unit Tests`, () => {
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
  });

  describe('Skill Metadata', () => {
    test('has valid SKILL.md with required fields', () => {
      expect(skill.metadata).toBeDefined();
      expect(skill.metadata.name).toBe('deploy-model');
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

    test('contains routing sections', () => {
      expect(skill.content).toContain('## Quick Reference');
      expect(skill.content).toContain('## Intent Detection');
      expect(skill.content).toContain('### Routing Rules');
    });

    test('contains sub-skill references', () => {
      expect(skill.content).toContain('preset/SKILL.md');
      expect(skill.content).toContain('customize/SKILL.md');
      expect(skill.content).toContain('capacity/SKILL.md');
    });

    test('documents all three deployment modes', () => {
      expect(skill.content).toContain('Preset');
      expect(skill.content).toContain('Customize');
      expect(skill.content).toContain('Capacity');
    });

    test('contains project selection guidance', () => {
      expect(skill.content).toContain('## Project Selection');
      expect(skill.content).toContain('PROJECT_RESOURCE_ID');
    });

    test('contains multi-mode chaining documentation', () => {
      expect(skill.content).toContain('### Multi-Mode Chaining');
    });
  });

  describe('Prerequisites', () => {
    test('lists Azure CLI requirement', () => {
      expect(skill.content).toContain('Azure CLI');
    });

    test('lists subscription requirement', () => {
      expect(skill.content).toContain('Azure subscription');
    });
  });
});
