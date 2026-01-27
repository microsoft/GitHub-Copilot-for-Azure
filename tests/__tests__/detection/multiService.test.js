/**
 * Multi-Service Architecture Detection Tests
 * 
 * Tests for detecting monorepos and multi-service applications
 * that should use Azure Developer CLI with Infrastructure as Code.
 */

const { detectAppType } = require('../../src/detection/appTypeDetector');
const { AZURE_SERVICES, SKILL_ROUTES, CONFIDENCE_LEVELS } = require('../../src/detection/serviceMapping');

describe('Multi-Service Architecture Detection', () => {
  describe('Monorepo Detection', () => {
    test('detects frontend + backend directory structure', () => {
      const project = {
        files: [
          'frontend/package.json',
          'backend/package.json',
          'README.md'
        ],
        contents: {},
        directories: ['frontend', 'backend']
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.AZD);
      expect(result.skill).toBe(SKILL_ROUTES.DEPLOY);
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.MEDIUM);
      expect(result.reason).toContain('multi-service');
    });
    
    test('detects web + api directory structure', () => {
      const project = {
        files: [
          'web/package.json',
          'api/package.json'
        ],
        contents: {},
        directories: ['web', 'api']
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.AZD);
      expect(result.reason).toContain('multi-service');
    });
    
    test('detects packages directory (monorepo)', () => {
      const project = {
        files: [
          'packages/ui/package.json',
          'packages/api/package.json',
          'packages/shared/package.json'
        ],
        contents: {},
        directories: ['packages', 'apps']
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.AZD);
    });
    
    test('detects apps directory (Turborepo/Nx style)', () => {
      const project = {
        files: [
          'apps/web/package.json',
          'apps/api/package.json'
        ],
        contents: {},
        directories: ['apps', 'packages']
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.AZD);
    });
    
    test('detects services directory (microservices)', () => {
      const project = {
        files: [
          'services/auth/package.json',
          'services/orders/package.json',
          'services/gateway/package.json'
        ],
        contents: {},
        directories: ['services', 'shared']
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.AZD);
    });
  });

  describe('Multiple package.json Detection', () => {
    test('detects multiple package.json in subdirectories', () => {
      const project = {
        files: [
          'client/package.json',
          'server/package.json'
        ],
        contents: {},
        directories: []
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.AZD);
      expect(result.reason).toContain('multi-service');
    });
    
    test('single package.json is NOT multi-service', () => {
      const project = {
        files: ['package.json', 'src/index.js'],
        contents: {
          'package.json': { dependencies: { express: '^4.0.0' } }
        },
        directories: []
      };
      
      const result = detectAppType(project);
      
      // Should be single service, not multi-service
      expect(result.service).not.toBe(AZURE_SERVICES.AZD);
      expect(result.framework).toBe('Express');
    });
    
    test('root package.json with subdirectory package.json is multi-service', () => {
      const project = {
        files: [
          'package.json',
          'apps/web/package.json',
          'apps/api/package.json'
        ],
        contents: {},
        directories: ['apps']
      };
      
      const result = detectAppType(project);
      
      // Multiple package.json files detected
      expect(result.service).toBe(AZURE_SERVICES.AZD);
    });
  });

  describe('Priority Over Framework Detection', () => {
    test('azure.yaml takes priority over multi-service', () => {
      const project = {
        files: [
          'azure.yaml',
          'frontend/package.json',
          'backend/package.json'
        ],
        contents: {},
        directories: ['frontend', 'backend']
      };
      
      const result = detectAppType(project);
      
      // azure.yaml is high confidence and checked first
      expect(result.service).toBe(AZURE_SERVICES.AZD);
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.HIGH);
      expect(result.reason).toContain('azure.yaml');
    });
    
    test('Dockerfile takes priority over multi-service directories', () => {
      const project = {
        files: [
          'Dockerfile',
          'frontend/package.json',
          'backend/package.json'
        ],
        contents: {},
        directories: ['frontend', 'backend']
      };
      
      const result = detectAppType(project);
      
      // Dockerfile is high confidence
      expect(result.service).toBe(AZURE_SERVICES.CONTAINER_APPS);
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.HIGH);
    });
  });

  describe('Edge Cases', () => {
    test('single service directory is NOT multi-service', () => {
      const project = {
        files: ['api/package.json'],
        contents: {},
        directories: ['api']
      };
      
      const result = detectAppType(project);
      
      // Only one service directory, should not trigger multi-service
      expect(result.service).not.toBe(AZURE_SERVICES.AZD);
    });
    
    test('nested directories without recognized names', () => {
      const project = {
        files: [
          'src/package.json',
          'lib/package.json'
        ],
        contents: {},
        directories: ['src', 'lib']
      };
      
      const result = detectAppType(project);
      
      // Multiple package.json should still trigger
      expect(result.service).toBe(AZURE_SERVICES.AZD);
    });
  });
});
