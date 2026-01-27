/**
 * High Confidence Detection Tests
 * 
 * Tests for Azure configuration files that provide high-confidence
 * service recommendations (azure.yaml, host.json, Dockerfile, etc.)
 */

const { detectAppType } = require('../../src/detection/appTypeDetector');
const { AZURE_SERVICES, SKILL_ROUTES, CONFIDENCE_LEVELS } = require('../../src/detection/serviceMapping');

describe('High Confidence Detection', () => {
  describe('Azure Developer CLI (azure.yaml)', () => {
    test('detects azure.yaml and recommends azd', () => {
      const project = {
        files: ['azure.yaml', 'package.json', 'src/index.js'],
        contents: {}
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.AZD);
      expect(result.skill).toBe(SKILL_ROUTES.DEPLOY);
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.HIGH);
      expect(result.reason).toContain('azure.yaml');
    });
    
    test('azure.yaml takes priority over other indicators', () => {
      const project = {
        files: ['azure.yaml', 'Dockerfile', 'host.json', 'package.json'],
        contents: {}
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.AZD);
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.HIGH);
    });
  });

  describe('Azure Functions', () => {
    test('detects host.json and routes to azure-function-app-deployment', () => {
      const project = {
        files: ['host.json', 'package.json'],
        contents: {}
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.FUNCTIONS);
      expect(result.skill).toBe(SKILL_ROUTES.FUNCTIONS);
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.HIGH);
    });
    
    test('detects function.json and routes to azure-function-app-deployment', () => {
      const project = {
        files: ['function.json', 'index.js'],
        contents: {}
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.FUNCTIONS);
      expect(result.skill).toBe(SKILL_ROUTES.FUNCTIONS);
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.HIGH);
    });
    
    test('detects function_app.py (Python v2 model)', () => {
      const project = {
        files: ['function_app.py', 'requirements.txt'],
        contents: {}
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.FUNCTIONS);
      expect(result.skill).toBe(SKILL_ROUTES.FUNCTIONS);
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.HIGH);
    });
  });

  describe('Static Web Apps', () => {
    test('detects staticwebapp.config.json', () => {
      const project = {
        files: ['staticwebapp.config.json', 'index.html', 'package.json'],
        contents: {}
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.STATIC_WEB_APPS);
      expect(result.skill).toBe(SKILL_ROUTES.STATIC_WEB_APPS);
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.HIGH);
    });
    
    test('detects swa-cli.config.json', () => {
      const project = {
        files: ['swa-cli.config.json', 'package.json'],
        contents: {}
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.STATIC_WEB_APPS);
      expect(result.skill).toBe(SKILL_ROUTES.STATIC_WEB_APPS);
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.HIGH);
    });
  });

  describe('Container Apps', () => {
    test('detects Dockerfile and routes to azure-aca-deployment', () => {
      const project = {
        files: ['Dockerfile', 'package.json', 'src/index.js'],
        contents: {}
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.CONTAINER_APPS);
      expect(result.skill).toBe(SKILL_ROUTES.CONTAINER_APPS);
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.HIGH);
    });
    
    test('detects docker-compose.yml', () => {
      const project = {
        files: ['docker-compose.yml', 'backend/Dockerfile', 'frontend/Dockerfile'],
        contents: {}
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.CONTAINER_APPS);
      expect(result.skill).toBe(SKILL_ROUTES.CONTAINER_APPS);
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.HIGH);
    });
    
    test('detects docker-compose.yaml (alternative extension)', () => {
      const project = {
        files: ['docker-compose.yaml', 'app/Dockerfile'],
        contents: {}
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.CONTAINER_APPS);
      expect(result.skill).toBe(SKILL_ROUTES.CONTAINER_APPS);
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.HIGH);
    });
  });

  describe('Priority Order', () => {
    test('Functions takes priority over Container Apps when both present', () => {
      const project = {
        files: ['host.json', 'Dockerfile'],
        contents: {}
      };
      
      const result = detectAppType(project);
      
      // Functions indicators should be checked before Dockerfile
      expect(result.service).toBe(AZURE_SERVICES.FUNCTIONS);
    });
    
    test('SWA config takes priority over Dockerfile', () => {
      const project = {
        files: ['staticwebapp.config.json', 'Dockerfile'],
        contents: {}
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.STATIC_WEB_APPS);
    });
  });
});
