/**
 * Unit Tests for azure-create-app
 * 
 * Test isolated skill logic and validation rules.
 */

import { loadSkill, LoadedSkill } from '../utils/skill-loader';

const SKILL_NAME = 'azure-create-app';

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

    test('description mentions azd or Azure deployment', () => {
      const desc = skill.metadata.description.toLowerCase();
      expect(desc).toMatch(/azd|azure developer cli|deployment|azure-ready|infrastructure/);
    });

    test('description contains trigger phrases', () => {
      // Descriptions should contain keywords that help with skill activation
      const description = skill.metadata.description.toLowerCase();
      const hasTriggerPhrases = 
        description.includes('use this') ||
        description.includes('use when') ||
        description.includes('trigger');
      expect(hasTriggerPhrases).toBe(true);
    });
  });

  describe('Skill Content', () => {
    test('has substantive content', () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(500);
    });

    test('contains execution flow section', () => {
      expect(skill.content).toContain('Execution Flow');
    });

    test('documents azure.yaml configuration', () => {
      expect(skill.content).toContain('azure.yaml');
    });

    test('documents validation step', () => {
      expect(skill.content).toContain('Validation');
      expect(skill.content).toContain('project_validation');
    });

    test('documents discovery analysis step', () => {
      expect(skill.content).toContain('discovery_analysis');
    });

    test('documents architecture planning step', () => {
      expect(skill.content).toContain('architecture_planning');
    });

    test('documents infrastructure generation', () => {
      expect(skill.content).toContain('infrastructure_generation');
      expect(skill.content).toContain('Bicep');
    });

    test('references azure__azd MCP tool', () => {
      expect(skill.content).toContain('azure__azd');
    });

    test('includes reference guides', () => {
      expect(skill.content).toContain('Reference Guides');
    });
  });

  describe('Execution Flow Steps', () => {
    test('documents step 1: check existing state', () => {
      expect(skill.content).toContain('Step 1');
      expect(skill.content).toContain('Check Existing State');
      expect(skill.content).toContain('azd-arch-plan.md');
    });

    test('documents step 2: discovery analysis', () => {
      expect(skill.content).toContain('Step 2');
      expect(skill.content).toContain('Discovery Analysis');
    });

    test('documents step 3: architecture planning', () => {
      expect(skill.content).toContain('Step 3');
      expect(skill.content).toContain('Architecture Planning');
    });

    test('documents step 4: file generation', () => {
      expect(skill.content).toContain('Step 4');
      expect(skill.content).toContain('File Generation');
      expect(skill.content).toContain('iac_generation_rules');
      expect(skill.content).toContain('docker_generation');
      expect(skill.content).toContain('azure_yaml_generation');
    });

    test('documents step 5: validation (required)', () => {
      expect(skill.content).toContain('Step 5');
      expect(skill.content).toContain('Validation');
      expect(skill.content).toContain('REQUIRED');
    });

    test('documents step 6: complete', () => {
      expect(skill.content).toContain('Step 6');
      expect(skill.content).toContain('Complete');
    });
  });

  describe('Required Output Files', () => {
    test('documents required files', () => {
      expect(skill.content).toContain('azure.yaml');
      expect(skill.content).toContain('infra/main.bicep');
      expect(skill.content).toContain('infra/main.parameters.json');
      expect(skill.content).toContain('Dockerfile');
    });
  });
});
