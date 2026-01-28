/**
 * Preflight Validator Tests
 * 
 * Tests for preflight validation before Azure deployments.
 * Based on azure-deployment-preflight/SKILL.md.
 */

const {
  REQUIRED_TOOLS,
  VERSION_COMMANDS,
  MIN_VERSIONS,
  parseAzAccountOutput,
  parseAzdAuthStatus,
  parseVersion,
  compareVersions,
  meetsMinVersion,
  validateTool,
  getRequiredTools,
  determineValidationFallback,
  parseResourceGroupExists,
  generatePreflightReport
} = require('../src/validators/preflightValidator');

describe('Preflight Validator', () => {
  describe('parseAzAccountOutput', () => {
    test('parses valid az account show output', () => {
      const output = JSON.stringify({
        id: 'sub-123',
        name: 'My Subscription',
        tenantId: 'tenant-456',
        user: { name: 'user@example.com' },
        isDefault: true
      });
      
      const result = parseAzAccountOutput(output);
      
      expect(result.loggedIn).toBe(true);
      expect(result.subscriptionId).toBe('sub-123');
      expect(result.subscriptionName).toBe('My Subscription');
      expect(result.tenantId).toBe('tenant-456');
      expect(result.user).toBe('user@example.com');
      expect(result.isDefault).toBe(true);
    });
    
    test('returns null for invalid JSON', () => {
      const result = parseAzAccountOutput('not json');
      expect(result).toBeNull();
    });
    
    test('handles missing user field', () => {
      const output = JSON.stringify({
        id: 'sub-123',
        name: 'My Subscription',
        tenantId: 'tenant-456'
      });
      
      const result = parseAzAccountOutput(output);
      expect(result.user).toBeNull();
    });
  });

  describe('parseAzdAuthStatus', () => {
    test('detects logged in status', () => {
      const result = parseAzdAuthStatus('Logged in to Azure');
      expect(result.loggedIn).toBe(true);
    });
    
    test('detects authenticated status', () => {
      const result = parseAzdAuthStatus('User is authenticated');
      expect(result.loggedIn).toBe(true);
    });
    
    test('detects not logged in status', () => {
      const result = parseAzdAuthStatus('Error: not logged in');
      expect(result.loggedIn).toBe(false);
    });
    
    test('includes original message', () => {
      const result = parseAzdAuthStatus('  Logged in as user@example.com  ');
      expect(result.message).toBe('Logged in as user@example.com');
    });
  });

  describe('parseVersion', () => {
    test('extracts version from az --version output', () => {
      const output = 'azure-cli                         2.76.0\ncore                              2.76.0';
      expect(parseVersion(output)).toBe('2.76.0');
    });
    
    test('extracts version from azd version output', () => {
      const output = 'azd version 1.5.0 (commit abc123)';
      expect(parseVersion(output)).toBe('1.5.0');
    });
    
    test('extracts version from bicep --version output', () => {
      const output = 'Bicep CLI version 0.24.24 (linux-x64)';
      expect(parseVersion(output)).toBe('0.24.24');
    });
    
    test('extracts version from docker --version output', () => {
      const output = 'Docker version 24.0.7, build afdd53b';
      expect(parseVersion(output)).toBe('24.0.7');
    });
    
    test('returns null for invalid output', () => {
      expect(parseVersion('no version here')).toBeNull();
    });
  });

  describe('compareVersions', () => {
    test('returns -1 when v1 < v2', () => {
      expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
      expect(compareVersions('1.0.0', '1.1.0')).toBe(-1);
      expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
    });
    
    test('returns 0 when versions are equal', () => {
      expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
      expect(compareVersions('2.76.0', '2.76.0')).toBe(0);
    });
    
    test('returns 1 when v1 > v2', () => {
      expect(compareVersions('2.0.0', '1.0.0')).toBe(1);
      expect(compareVersions('1.1.0', '1.0.0')).toBe(1);
      expect(compareVersions('1.0.1', '1.0.0')).toBe(1);
    });
    
    test('handles missing minor/patch versions', () => {
      expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    });
  });

  describe('meetsMinVersion', () => {
    test('returns true when version meets minimum', () => {
      expect(meetsMinVersion('2.76.0', '2.76.0')).toBe(true);
      expect(meetsMinVersion('2.77.0', '2.76.0')).toBe(true);
      expect(meetsMinVersion('3.0.0', '2.76.0')).toBe(true);
    });
    
    test('returns false when version is below minimum', () => {
      expect(meetsMinVersion('2.75.0', '2.76.0')).toBe(false);
      expect(meetsMinVersion('2.14.0', '2.76.0')).toBe(false);
      expect(meetsMinVersion('1.0.0', '2.76.0')).toBe(false);
    });
  });

  describe('validateTool', () => {
    test('validates installed tool meeting minimum version', () => {
      const result = validateTool('az', 'azure-cli 2.76.0');
      
      expect(result.installed).toBe(true);
      expect(result.version).toBe('2.76.0');
      expect(result.meetsMinVersion).toBe(true);
      expect(result.warning).toBeNull();
    });
    
    test('warns when below minimum version', () => {
      const result = validateTool('az', 'azure-cli 2.14.0');
      
      expect(result.installed).toBe(true);
      expect(result.version).toBe('2.14.0');
      expect(result.meetsMinVersion).toBe(false);
      expect(result.warning).toContain('below recommended');
    });
    
    test('handles unparseable version', () => {
      const result = validateTool('az', 'command not found');
      
      expect(result.installed).toBe(false);
      expect(result.version).toBeNull();
      expect(result.error).toBe('Could not parse version');
    });
  });

  describe('getRequiredTools', () => {
    test('always includes az', () => {
      const tools = getRequiredTools({});
      expect(tools).toContain('az');
    });
    
    test('includes azd for azd projects', () => {
      const tools = getRequiredTools({ isAzd: true });
      expect(tools).toContain('az');
      expect(tools).toContain('azd');
    });
    
    test('includes bicep for Bicep files', () => {
      const tools = getRequiredTools({ hasBicep: true });
      expect(tools).toContain('az');
      expect(tools).toContain('bicep');
    });
    
    test('includes docker for Dockerfiles', () => {
      const tools = getRequiredTools({ hasDocker: true });
      expect(tools).toContain('az');
      expect(tools).toContain('docker');
    });
    
    test('includes all tools when all options set', () => {
      const tools = getRequiredTools({ isAzd: true, hasBicep: true, hasDocker: true });
      expect(tools).toContain('az');
      expect(tools).toContain('azd');
      expect(tools).toContain('bicep');
      expect(tools).toContain('docker');
    });
  });

  describe('determineValidationFallback', () => {
    test('recommends ProviderNoRbac for authorization errors', () => {
      const result = determineValidationFallback('Authorization failed: insufficient permissions');
      
      expect(result.shouldFallback).toBe(true);
      expect(result.fallbackLevel).toBe('ProviderNoRbac');
    });
    
    test('recommends ProviderNoRbac for RBAC errors', () => {
      const result = determineValidationFallback('RBAC check failed');
      expect(result.shouldFallback).toBe(true);
    });
    
    test('recommends ProviderNoRbac for forbidden errors', () => {
      const result = determineValidationFallback('Error: Forbidden (403)');
      expect(result.shouldFallback).toBe(true);
    });
    
    test('recommends register for provider not registered', () => {
      const result = determineValidationFallback('Resource provider not registered');
      
      expect(result.shouldFallback).toBe(false);
      expect(result.action).toBe('register');
    });
    
    test('recommends fix for template errors', () => {
      const result = determineValidationFallback('Template validation failed: invalid syntax');
      
      expect(result.shouldFallback).toBe(false);
      expect(result.action).toBe('fix');
    });
    
    test('returns no fallback for unknown errors', () => {
      const result = determineValidationFallback('Some random error');
      expect(result.shouldFallback).toBe(false);
    });
  });

  describe('parseResourceGroupExists', () => {
    test('returns true for "true" output', () => {
      expect(parseResourceGroupExists('true')).toBe(true);
      expect(parseResourceGroupExists('  true  ')).toBe(true);
      expect(parseResourceGroupExists('True')).toBe(true);
      expect(parseResourceGroupExists('TRUE')).toBe(true);
    });
    
    test('returns false for "false" output', () => {
      expect(parseResourceGroupExists('false')).toBe(false);
      expect(parseResourceGroupExists('  false  ')).toBe(false);
    });
    
    test('returns false for unexpected output', () => {
      expect(parseResourceGroupExists('error')).toBe(false);
      expect(parseResourceGroupExists('')).toBe(false);
    });
  });

  describe('generatePreflightReport', () => {
    test('generates passing report when all checks pass', () => {
      const results = {
        tools: [
          { tool: 'az', installed: true, version: '2.76.0', meetsMinVersion: true, warning: null }
        ],
        auth: {
          az: { loggedIn: true }
        }
      };
      
      const report = generatePreflightReport(results);
      
      expect(report.status).toBe('passed');
      expect(report.summary.totalIssues).toBe(0);
    });
    
    test('generates failing report for missing tool', () => {
      const results = {
        tools: [
          { tool: 'az', installed: false, version: null }
        ],
        auth: {}
      };
      
      const report = generatePreflightReport(results);
      
      expect(report.status).toBe('failed');
      expect(report.issues).toHaveLength(1);
      expect(report.issues[0].category).toBe('tools');
      expect(report.issues[0].remediation).toContain('Install');
    });
    
    test('generates failing report for auth issues', () => {
      const results = {
        tools: [],
        auth: {
          az: { loggedIn: false }
        }
      };
      
      const report = generatePreflightReport(results);
      
      expect(report.status).toBe('failed');
      expect(report.issues).toHaveLength(1);
      expect(report.issues[0].category).toBe('auth');
      expect(report.issues[0].remediation).toContain('az login');
    });
    
    test('generates failing report for missing resource group', () => {
      const results = {
        tools: [],
        auth: {},
        resourceGroup: { name: 'my-rg', exists: false }
      };
      
      const report = generatePreflightReport(results);
      
      expect(report.status).toBe('failed');
      expect(report.issues).toHaveLength(1);
      expect(report.issues[0].category).toBe('resources');
      expect(report.issues[0].remediation).toContain('az group create');
    });
    
    test('includes warnings for outdated tools', () => {
      const results = {
        tools: [
          { tool: 'az', installed: true, version: '2.14.0', meetsMinVersion: false, minVersion: '2.76.0', warning: 'Version 2.14.0 is below recommended 2.76.0' }
        ],
        auth: {}
      };
      
      const report = generatePreflightReport(results);
      
      expect(report.status).toBe('passed'); // Warnings don't fail
      expect(report.warnings).toHaveLength(1);
      expect(report.warnings[0].category).toBe('tools');
    });
    
    test('includes timestamp', () => {
      const report = generatePreflightReport({});
      expect(report.timestamp).toBeDefined();
      expect(new Date(report.timestamp)).toBeInstanceOf(Date);
    });
    
    test('includes bicep errors in report', () => {
      const results = {
        tools: [],
        auth: {},
        bicep: {
          errors: [
            { file: 'main.bicep', line: 10, column: 5, severity: 'error', message: 'Syntax error' }
          ]
        }
      };
      
      const report = generatePreflightReport(results);
      
      expect(report.status).toBe('failed');
      expect(report.issues).toHaveLength(1);
      expect(report.issues[0].category).toBe('bicep');
    });
  });

  describe('Constants', () => {
    test('REQUIRED_TOOLS has expected tool sets', () => {
      expect(REQUIRED_TOOLS.base).toEqual(['az']);
      expect(REQUIRED_TOOLS.azd).toContain('azd');
      expect(REQUIRED_TOOLS.bicep).toContain('bicep');
      expect(REQUIRED_TOOLS.container).toContain('docker');
    });
    
    test('VERSION_COMMANDS has commands for all tools', () => {
      expect(VERSION_COMMANDS).toHaveProperty('az');
      expect(VERSION_COMMANDS).toHaveProperty('azd');
      expect(VERSION_COMMANDS).toHaveProperty('bicep');
      expect(VERSION_COMMANDS).toHaveProperty('docker');
    });
    
    test('MIN_VERSIONS has versions for all tools', () => {
      expect(MIN_VERSIONS.az).toBe('2.76.0');
      expect(MIN_VERSIONS.azd).toBe('1.0.0');
      expect(MIN_VERSIONS.bicep).toBe('0.4.0');
      expect(MIN_VERSIONS.docker).toBe('20.0.0');
    });
  });
});
