/**
 * Unit Tests for appinsights-instrumentation
 */

import { loadSkill, LoadedSkill } from '../utils/skill-loader';

const SKILL_NAME = 'appinsights-instrumentation';

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

    test('description mentions instrumentation or telemetry', () => {
      const desc = skill.metadata.description.toLowerCase();
      expect(desc).toMatch(/instrument|telemetry|app insights|observability/);
    });
  });

  describe('Skill Content', () => {
    test('has substantive content', () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(500);
    });

    test('contains when to use section', () => {
      expect(skill.content).toMatch(/## When to use/i);
    });

    test('documents prerequisites', () => {
      expect(skill.content).toMatch(/## Prerequisites/i);
      expect(skill.content).toContain('ASP.NET Core');
      expect(skill.content).toContain('Node.js');
    });

    test('documents guidelines section', () => {
      expect(skill.content).toMatch(/## Guidelines/i);
    });

    test('mentions auto-instrumentation', () => {
      expect(skill.content).toContain('auto-instrument');
      expect(skill.content).toContain('AUTO guide');
    });

    test('references manual instrumentation guides', () => {
      expect(skill.content).toContain('ASPNETCORE guide');
      expect(skill.content).toContain('NODEJS guide');
      expect(skill.content).toContain('PYTHON guide');
    });

    test('mentions creating AppInsights resource', () => {
      expect(skill.content).toContain('AppInsights resource');
      expect(skill.content).toMatch(/Bicep|Azure CLI/);
    });

    test('references example files', () => {
      expect(skill.content).toContain('examples/appinsights.bicep');
      expect(skill.content).toContain('scripts/appinsights.ps1');
    });
  });

  describe('Supported Technologies', () => {
    test('lists ASP.NET Core as supported', () => {
      expect(skill.content).toContain('ASP.NET Core');
    });

    test('lists Node.js as supported', () => {
      expect(skill.content).toContain('Node.js');
    });

    test('lists Python as supported', () => {
      expect(skill.content).toContain('Python');
    });
  });
});
