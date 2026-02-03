/**
 * Unit Tests for azure-quick-review
 * 
 * Test isolated skill logic and validation rules.
 */

import { loadSkill, LoadedSkill } from '../utils/skill-loader';

const SKILL_NAME = 'azure-quick-review';

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

    test('description is within acceptable length', () => {
      expect(skill.metadata.description.length).toBeGreaterThan(150);
      expect(skill.metadata.description.length).toBeLessThan(1024);
    });

    test('description contains USE FOR triggers', () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).toContain('use for:');
    });

    test('description contains DO NOT USE FOR anti-triggers', () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).toContain('do not use for:');
    });
  });

  describe('Skill Content', () => {
    test('has substantive content', () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(100);
    });

    test('contains expected sections', () => {
      expect(skill.content).toContain('## When to Use This Skill');
      expect(skill.content).toContain('## Prerequisites');
      expect(skill.content).toContain('## Assessment Workflow');
    });

    test('documents azqr tool usage', () => {
      expect(skill.content).toContain('mcp_azure_mcp_extension_azqr');
    });
  });
});
