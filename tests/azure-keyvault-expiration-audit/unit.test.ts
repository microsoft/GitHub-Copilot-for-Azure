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

    test('includes skill activation triggers section', () => {
      expect(skill.content).toContain('Skill Activation Triggers');
    });

    test('mentions all three resource types', () => {
      expect(skill.content).toContain('keys');
      expect(skill.content).toContain('secrets');
      expect(skill.content).toContain('certificates');
    });

    test('describes audit workflow', () => {
      expect(skill.content).toContain('Core Workflow');
      expect(skill.content.toLowerCase()).toMatch(/list resources|enumerate/);
      expect(skill.content.toLowerCase()).toMatch(/analyze|status/);
    });
  });

  describe('Expiration Audit Features', () => {
    test('mentions expiration date checking', () => {
      expect(skill.content.toLowerCase()).toMatch(/expiresOn|expiration.*date/);
    });

    test('mentions resources without expiration', () => {
      const content = skill.content.toLowerCase();
      expect(content).toMatch(/no expiration|without expiration|missing expiration/);
    });

    test('includes remediation priority guidance', () => {
      expect(skill.content).toContain('Remediation Priority');
      expect(skill.content.toLowerCase()).toMatch(/critical|high|medium|low/);
    });

    test('references Key Vault specific MCP tools', () => {
      expect(skill.content).toContain('keyvault_key');
      expect(skill.content).toContain('keyvault_secret');
      expect(skill.content).toContain('keyvault_certificate');
    });

    test('includes audit patterns or workflow steps', () => {
      expect(skill.content).toContain('Pattern');
      expect(skill.content.toLowerCase()).toMatch(/scan|audit|check/);
    });
  });

  describe('Azure CLI Fallback', () => {
    test('mentions Azure CLI fallback strategy', () => {
      expect(skill.content.toLowerCase()).toMatch(/azure cli|fallback|az keyvault/);
    });

    test('includes CLI command examples', () => {
      expect(skill.content).toMatch(/`az keyvault/);
    });
  });
});
