/**
 * Unit Tests for azure-keyvault-expiration-audit
 * 
 * Test isolated skill logic and validation rules.
 */

import { loadSkill, LoadedSkill } from '../utils/skill-loader';

const SKILL_NAME = 'azure-keyvault-expiration-audit';

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
      expect(skill.metadata.description.length).toBeLessThan(1025);
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

    test('description contains anti-trigger phrases', () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).toContain('do not use for');
    });
  });

  describe('Skill Content', () => {
    test('has substantive content', () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(100);
    });

    test('contains Key Vault specific sections', () => {
      expect(skill.content).toContain('Key Vault');
      expect(skill.content.toLowerCase()).toContain('expir');
    });

    test('contains MCP tools reference', () => {
      expect(skill.content).toContain('keyvault_');
    });
  });
});
