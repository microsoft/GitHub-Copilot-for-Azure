/**
 * Azure Resource Name Validator Tests
 * 
 * Tests for validating Azure resource names against naming constraints.
 * Based on azure-validation/SKILL.md naming rules.
 */

const {
  validateResourceName,
  validateMultipleResources,
  suggestShortenedName,
  getResourceConstraints,
  listResourceTypes,
  RESOURCE_CONSTRAINTS
} = require('../src/validators/resourceNameValidator');

describe('Resource Name Validator', () => {
  describe('Storage Account', () => {
    const resourceType = 'storageAccount';
    
    describe('valid names', () => {
      test('accepts lowercase letters only', () => {
        const result = validateResourceName('mystorageaccount', resourceType);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
      
      test('accepts numbers only', () => {
        const result = validateResourceName('123456789', resourceType);
        expect(result.valid).toBe(true);
      });
      
      test('accepts mix of lowercase and numbers', () => {
        const result = validateResourceName('stor123account', resourceType);
        expect(result.valid).toBe(true);
      });
      
      test('accepts minimum length (3 chars)', () => {
        const result = validateResourceName('abc', resourceType);
        expect(result.valid).toBe(true);
      });
      
      test('accepts maximum length (24 chars)', () => {
        const result = validateResourceName('a'.repeat(24), resourceType);
        expect(result.valid).toBe(true);
      });
    });
    
    describe('invalid names - length', () => {
      test('rejects too short (2 chars)', () => {
        const result = validateResourceName('ab', resourceType);
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('at least 3 characters');
      });
      
      test('rejects too long (25 chars)', () => {
        const result = validateResourceName('a'.repeat(25), resourceType);
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('at most 24 characters');
      });
      
      test('rejects common mistake: mycompanyproductionstores (25 chars)', () => {
        const result = validateResourceName('mycompanyproductionstores', resourceType);
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('at most 24 characters');
      });
    });
    
    describe('invalid names - characters', () => {
      test('rejects uppercase letters', () => {
        const result = validateResourceName('MyStorageAccount', resourceType);
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('lowercase letters and numbers only');
      });
      
      test('rejects hyphens', () => {
        const result = validateResourceName('my-storage-account', resourceType);
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('lowercase letters and numbers only');
      });
      
      test('rejects underscores', () => {
        const result = validateResourceName('my_storage_account', resourceType);
        expect(result.valid).toBe(false);
      });
      
      test('rejects special characters', () => {
        const result = validateResourceName('storage@account!', resourceType);
        expect(result.valid).toBe(false);
      });
    });
    
    describe('warnings', () => {
      test('warns about global uniqueness for valid names', () => {
        const result = validateResourceName('mystorageaccount', resourceType);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]).toContain('globally unique');
      });
    });
  });

  describe('Key Vault', () => {
    const resourceType = 'keyVault';
    
    describe('valid names', () => {
      test('accepts alphanumerics with hyphens', () => {
        const result = validateResourceName('my-key-vault-01', resourceType);
        expect(result.valid).toBe(true);
      });
      
      test('accepts uppercase letters', () => {
        const result = validateResourceName('MyKeyVault', resourceType);
        expect(result.valid).toBe(true);
      });
      
      test('accepts minimum length (3 chars)', () => {
        const result = validateResourceName('kvt', resourceType);
        expect(result.valid).toBe(true);
      });
      
      test('accepts max length (24 chars)', () => {
        const result = validateResourceName('a'.repeat(24), resourceType);
        expect(result.valid).toBe(true);
      });
    });
    
    describe('invalid names', () => {
      test('rejects too long (25 chars)', () => {
        const result = validateResourceName('a'.repeat(25), resourceType);
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('at most 24 characters');
      });
      
      test('rejects starting with number', () => {
        const result = validateResourceName('1keyvault', resourceType);
        expect(result.valid).toBe(false);
      });
      
      test('rejects starting with hyphen', () => {
        const result = validateResourceName('-keyvault', resourceType);
        expect(result.valid).toBe(false);
      });
      
      test('rejects ending with hyphen', () => {
        const result = validateResourceName('keyvault-', resourceType);
        expect(result.valid).toBe(false);
      });
      
      test('rejects underscores', () => {
        const result = validateResourceName('my_key_vault', resourceType);
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('Container Registry', () => {
    const resourceType = 'containerRegistry';
    
    describe('valid names', () => {
      test('accepts alphanumerics', () => {
        const result = validateResourceName('mycontainerregistry01', resourceType);
        expect(result.valid).toBe(true);
      });
      
      test('accepts uppercase', () => {
        const result = validateResourceName('MyContainerRegistry', resourceType);
        expect(result.valid).toBe(true);
      });
      
      test('accepts min length (5 chars)', () => {
        const result = validateResourceName('abcde', resourceType);
        expect(result.valid).toBe(true);
      });
      
      test('accepts max length (50 chars)', () => {
        const result = validateResourceName('a'.repeat(50), resourceType);
        expect(result.valid).toBe(true);
      });
    });
    
    describe('invalid names', () => {
      test('rejects hyphens (common mistake)', () => {
        const result = validateResourceName('my-container-registry', resourceType);
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('alphanumerics only');
      });
      
      test('rejects underscores', () => {
        const result = validateResourceName('my_container_registry', resourceType);
        expect(result.valid).toBe(false);
      });
      
      test('rejects too short (4 chars)', () => {
        const result = validateResourceName('abcd', resourceType);
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('at least 5 characters');
      });
    });
  });

  describe('Container App', () => {
    const resourceType = 'containerApp';
    
    describe('valid names', () => {
      test('accepts lowercase with hyphens', () => {
        const result = validateResourceName('my-container-app', resourceType);
        expect(result.valid).toBe(true);
      });
      
      test('accepts numbers', () => {
        const result = validateResourceName('app123', resourceType);
        expect(result.valid).toBe(true);
      });
      
      test('accepts max length (32 chars)', () => {
        const result = validateResourceName('a'.repeat(32), resourceType);
        expect(result.valid).toBe(true);
      });
    });
    
    describe('invalid names', () => {
      test('rejects uppercase', () => {
        const result = validateResourceName('MyContainerApp', resourceType);
        expect(result.valid).toBe(false);
      });
      
      test('rejects starting with number', () => {
        const result = validateResourceName('1containerapp', resourceType);
        expect(result.valid).toBe(false);
      });
      
      test('rejects too long (33 chars)', () => {
        const result = validateResourceName('a'.repeat(33), resourceType);
        expect(result.valid).toBe(false);
      });
    });
    
    describe('no global uniqueness warning', () => {
      test('does not warn about global uniqueness', () => {
        const result = validateResourceName('myapp', resourceType);
        expect(result.valid).toBe(true);
        // Container Apps are not globally unique
        expect(result.warnings.some(w => w.includes('globally unique'))).toBe(false);
      });
    });
  });

  describe('App Service', () => {
    const resourceType = 'appService';
    
    describe('valid names', () => {
      test('accepts alphanumerics with hyphens', () => {
        const result = validateResourceName('my-web-app-01', resourceType);
        expect(result.valid).toBe(true);
      });
      
      test('accepts max length (60 chars)', () => {
        const result = validateResourceName('a'.repeat(60), resourceType);
        expect(result.valid).toBe(true);
      });
    });
    
    describe('invalid names', () => {
      test('rejects starting with hyphen', () => {
        const result = validateResourceName('-webapp', resourceType);
        expect(result.valid).toBe(false);
      });
      
      test('rejects ending with hyphen', () => {
        const result = validateResourceName('webapp-', resourceType);
        expect(result.valid).toBe(false);
      });
      
      test('rejects too long (61 chars)', () => {
        const result = validateResourceName('a'.repeat(61), resourceType);
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('Function App', () => {
    const resourceType = 'functionApp';
    
    test('accepts valid name', () => {
      const result = validateResourceName('my-function-app', resourceType);
      expect(result.valid).toBe(true);
    });
    
    test('has same rules as App Service', () => {
      const appServiceConstraints = getResourceConstraints('appService');
      const functionAppConstraints = getResourceConstraints('functionApp');
      
      expect(functionAppConstraints.minLength).toBe(appServiceConstraints.minLength);
      expect(functionAppConstraints.maxLength).toBe(appServiceConstraints.maxLength);
    });
  });

  describe('Resource Group', () => {
    const resourceType = 'resourceGroup';
    
    describe('valid names', () => {
      test('accepts alphanumerics', () => {
        const result = validateResourceName('myresourcegroup01', resourceType);
        expect(result.valid).toBe(true);
      });
      
      test('accepts hyphens', () => {
        const result = validateResourceName('my-resource-group', resourceType);
        expect(result.valid).toBe(true);
      });
      
      test('accepts underscores', () => {
        const result = validateResourceName('my_resource_group', resourceType);
        expect(result.valid).toBe(true);
      });
      
      test('accepts periods', () => {
        const result = validateResourceName('my.resource.group', resourceType);
        expect(result.valid).toBe(true);
      });
      
      test('accepts max length (90 chars)', () => {
        const result = validateResourceName('a'.repeat(90), resourceType);
        expect(result.valid).toBe(true);
      });
    });
    
    describe('invalid names', () => {
      test('rejects special characters', () => {
        const result = validateResourceName('my@resource#group', resourceType);
        expect(result.valid).toBe(false);
      });
      
      test('rejects too long (91 chars)', () => {
        const result = validateResourceName('a'.repeat(91), resourceType);
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('Cosmos DB', () => {
    const resourceType = 'cosmosDb';
    
    describe('valid names', () => {
      test('accepts lowercase with hyphens', () => {
        const result = validateResourceName('my-cosmos-db', resourceType);
        expect(result.valid).toBe(true);
      });
      
      test('accepts max length (44 chars)', () => {
        const result = validateResourceName('a'.repeat(44), resourceType);
        expect(result.valid).toBe(true);
      });
    });
    
    describe('invalid names', () => {
      test('rejects uppercase', () => {
        const result = validateResourceName('MyCosmosDB', resourceType);
        expect(result.valid).toBe(false);
      });
      
      test('rejects too long (45 chars)', () => {
        const result = validateResourceName('a'.repeat(45), resourceType);
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('Edge Cases', () => {
    test('returns error for null name', () => {
      const result = validateResourceName(null, 'storageAccount');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('required');
    });
    
    test('returns error for undefined name', () => {
      const result = validateResourceName(undefined, 'storageAccount');
      expect(result.valid).toBe(false);
    });
    
    test('returns error for empty string', () => {
      const result = validateResourceName('', 'storageAccount');
      expect(result.valid).toBe(false);
    });
    
    test('returns error for unknown resource type', () => {
      const result = validateResourceName('validname', 'unknownType');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Unknown resource type');
    });
  });

  describe('validateMultipleResources', () => {
    test('validates multiple resources at once', () => {
      const results = validateMultipleResources({
        'mystorageaccount': 'storageAccount',
        'my-key-vault': 'keyVault',
        'INVALID_STORAGE': 'storageAccount'
      });
      
      expect(results['mystorageaccount'].valid).toBe(true);
      expect(results['my-key-vault'].valid).toBe(true);
      expect(results['INVALID_STORAGE'].valid).toBe(false);
    });
  });

  describe('suggestShortenedName', () => {
    test('shortens production to prod', () => {
      const result = suggestShortenedName('myproductionstorage', 'storageAccount');
      expect(result).toContain('prod');
      expect(result).not.toContain('production');
    });
    
    test('removes hyphens for storage accounts', () => {
      const result = suggestShortenedName('my-storage-account', 'storageAccount');
      expect(result).not.toContain('-');
    });
    
    test('truncates to max length', () => {
      const result = suggestShortenedName('verylongstorageaccountnamethatiswaytolong', 'storageAccount');
      expect(result.length).toBeLessThanOrEqual(24);
    });
  });

  describe('getResourceConstraints', () => {
    test('returns constraints for valid type', () => {
      const constraints = getResourceConstraints('storageAccount');
      expect(constraints).not.toBeNull();
      expect(constraints.maxLength).toBe(24);
    });
    
    test('returns null for invalid type', () => {
      const constraints = getResourceConstraints('invalidType');
      expect(constraints).toBeNull();
    });
  });

  describe('listResourceTypes', () => {
    test('returns all supported resource types', () => {
      const types = listResourceTypes();
      expect(types).toContain('storageAccount');
      expect(types).toContain('keyVault');
      expect(types).toContain('containerRegistry');
      expect(types).toContain('containerApp');
      expect(types).toContain('appService');
      expect(types).toContain('functionApp');
      expect(types).toContain('resourceGroup');
      expect(types).toContain('cosmosDb');
      expect(types.length).toBe(8);
    });
  });
});
