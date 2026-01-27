/**
 * Confidence Level Tests
 * 
 * Tests to verify that confidence levels are correctly assigned
 * based on the strength of detection signals.
 */

const { detectAppType } = require('../../src/detection/appTypeDetector');
const { CONFIDENCE_LEVELS } = require('../../src/detection/serviceMapping');

describe('Confidence Level Assignment', () => {
  describe('HIGH Confidence', () => {
    test('azure.yaml provides HIGH confidence', () => {
      const project = {
        files: ['azure.yaml'],
        contents: {}
      };
      
      const result = detectAppType(project);
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.HIGH);
    });
    
    test('host.json provides HIGH confidence', () => {
      const project = {
        files: ['host.json'],
        contents: {}
      };
      
      const result = detectAppType(project);
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.HIGH);
    });
    
    test('function.json provides HIGH confidence', () => {
      const project = {
        files: ['function.json'],
        contents: {}
      };
      
      const result = detectAppType(project);
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.HIGH);
    });
    
    test('function_app.py provides HIGH confidence', () => {
      const project = {
        files: ['function_app.py', 'requirements.txt'],
        contents: {}
      };
      
      const result = detectAppType(project);
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.HIGH);
    });
    
    test('staticwebapp.config.json provides HIGH confidence', () => {
      const project = {
        files: ['staticwebapp.config.json'],
        contents: {}
      };
      
      const result = detectAppType(project);
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.HIGH);
    });
    
    test('Dockerfile provides HIGH confidence', () => {
      const project = {
        files: ['Dockerfile'],
        contents: {}
      };
      
      const result = detectAppType(project);
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.HIGH);
    });
    
    test('.NET csproj with AzureFunctionsVersion provides HIGH confidence', () => {
      const project = {
        files: ['App.csproj'],
        contents: {
          'App.csproj': '<AzureFunctionsVersion>v4</AzureFunctionsVersion>'
        }
      };
      
      const result = detectAppType(project);
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.HIGH);
    });
  });

  describe('MEDIUM Confidence', () => {
    test('Next.js config provides MEDIUM confidence', () => {
      const project = {
        files: ['package.json', 'next.config.js'],
        contents: {
          'package.json': { dependencies: { next: '14.0.0' } },
          'next.config.js': ''
        }
      };
      
      const result = detectAppType(project);
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.MEDIUM);
    });
    
    test('Angular config provides MEDIUM confidence', () => {
      const project = {
        files: ['package.json', 'angular.json'],
        contents: {
          'package.json': { dependencies: {} }
        }
      };
      
      const result = detectAppType(project);
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.MEDIUM);
    });
    
    test('Express dependency provides MEDIUM confidence', () => {
      const project = {
        files: ['package.json'],
        contents: {
          'package.json': { dependencies: { express: '^4.0.0' } }
        }
      };
      
      const result = detectAppType(project);
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.MEDIUM);
    });
    
    test('Flask dependency provides MEDIUM confidence', () => {
      const project = {
        files: ['requirements.txt'],
        contents: {
          'requirements.txt': 'flask==3.0.0'
        }
      };
      
      const result = detectAppType(project);
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.MEDIUM);
    });
    
    test('Spring Boot provides MEDIUM confidence', () => {
      const project = {
        files: ['pom.xml'],
        contents: {
          'pom.xml': '<artifactId>spring-boot-starter-web</artifactId>'
        }
      };
      
      const result = detectAppType(project);
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.MEDIUM);
    });
    
    test('Pure static HTML provides MEDIUM confidence', () => {
      const project = {
        files: ['index.html'],
        contents: {}
      };
      
      const result = detectAppType(project);
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.MEDIUM);
    });
    
    test('Multi-service detection provides MEDIUM confidence', () => {
      const project = {
        files: ['frontend/package.json', 'backend/package.json'],
        contents: {},
        directories: ['frontend', 'backend']
      };
      
      const result = detectAppType(project);
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.MEDIUM);
    });
  });

  describe('LOW Confidence', () => {
    test('Empty project provides LOW confidence', () => {
      const project = {
        files: [],
        contents: {}
      };
      
      const result = detectAppType(project);
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.LOW);
    });
    
    test('Generic Node.js without framework provides LOW confidence', () => {
      const project = {
        files: ['package.json', 'index.js'],
        contents: {
          'package.json': { name: 'my-app' }
        }
      };
      
      const result = detectAppType(project);
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.LOW);
    });
    
    test('Generic Python without framework provides LOW confidence', () => {
      const project = {
        files: ['requirements.txt', 'main.py'],
        contents: {
          'requirements.txt': 'requests\nnumpy'
        }
      };
      
      const result = detectAppType(project);
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.LOW);
    });
    
    test('Generic .NET without framework provides LOW confidence', () => {
      const project = {
        files: ['App.csproj'],
        contents: {
          'App.csproj': '<Project Sdk="Microsoft.NET.Sdk"></Project>'
        }
      };
      
      const result = detectAppType(project);
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.LOW);
    });
    
    test('Generic Java without framework provides LOW confidence', () => {
      const project = {
        files: ['pom.xml'],
        contents: {
          'pom.xml': '<project><artifactId>my-app</artifactId></project>'
        }
      };
      
      const result = detectAppType(project);
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.LOW);
    });
    
    test('Non-code files only provides LOW confidence', () => {
      const project = {
        files: ['README.md', 'LICENSE', '.gitignore', 'docs/guide.md'],
        contents: {}
      };
      
      const result = detectAppType(project);
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.LOW);
    });
  });

  describe('Confidence Hierarchy', () => {
    test('HIGH > MEDIUM: config file overrides framework detection', () => {
      // Dockerfile (HIGH) should override Express detection (MEDIUM)
      const project = {
        files: ['Dockerfile', 'package.json'],
        contents: {
          'package.json': { dependencies: { express: '^4.0.0' } }
        }
      };
      
      const result = detectAppType(project);
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.HIGH);
    });
    
    test('MEDIUM > LOW: framework detection overrides generic language', () => {
      // Express (MEDIUM) should result in MEDIUM, not LOW
      const project = {
        files: ['package.json'],
        contents: {
          'package.json': { dependencies: { express: '^4.0.0' } }
        }
      };
      
      const result = detectAppType(project);
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.MEDIUM);
    });
  });
});
