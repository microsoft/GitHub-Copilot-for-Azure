/**
 * Unit Tests for microsoft-foundry
 * 
 * Test isolated skill logic and validation rules.
 */

import { loadSkill, LoadedSkill } from '../utils/skill-loader';

const SKILL_NAME = 'microsoft-foundry';

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

    test('description is appropriately sized', () => {
      // Descriptions should be 150-1024 chars for Medium-High compliance
      expect(skill.metadata.description.length).toBeGreaterThan(150);
      expect(skill.metadata.description.length).toBeLessThan(1024);
    });

    test('description contains USE FOR triggers', () => {
      const description = skill.metadata.description;
      expect(description).toMatch(/USE FOR:/i);
    });

    test('description contains DO NOT USE FOR anti-triggers', () => {
      const description = skill.metadata.description;
      expect(description).toMatch(/DO NOT USE FOR:/i);
    });
  });

  describe('Skill Content', () => {
    test('has substantive content', () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(100);
    });

    test('contains expected sections', () => {
      expect(skill.content).toContain('## Core Workflows');
      expect(skill.content).toContain('## Prerequisites');
      expect(skill.content).toContain('## Quick Reference');
    });

    test('contains MCP tool references', () => {
      expect(skill.content).toContain('foundry_');
    });
  });
});
