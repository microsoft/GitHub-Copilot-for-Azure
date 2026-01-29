/**
 * Unit Tests for azure-validation
 */

const path = require('path');
const { loadSkill } = require('../utils/skill-loader');

const SKILL_NAME = 'azure-validation';

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

    test('description mentions validation or pre-deployment', () => {
      const desc = skill.metadata.description.toLowerCase();
      expect(desc).toMatch(/validation|pre-deployment|naming|constraints/);
    });
  });

  describe('Skill Content', () => {
    test('has substantive content', () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(500);
    });

    test('contains naming constraints section', () => {
      expect(skill.content).toContain('Naming');
    });

    test('documents storage account limits', () => {
      expect(skill.content).toContain('Storage Account');
      expect(skill.content).toMatch(/24/); // 24 char limit
    });

    test('documents key vault limits', () => {
      expect(skill.content).toContain('Key Vault');
    });

    test('includes validation checklist', () => {
      expect(skill.content).toMatch(/checklist|Checklist/i);
    });

    test('references MCP tools', () => {
      expect(skill.content).toMatch(/azure__bicepschema|azure__deploy/);
    });
  });

  describe('Naming Rules Validation', () => {
    // Test the documented naming rules
    const namingRules = {
      storageAccount: {
        minLength: 3,
        maxLength: 24,
        pattern: /^[a-z0-9]+$/  // lowercase + numbers only
      },
      keyVault: {
        minLength: 3,
        maxLength: 24,
        pattern: /^[a-zA-Z0-9-]+$/
      },
      containerApp: {
        minLength: 2,
        maxLength: 32,
        pattern: /^[a-z0-9-]+$/
      }
    };

    test('storage account: valid names', () => {
      const validNames = ['mystorageacct', 'storage123', 'abc'];
      validNames.forEach(name => {
        expect(name.length).toBeGreaterThanOrEqual(namingRules.storageAccount.minLength);
        expect(name.length).toBeLessThanOrEqual(namingRules.storageAccount.maxLength);
        expect(name).toMatch(namingRules.storageAccount.pattern);
      });
    });

    test('storage account: invalid names', () => {
      const invalidNames = [
        'ab',                        // too short
        'thisnameiswaaaaaytoolong123456', // too long
        'my-storage-acct',           // has hyphens
        'MyStorageAcct'              // has uppercase
      ];
      invalidNames.forEach(name => {
        const tooShort = name.length < namingRules.storageAccount.minLength;
        const tooLong = name.length > namingRules.storageAccount.maxLength;
        const badPattern = !namingRules.storageAccount.pattern.test(name);
        expect(tooShort || tooLong || badPattern).toBe(true);
      });
    });

    test('key vault: valid names', () => {
      const validNames = ['my-key-vault', 'keyvault123', 'KV-Prod'];
      validNames.forEach(name => {
        expect(name.length).toBeGreaterThanOrEqual(namingRules.keyVault.minLength);
        expect(name.length).toBeLessThanOrEqual(namingRules.keyVault.maxLength);
        expect(name).toMatch(namingRules.keyVault.pattern);
      });
    });
  });
});
