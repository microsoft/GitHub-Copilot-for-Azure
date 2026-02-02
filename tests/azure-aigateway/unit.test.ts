/**
 * Unit Tests for azure-aigateway
 * 
 * Test isolated skill logic and validation rules.
 */

import { loadSkill, LoadedSkill } from '../utils/skill-loader';

const SKILL_NAME = 'azure-aigateway';

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

    test('description meets minimum length requirement', () => {
      // Descriptions should be > 150 chars for Medium adherence
      expect(skill.metadata.description.length).toBeGreaterThan(150);
    });

    test('description contains USE FOR trigger phrases', () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).toContain('use for');
    });

    test('description contains DO NOT USE FOR anti-triggers', () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).toContain('do not use for');
    });
  });

  describe('Skill Content', () => {
    test('has substantive content', () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(100);
    });

    test('contains expected sections', () => {
      expect(skill.content).toContain('## Overview');
      expect(skill.content).toContain('## Key Resources');
    });

    test('contains AI Gateway patterns', () => {
      expect(skill.content).toContain('Semantic Caching');
      expect(skill.content).toContain('Token Rate Limiting');
      expect(skill.content).toContain('Content Safety');
      expect(skill.content).toContain('Load Balancing');
    });

    test('contains MCP server guidance', () => {
      expect(skill.content).toContain('MCP');
      expect(skill.content).toContain('Convert API to MCP');
    });

    test('references Basicv2 SKU as default', () => {
      expect(skill.content).toContain('Basicv2');
      expect(skill.content).toContain('Default to');
    });
  });

  describe('Configuration Rules', () => {
    test('recommends Basicv2 SKU', () => {
      expect(skill.content).toContain("Default to `Basicv2` SKU");
    });

    test('includes Bicep templates', () => {
      expect(skill.content).toContain('```bicep');
    });

    test('includes policy XML examples', () => {
      expect(skill.content).toContain('<policies>');
      expect(skill.content).toContain('</policies>');
    });
  });
});
