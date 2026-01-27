/**
 * Static Site Detection Tests
 * 
 * Tests for detecting pure static HTML sites.
 */

const { detectAppType } = require('../../src/detection/appTypeDetector');
const { AZURE_SERVICES, SKILL_ROUTES, CONFIDENCE_LEVELS } = require('../../src/detection/serviceMapping');

describe('Static Site Detection', () => {
  describe('Pure HTML Sites', () => {
    test('detects index.html only site', () => {
      const project = {
        files: ['index.html'],
        contents: {}
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.STATIC_WEB_APPS);
      expect(result.skill).toBe(SKILL_ROUTES.STATIC_WEB_APPS);
      expect(result.framework).toBe('Static HTML');
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.MEDIUM);
    });
    
    test('detects multi-page HTML site', () => {
      const project = {
        files: ['index.html', 'about.html', 'contact.html', 'styles.css', 'script.js'],
        contents: {}
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.STATIC_WEB_APPS);
      expect(result.framework).toBe('Static HTML');
    });
    
    test('detects HTML site with assets', () => {
      const project = {
        files: ['index.html', 'css/style.css', 'js/app.js', 'images/logo.png'],
        contents: {}
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.STATIC_WEB_APPS);
    });
  });

  describe('Non-Static Sites (should not match static detection)', () => {
    test('HTML with package.json is NOT pure static', () => {
      const project = {
        files: ['index.html', 'package.json'],
        contents: {
          'package.json': { name: 'my-app' }
        }
      };
      
      const result = detectAppType(project);
      
      // Should be detected as Node.js, not pure static HTML
      expect(result.framework).not.toBe('Static HTML');
    });
    
    test('HTML with requirements.txt is NOT pure static', () => {
      const project = {
        files: ['index.html', 'requirements.txt', 'app.py'],
        contents: {
          'requirements.txt': 'flask'
        }
      };
      
      const result = detectAppType(project);
      
      // Should be detected as Python Flask
      expect(result.framework).toBe('Flask');
    });
    
    test('HTML with csproj is NOT pure static', () => {
      const project = {
        files: ['index.html', 'WebApp.csproj'],
        contents: {
          'WebApp.csproj': '<Project Sdk="Microsoft.NET.Sdk.Web"></Project>'
        }
      };
      
      const result = detectAppType(project);
      
      // Should be detected as .NET
      expect(result.framework).not.toBe('Static HTML');
    });
    
    test('HTML with pom.xml is NOT pure static', () => {
      const project = {
        files: ['index.html', 'pom.xml'],
        contents: {
          'pom.xml': '<project></project>'
        }
      };
      
      const result = detectAppType(project);
      
      // Should be detected as Java
      expect(result.framework).not.toBe('Static HTML');
    });
  });

  describe('Edge Cases', () => {
    test('empty project returns low confidence', () => {
      const project = {
        files: [],
        contents: {}
      };
      
      const result = detectAppType(project);
      
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.LOW);
      expect(result.service).toBeNull();
    });
    
    test('project with only non-relevant files returns low confidence', () => {
      const project = {
        files: ['README.md', 'LICENSE', '.gitignore'],
        contents: {}
      };
      
      const result = detectAppType(project);
      
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.LOW);
    });
  });
});
