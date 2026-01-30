/**
 * Unit Tests for appinsights-instrumentation
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

    test('description mentions instrumentation or telemetry', () => {
      const desc = skill.metadata.description.toLowerCase();
      expect(desc).toMatch(/instrument|telemetry|app insights|appinsights/);
    });
  });

  describe('Skill Content', () => {
    test('has substantive content', () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(500);
    });

    test('contains usage guidelines section', () => {
      expect(skill.content).toMatch(/When to use|Guidelines/i);
    });

    test('documents supported frameworks', () => {
      // Should mention ASP.NET Core, Node.js, or Python
      const content = skill.content;
      const hasAspNetCore = content.includes('ASP.NET Core');
      const hasNodeJs = content.includes('Node.js');
      const hasPython = content.includes('Python');
      expect(hasAspNetCore || hasNodeJs || hasPython).toBe(true);
    });

    test('references auto-instrumentation', () => {
      expect(skill.content).toMatch(/auto-instrument|AUTO/);
    });

    test('documents manual instrumentation', () => {
      expect(skill.content).toMatch(/Manually instrument|manual/i);
    });

    test('references example files', () => {
      // Should reference examples or scripts
      expect(skill.content).toMatch(/examples|scripts/i);
    });

    test('references guides that explain configuration', () => {
      // The skill should reference the guides that explain connection string configuration
      const content = skill.content;
      expect(content).toMatch(/references\/ASPNETCORE|references\/NODEJS|references\/PYTHON/);
    });
  });

  describe('Framework-Specific Guidance', () => {
    test('provides ASP.NET Core guidance', () => {
      expect(skill.content).toContain('ASPNETCORE');
    });

    test('provides Node.js guidance', () => {
      expect(skill.content).toContain('NODEJS');
    });

    test('provides Python guidance', () => {
      expect(skill.content).toContain('PYTHON');
    });
  });

  describe('Reference Files', () => {
    test('mentions reference documentation', () => {
      expect(skill.content).toMatch(/references\//);
    });

    test('references AUTO guide for App Service', () => {
      expect(skill.content).toContain('AUTO.md');
    });

    test('references framework-specific guides', () => {
      const hasAspNetCoreRef = skill.content.includes('ASPNETCORE.md');
      const hasNodeJsRef = skill.content.includes('NODEJS.md');
      const hasPythonRef = skill.content.includes('PYTHON.md');
      expect(hasAspNetCoreRef && hasNodeJsRef && hasPythonRef).toBe(true);
    });
  });

  describe('Deployment Options', () => {
    test('documents Bicep deployment option', () => {
      expect(skill.content).toMatch(/Bicep/i);
    });

    test('documents Azure CLI deployment option', () => {
      expect(skill.content).toMatch(/Azure CLI/i);
    });

    test('references example Bicep file', () => {
      expect(skill.content).toContain('appinsights.bicep');
    });

    test('references example PowerShell script', () => {
      expect(skill.content).toContain('appinsights.ps1');
    });
  });
});
