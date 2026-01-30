/**
 * Unit Tests for {SKILL_NAME}
 * 
 * Test isolated skill logic and validation rules.
 * Copy this file to /tests/{skill-name}/unit.test.ts
 */

import { loadSkill, LoadedSkill } from '../utils/skill-loader';

// Replace with your skill name
const SKILL_NAME = 'your-skill-name';

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
        description.includes('trigger');
      expect(hasTriggerPhrases).toBe(true);
    });
  });

  describe('Skill Content', () => {
    test('has substantive content', () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(100);
    });

    test('contains expected sections', () => {
      // Customize based on your skill's expected structure
      // Example checks:
      // expect(skill.content).toContain('## Usage');
      // expect(skill.content).toContain('## Examples');
    });
  });

  // Add skill-specific unit tests below
  // Example:
  // describe('Naming Validation', () => {
  //   test('validates storage account names', () => {
  //     expect(validateStorageName('validname123')).toBe(true);
  //     expect(validateStorageName('INVALID-NAME')).toBe(false);
  //   });
  // });
});
