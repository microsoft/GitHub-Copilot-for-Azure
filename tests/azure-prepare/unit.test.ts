/**
 * Unit Tests for azure-prepare
 * 
 * Tests for Azure application preparation skill.
 */

import { loadSkill, LoadedSkill } from '../utils/skill-loader';

const SKILL_NAME = 'azure-prepare';

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

    test('description mentions preparation or Azure hosting', () => {
      const desc = skill.metadata.description.toLowerCase();
      expect(desc).toMatch(/prepare|preparation|hosting|infrastructure|azure/);
    });
  });

  describe('Skill Content', () => {
    test('has substantive content', () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(200);
    });

    test('contains triggers section', () => {
      expect(skill.content).toMatch(/trigger/i);
    });

    test('documents the workflow steps', () => {
      expect(skill.content).toMatch(/step/i);
    });

    test('references azure-validate as next step', () => {
      expect(skill.content).toMatch(/azure-validate/i);
    });

    test('mentions manifest file', () => {
      expect(skill.content).toMatch(/manifest/i);
    });

    test('documents preparation-manifest.md location', () => {
      expect(skill.content).toMatch(/\.azure\/preparation-manifest\.md/);
    });
  });

  describe('Recipe Support', () => {
    test('documents AZD recipe', () => {
      expect(skill.content).toMatch(/azd/i);
    });

    test('documents AZCLI recipe', () => {
      expect(skill.content).toMatch(/azcli|az cli/i);
    });

    test('documents Bicep recipe', () => {
      expect(skill.content).toMatch(/bicep/i);
    });

    test('documents Terraform recipe', () => {
      expect(skill.content).toMatch(/terraform/i);
    });
  });

  describe('Workflow Steps', () => {
    test('includes analyze workspace step', () => {
      expect(skill.content).toMatch(/analyze/i);
    });

    test('includes gather requirements step', () => {
      expect(skill.content).toMatch(/requirements/i);
    });

    test('includes scan codebase step', () => {
      expect(skill.content).toMatch(/scan/i);
    });

    test('includes architecture planning step', () => {
      expect(skill.content).toMatch(/architecture/i);
    });

    test('includes generate artifacts step', () => {
      expect(skill.content).toMatch(/generate/i);
    });
  });

  describe('Output Artifacts', () => {
    test('documents azure.yaml output', () => {
      expect(skill.content).toMatch(/azure\.yaml/i);
    });

    test('documents infra folder output', () => {
      expect(skill.content).toMatch(/infra/i);
    });

    test('documents Dockerfile output', () => {
      expect(skill.content).toMatch(/dockerfile/i);
    });
  });
});
