/**
 * Integration Tests
 * 
 * End-to-end scenarios combining multiple validators.
 */

const path = require('path');
const fs = require('fs');

const { validateResourceName, validateMultipleResources } = require('../src/validators/resourceNameValidator');
const { analyzeBicepFile, findBicepFiles, isAzdProject, findParameterFiles } = require('../src/validators/bicepValidator');
const { getRequiredTools, generatePreflightReport } = require('../src/validators/preflightValidator');

// Helper to get fixture path
const fixturesPath = path.join(__dirname, '..', 'fixtures');

describe('Integration Tests', () => {
  describe('Complete Validation Workflow', () => {
    test('validates azd project with all checks passing', () => {
      // Simulate azd project structure
      const projectFiles = [
        'azure.yaml',
        'infra/main.bicep',
        'infra/main.bicepparam',
        'src/api/app.py',
        'src/web/package.json'
      ];
      
      const resourceNames = {
        'mystorageacct01': 'storageAccount',
        'my-keyvault-dev': 'keyVault',
        'mycontainerapp': 'containerApp'
      };
      
      // Check project type
      expect(isAzdProject(projectFiles)).toBe(true);
      
      // Validate resource names
      const nameResults = validateMultipleResources(resourceNames);
      expect(nameResults['mystorageacct01'].valid).toBe(true);
      expect(nameResults['my-keyvault-dev'].valid).toBe(true);
      expect(nameResults['mycontainerapp'].valid).toBe(true);
      
      // Get required tools
      const tools = getRequiredTools({ isAzd: true, hasBicep: true });
      expect(tools).toContain('az');
      expect(tools).toContain('azd');
      expect(tools).toContain('bicep');
    });
    
    test('catches naming violations in multi-resource deployment', () => {
      const resourceNames = {
        'mycompanyproductionstores': 'storageAccount',  // Too long (25 chars)
        'my-container-registry': 'containerRegistry',   // Has hyphens
        'UPPERCASE-APP': 'containerApp'                 // Uppercase
      };
      
      const results = validateMultipleResources(resourceNames);
      
      expect(results['mycompanyproductionstores'].valid).toBe(false);
      expect(results['mycompanyproductionstores'].errors[0]).toContain('24 characters');
      
      expect(results['my-container-registry'].valid).toBe(false);
      expect(results['my-container-registry'].errors[0]).toContain('alphanumerics only');
      
      expect(results['UPPERCASE-APP'].valid).toBe(false);
    });
    
    test('generates complete preflight report', () => {
      // Simulate a deployment with issues
      const preflightResults = {
        tools: [
          { tool: 'az', installed: true, version: '2.76.0', meetsMinVersion: true, warning: null },
          { tool: 'azd', installed: true, version: '1.5.0', meetsMinVersion: true, warning: null },
          { tool: 'bicep', installed: false, version: null }
        ],
        auth: {
          az: { loggedIn: true },
          azd: { loggedIn: false }
        },
        resourceGroup: { name: 'my-rg', exists: false }
      };
      
      const report = generatePreflightReport(preflightResults);
      
      expect(report.status).toBe('failed');
      expect(report.summary.totalIssues).toBe(3); // bicep missing, azd not logged in, rg missing
      expect(report.issues.some(i => i.category === 'tools')).toBe(true);
      expect(report.issues.some(i => i.category === 'auth')).toBe(true);
      expect(report.issues.some(i => i.category === 'resources')).toBe(true);
    });
  });

  describe('Bicep File Analysis', () => {
    test('analyzes subscription-scoped Bicep file', () => {
      const content = fs.readFileSync(
        path.join(fixturesPath, 'bicep', 'valid-subscription.bicep'),
        'utf-8'
      );
      
      const projectFiles = ['valid-subscription.bicep'];
      const analysis = analyzeBicepFile('valid-subscription.bicep', content, projectFiles);
      
      expect(analysis.targetScope).toBe('subscription');
      expect(analysis.command).toBe('az deployment sub what-if');
      expect(analysis.requiredParams).toContain('--location');
      expect(analysis.isAzd).toBe(false);
    });
    
    test('analyzes resourceGroup-scoped Bicep file', () => {
      const content = fs.readFileSync(
        path.join(fixturesPath, 'bicep', 'valid-resourcegroup.bicep'),
        'utf-8'
      );
      
      const projectFiles = ['valid-resourcegroup.bicep'];
      const analysis = analyzeBicepFile('valid-resourcegroup.bicep', content, projectFiles);
      
      expect(analysis.targetScope).toBe('resourceGroup');
      expect(analysis.command).toBe('az deployment group what-if');
      expect(analysis.requiredParams).toContain('--resource-group');
    });
    
    test('detects parameter files in with-params fixture', () => {
      const files = [
        'with-params/main.bicep',
        'with-params/main.bicepparam'
      ];
      
      const paramFiles = findParameterFiles('with-params/main.bicep', files);
      
      expect(paramFiles.found).toBe(true);
      expect(paramFiles.bicepparam).toContain('main.bicepparam');
    });
  });

  describe('Project Type Detection', () => {
    test('detects azd project from fixture', () => {
      const azdProjectPath = path.join(fixturesPath, 'projects', 'azd-project');
      const files = fs.readdirSync(azdProjectPath);
      
      expect(isAzdProject(files)).toBe(true);
    });
    
    test('detects standalone Bicep project', () => {
      const standalonePath = path.join(fixturesPath, 'projects', 'standalone-bicep');
      const files = fs.readdirSync(standalonePath);
      
      expect(isAzdProject(files)).toBe(false);
      
      const bicepFiles = findBicepFiles(files);
      expect(bicepFiles.length).toBeGreaterThan(0);
    });
  });

  describe('Real-World Scenarios', () => {
    test('scenario: storage account name too long', () => {
      // User tries to create a storage account with name based on project
      const projectName = 'my-awesome-production-app';
      const proposedStorageName = projectName.replace(/-/g, '') + 'storage';
      
      const result = validateResourceName(proposedStorageName, 'storageAccount');
      
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('24 characters');
      
      // The name is 29 characters: myawesomeproductionappstorage
      expect(proposedStorageName.length).toBe(29);
    });
    
    test('scenario: common ACR naming mistake with hyphens', () => {
      // Users often try to use hyphens in ACR names
      const acrName = 'my-company-acr';
      
      const result = validateResourceName(acrName, 'containerRegistry');
      
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('alphanumerics only');
    });
    
    test('scenario: Key Vault name starting with number', () => {
      const kvName = '123-keyvault';
      
      const result = validateResourceName(kvName, 'keyVault');
      
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('must start with letter');
    });
    
    test('scenario: valid multi-region deployment names', () => {
      const resources = {
        'prodstoreus': 'storageAccount',
        'prodstoreu2': 'storageAccount',
        'prod-kv-eastus': 'keyVault',
        'prod-kv-westus': 'keyVault',
        'prodacreastus': 'containerRegistry'
      };
      
      const results = validateMultipleResources(resources);
      
      // All should be valid
      const allValid = Object.values(results).every(r => r.valid);
      expect(allValid).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('handles empty project file list', () => {
      expect(isAzdProject([])).toBe(false);
      expect(findBicepFiles([])).toEqual([]);
    });
    
    test('handles Bicep file with no explicit scope', () => {
      const content = `
param name string
resource app 'Microsoft.Web/sites@2023-01-01' = {
  name: name
}
`;
      const analysis = analyzeBicepFile('main.bicep', content, ['main.bicep']);
      
      // Should default to resourceGroup
      expect(analysis.targetScope).toBe('resourceGroup');
    });
  });
});
