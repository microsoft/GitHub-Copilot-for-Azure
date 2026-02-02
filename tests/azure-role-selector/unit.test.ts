/**
 * Unit Tests for azure-role-selector
 * 
 * Test isolated skill logic and validation rules.
 */

import { loadSkill, LoadedSkill } from '../utils/skill-loader';

const SKILL_NAME = 'azure-role-selector';

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
      expect(skill.metadata.description.length).toBeGreaterThan(50);
      expect(skill.metadata.description.length).toBeLessThan(1024);
    });

    test('description contains trigger phrases', () => {
      const description = skill.metadata.description.toLowerCase();
      const hasTriggerPhrases = 
        description.includes('use for') ||
        description.includes('use when') ||
        description.includes('helps') ||
        description.includes('activate') ||
        description.includes('trigger');
      expect(hasTriggerPhrases).toBe(true);
    });

    test('description contains anti-triggers', () => {
      const description = skill.metadata.description.toLowerCase();
      const hasAntiTriggers = 
        description.includes('do not use for') ||
        description.includes('not for') ||
        description.includes('instead use');
      expect(hasAntiTriggers).toBe(true);
    });
  });

  describe('Skill Content', () => {
    test('has substantive content', () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(100);
    });

    test('mentions azure documentation tool', () => {
      expect(skill.content.toLowerCase()).toContain('azure__documentation');
    });

    test('mentions CLI generation', () => {
      expect(skill.content.toLowerCase()).toContain('cli');
    });

    test('mentions Bicep', () => {
      expect(skill.content.toLowerCase()).toContain('bicep');
    });
  });
});
