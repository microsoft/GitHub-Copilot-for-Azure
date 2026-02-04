/**
 * Unit Tests for azure-validate
 * 
 * Tests for deployment readiness validation skill.
 */

import { loadSkill, LoadedSkill } from '../utils/skill-loader';

const SKILL_NAME = 'azure-validate';

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

    test('description meets Medium-High compliance length', () => {
      expect(skill.metadata.description.length).toBeGreaterThan(150);
      expect(skill.metadata.description.length).toBeLessThanOrEqual(1024);
    });

    test('description contains USE FOR trigger phrases', () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).toContain('use for:');
    });

    test('description contains DO NOT USE FOR anti-triggers', () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).toContain('do not use for:');
    });

    test('description mentions validation or deployment readiness', () => {
      const desc = skill.metadata.description.toLowerCase();
      expect(desc).toMatch(/validate|validation|ready|deployment|preflight/);
    });
  });

  describe('Skill Content', () => {
    test('has substantive content', () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(200);
    });

    test('contains triggers section', () => {
      expect(skill.content).toMatch(/trigger/i);
    });

    test('documents the workflow steps', () => {
      expect(skill.content).toMatch(/step/i);
    });

    test('references azure-prepare prerequisite', () => {
      expect(skill.content).toMatch(/azure-prepare/i);
    });

    test('references azure-deploy as next step', () => {
      expect(skill.content).toMatch(/azure-deploy/i);
    });

    test('mentions manifest file', () => {
      expect(skill.content).toMatch(/manifest/i);
    });
  });

  describe('Workflow Integration', () => {
    test('documents recipe references', () => {
      expect(skill.content).toMatch(/recipe/i);
    });

    test('mentions validation status requirement', () => {
      expect(skill.content).toMatch(/validated/i);
    });
  });
});
