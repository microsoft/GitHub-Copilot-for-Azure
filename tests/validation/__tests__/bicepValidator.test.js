/**
 * Bicep Validator Tests
 * 
 * Tests for Bicep file detection, scope detection, and validation.
 * Based on azure-deployment-preflight/SKILL.md.
 */

const {
  detectTargetScope,
  getCommandForScope,
  getRequiredParamsForScope,
  findParameterFiles,
  isAzdProject,
  findBicepFiles,
  parseBicepErrors,
  validateBicepContent,
  analyzeBicepFile,
  SCOPE_COMMANDS
} = require('../src/validators/bicepValidator');

describe('Bicep Validator', () => {
  describe('detectTargetScope', () => {
    test('detects resourceGroup scope', () => {
      const content = `targetScope = 'resourceGroup'\n\nparam location string`;
      expect(detectTargetScope(content)).toBe('resourceGroup');
    });
    
    test('detects subscription scope', () => {
      const content = `targetScope = 'subscription'\n\nparam location string`;
      expect(detectTargetScope(content)).toBe('subscription');
    });
    
    test('detects managementGroup scope', () => {
      const content = `targetScope = 'managementGroup'\n\nparam mgId string`;
      expect(detectTargetScope(content)).toBe('managementGroup');
    });
    
    test('detects tenant scope', () => {
      const content = `targetScope = 'tenant'\n\nparam location string`;
      expect(detectTargetScope(content)).toBe('tenant');
    });
    
    test('returns resourceGroup as default when no scope specified', () => {
      const content = `param location string\nparam name string`;
      expect(detectTargetScope(content)).toBe('resourceGroup');
    });
    
    test('handles double quotes', () => {
      const content = `targetScope = "subscription"\n\nparam location string`;
      expect(detectTargetScope(content)).toBe('subscription');
    });
    
    test('handles whitespace variations', () => {
      const content = `targetScope   =   'subscription'`;
      expect(detectTargetScope(content)).toBe('subscription');
    });
  });

  describe('getCommandForScope', () => {
    test('returns correct command for resourceGroup', () => {
      expect(getCommandForScope('resourceGroup')).toBe('az deployment group what-if');
    });
    
    test('returns correct command for subscription', () => {
      expect(getCommandForScope('subscription')).toBe('az deployment sub what-if');
    });
    
    test('returns correct command for managementGroup', () => {
      expect(getCommandForScope('managementGroup')).toBe('az deployment mg what-if');
    });
    
    test('returns correct command for tenant', () => {
      expect(getCommandForScope('tenant')).toBe('az deployment tenant what-if');
    });
    
    test('returns null for unknown scope', () => {
      expect(getCommandForScope('unknown')).toBeNull();
    });
  });

  describe('getRequiredParamsForScope', () => {
    test('resourceGroup requires --resource-group', () => {
      const params = getRequiredParamsForScope('resourceGroup');
      expect(params).toContain('--resource-group');
    });
    
    test('subscription requires --location', () => {
      const params = getRequiredParamsForScope('subscription');
      expect(params).toContain('--location');
    });
    
    test('managementGroup requires --location and --management-group-id', () => {
      const params = getRequiredParamsForScope('managementGroup');
      expect(params).toContain('--location');
      expect(params).toContain('--management-group-id');
    });
    
    test('tenant requires --location', () => {
      const params = getRequiredParamsForScope('tenant');
      expect(params).toContain('--location');
    });
    
    test('returns empty array for unknown scope', () => {
      expect(getRequiredParamsForScope('unknown')).toEqual([]);
    });
  });

  describe('findParameterFiles', () => {
    test('finds .bicepparam file', () => {
      const files = ['infra/main.bicep', 'infra/main.bicepparam'];
      const result = findParameterFiles('infra/main.bicep', files);
      
      expect(result.found).toBe(true);
      expect(result.bicepparam).toBe('infra/main.bicepparam');
    });
    
    test('finds .parameters.json file', () => {
      const files = ['main.bicep', 'main.parameters.json'];
      const result = findParameterFiles('main.bicep', files);
      
      expect(result.found).toBe(true);
      expect(result.json).toContain('main.parameters.json');
    });
    
    test('finds generic parameters.json', () => {
      const files = ['main.bicep', 'parameters.json'];
      const result = findParameterFiles('main.bicep', files);
      
      expect(result.found).toBe(true);
      expect(result.json).toContain('parameters.json');
    });
    
    test('prefers .bicepparam over .parameters.json', () => {
      const files = ['main.bicep', 'main.bicepparam', 'main.parameters.json'];
      const result = findParameterFiles('main.bicep', files);
      
      expect(result.found).toBe(true);
      expect(result.bicepparam).toContain('main.bicepparam');
      expect(result.json).toContain('main.parameters.json');
    });
    
    test('returns found: false when no parameter files', () => {
      const files = ['main.bicep', 'other.txt'];
      const result = findParameterFiles('main.bicep', files);
      
      expect(result.found).toBe(false);
      expect(result.bicepparam).toBeNull();
      expect(result.json).toBeNull();
    });
  });

  describe('isAzdProject', () => {
    test('detects azure.yaml in root', () => {
      const files = ['azure.yaml', 'package.json', 'infra/main.bicep'];
      expect(isAzdProject(files)).toBe(true);
    });
    
    test('detects azure.yaml in subdirectory', () => {
      const files = ['src/app.js', 'project/azure.yaml'];
      expect(isAzdProject(files)).toBe(true);
    });
    
    test('returns false when no azure.yaml', () => {
      const files = ['main.bicep', 'parameters.json', 'package.json'];
      expect(isAzdProject(files)).toBe(false);
    });
    
    test('returns false for empty file list', () => {
      expect(isAzdProject([])).toBe(false);
    });
  });

  describe('findBicepFiles', () => {
    test('finds all .bicep files', () => {
      const files = [
        'main.bicep',
        'modules/storage.bicep',
        'modules/network.bicep',
        'parameters.json',
        'README.md'
      ];
      
      const bicepFiles = findBicepFiles(files);
      
      expect(bicepFiles).toHaveLength(3);
      expect(bicepFiles).toContain('main.bicep');
      expect(bicepFiles).toContain('modules/storage.bicep');
      expect(bicepFiles).toContain('modules/network.bicep');
    });
    
    test('returns empty array when no bicep files', () => {
      const files = ['package.json', 'README.md'];
      expect(findBicepFiles(files)).toEqual([]);
    });
    
    test('does not match .bicepparam files', () => {
      const files = ['main.bicep', 'main.bicepparam'];
      const bicepFiles = findBicepFiles(files);
      
      expect(bicepFiles).toHaveLength(1);
      expect(bicepFiles).not.toContain('main.bicepparam');
    });
  });

  describe('parseBicepErrors', () => {
    test('parses single error', () => {
      const output = `/path/to/file.bicep(22,51) : Error BCP064: Found unexpected tokens in interpolated expression.`;
      const errors = parseBicepErrors(output);
      
      expect(errors).toHaveLength(1);
      expect(errors[0]).toEqual({
        file: '/path/to/file.bicep',
        line: 22,
        column: 51,
        severity: 'error',
        code: 'BCP064',
        message: 'Found unexpected tokens in interpolated expression.'
      });
    });
    
    test('parses warning', () => {
      const output = `main.bicep(10,5) : Warning BCP081: Resource type is deprecated.`;
      const errors = parseBicepErrors(output);
      
      expect(errors).toHaveLength(1);
      expect(errors[0].severity).toBe('warning');
      expect(errors[0].code).toBe('BCP081');
    });
    
    test('parses multiple errors', () => {
      const output = `
file.bicep(1,1) : Error BCP001: First error.
file.bicep(5,10) : Error BCP002: Second error.
file.bicep(10,1) : Warning BCP003: A warning.
`;
      const errors = parseBicepErrors(output);
      
      expect(errors).toHaveLength(3);
    });
    
    test('returns empty array for no errors', () => {
      const output = 'Build succeeded.';
      expect(parseBicepErrors(output)).toEqual([]);
    });
  });

  describe('validateBicepContent', () => {
    test('warns on hardcoded password', () => {
      const content = `
param name string
var config = {
  password = 'mysecretpassword123'
}
`;
      const result = validateBicepContent(content);
      
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].type).toBe('security');
      expect(result.warnings[0].message).toContain('hardcoded password');
    });
    
    test('warns on sensitive param without @secure()', () => {
      const content = `param dbPassword string
param location string
`;
      const result = validateBicepContent(content);
      
      // Should warn about sensitive parameter names
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.type === 'security')).toBe(true);
    });
    
    test('no warning when @secure() is present', () => {
      const content = `
@secure()
param adminPassword string
param location string
`;
      const result = validateBicepContent(content);
      
      expect(result.warnings.some(w => 
        w.message.includes('adminPassword')
      )).toBe(false);
    });
    
    test('warns on old API versions', () => {
      const content = `
resource storage 'Microsoft.Storage/storageAccounts@2019-01-01' = {
  name: 'mystorage'
}
`;
      const result = validateBicepContent(content);
      
      expect(result.warnings.some(w => 
        w.type === 'deprecation'
      )).toBe(true);
    });
    
    test('valid content passes', () => {
      const content = `
param location string
param name string

resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: name
  location: location
}
`;
      const result = validateBicepContent(content);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('analyzeBicepFile', () => {
    test('returns comprehensive analysis', () => {
      const content = `
targetScope = 'subscription'

param location string
param rgName string
`;
      const projectFiles = ['main.bicep', 'main.bicepparam', 'azure.yaml'];
      
      const result = analyzeBicepFile('main.bicep', content, projectFiles);
      
      expect(result.path).toBe('main.bicep');
      expect(result.targetScope).toBe('subscription');
      expect(result.command).toBe('az deployment sub what-if');
      expect(result.requiredParams).toContain('--location');
      expect(result.parameterFiles.found).toBe(true);
      expect(result.isAzd).toBe(true);
      expect(result.validation.valid).toBe(true);
    });
    
    test('detects non-azd project', () => {
      const content = `param location string`;
      const projectFiles = ['main.bicep'];
      
      const result = analyzeBicepFile('main.bicep', content, projectFiles);
      
      expect(result.isAzd).toBe(false);
    });
  });

  describe('SCOPE_COMMANDS constant', () => {
    test('has all four scopes', () => {
      expect(Object.keys(SCOPE_COMMANDS)).toHaveLength(4);
      expect(SCOPE_COMMANDS).toHaveProperty('resourceGroup');
      expect(SCOPE_COMMANDS).toHaveProperty('subscription');
      expect(SCOPE_COMMANDS).toHaveProperty('managementGroup');
      expect(SCOPE_COMMANDS).toHaveProperty('tenant');
    });
  });
});
