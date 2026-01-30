/**
 * Unit Tests for appinsights-instrumentation
 * 
 * Test isolated skill logic and validation rules.
 */

const path = require('path');
const { loadSkill } = require('../utils/skill-loader');

const SKILL_NAME = 'appinsights-instrumentation';

describe(`${SKILL_NAME} - Unit Tests`, () => {
  let skill;

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
        description.includes('use') ||
        description.includes('instrument') ||
        description.includes('telemetry') ||
        description.includes('app insights');
      expect(hasTriggerPhrases).toBe(true);
    });
  });

  describe('Skill Content', () => {
    test('has substantive content', () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(100);
    });

    test('contains expected sections', () => {
      expect(skill.content).toContain('## When to use');
      expect(skill.content).toContain('## Prerequisites');
      expect(skill.content).toContain('## Guidelines');
    });

    test('covers supported platforms', () => {
      expect(skill.content).toContain('ASP.NET Core');
      expect(skill.content).toContain('Node.js');
    });
  });
});
