/**
 * Unit Tests for azure-deployment-preflight
 * 
 * Test isolated skill logic and validation rules.
 */

import { loadSkill, LoadedSkill } from '../utils/skill-loader';

const SKILL_NAME = 'azure-deployment-preflight';

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

    test('description contains deployment and validation keywords', () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).toMatch(/deployment|deploy|preflight|validation|bicep/);
    });

    test('description mentions when to activate the skill', () => {
      const description = skill.metadata.description.toLowerCase();
      const hasActivationPhrase = 
        description.includes('use this') ||
        description.includes('use when') ||
        description.includes('activate') ||
        description.includes('before');
      expect(hasActivationPhrase).toBe(true);
    });
  });

  describe('Skill Content', () => {
    test('has substantive content', () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(500);
    });

    test('contains validation process section', () => {
      expect(skill.content).toMatch(/Validation Process|Validation|Process/i);
    });

    test('documents Bicep validation', () => {
      expect(skill.content).toContain('Bicep');
      expect(skill.content).toMatch(/bicep build|bicep/i);
    });

    test('documents what-if analysis', () => {
      expect(skill.content).toContain('what-if');
    });

    test('documents preflight checks', () => {
      expect(skill.content).toMatch(/preflight|pre-flight/i);
    });

    test('references Azure CLI commands', () => {
      expect(skill.content).toMatch(/az deployment|az |Azure CLI/);
    });

    test('references Azure Developer CLI', () => {
      expect(skill.content).toMatch(/azd|Azure Developer CLI/);
    });

    test('documents project type detection', () => {
      expect(skill.content).toMatch(/azure\.yaml|project type|detect/i);
    });

    test('includes error handling guidance', () => {
      expect(skill.content).toMatch(/error|Error Handling|ERROR-HANDLING/i);
    });

    test('documents validation levels', () => {
      expect(skill.content).toMatch(/validation-level|ValidationLevel|Provider/i);
    });

    test('documents report generation', () => {
      expect(skill.content).toMatch(/report|preflight-report/i);
    });

    test('references tool requirements', () => {
      expect(skill.content).toMatch(/Tool Requirements|requirements/i);
    });
  });

  describe('Azure MCP Tools Documentation', () => {
    test('documents azure__azd tool usage', () => {
      expect(skill.content).toMatch(/azure__azd|validate_azure_yaml/);
    });

    test('provides validation command examples', () => {
      expect(skill.content).toMatch(/az deployment group what-if|azd provision --preview/);
    });
  });

  describe('Deployment Scope Coverage', () => {
    test('covers resource group scope deployments', () => {
      expect(skill.content).toMatch(/resource group|resourceGroup/i);
    });

    test('covers subscription scope deployments', () => {
      expect(skill.content).toMatch(/subscription|deployment sub/i);
    });

    test('covers management group scope deployments', () => {
      expect(skill.content).toMatch(/management group|managementGroup/i);
    });

    test('covers tenant scope deployments', () => {
      expect(skill.content).toMatch(/tenant|deployment tenant/i);
    });
  });
});
