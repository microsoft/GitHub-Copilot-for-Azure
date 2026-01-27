/**
 * Python Framework Detection Tests
 * 
 * Tests for detecting Python frameworks and routing to appropriate Azure services.
 */

const { detectAppType } = require('../../src/detection/appTypeDetector');
const { AZURE_SERVICES, SKILL_ROUTES, CONFIDENCE_LEVELS } = require('../../src/detection/serviceMapping');

describe('Python Framework Detection', () => {
  describe('Azure Functions', () => {
    test('detects function_app.py (v2 model) with high confidence', () => {
      const project = {
        files: ['function_app.py', 'requirements.txt', 'host.json'],
        contents: {
          'requirements.txt': 'azure-functions\nrequests'
        }
      };
      
      const result = detectAppType(project);
      
      // function_app.py should trigger high confidence detection
      expect(result.service).toBe(AZURE_SERVICES.FUNCTIONS);
      expect(result.skill).toBe(SKILL_ROUTES.FUNCTIONS);
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.HIGH);
    });
    
    test('detects azure-functions dependency in requirements.txt', () => {
      const project = {
        files: ['requirements.txt', 'main.py'],
        contents: {
          'requirements.txt': 'azure-functions==1.18.0\nrequests>=2.28.0'
        }
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.FUNCTIONS);
      expect(result.skill).toBe(SKILL_ROUTES.FUNCTIONS);
      expect(result.framework).toBe('Azure Functions (Python)');
    });
    
    test('detects azure-functions in pyproject.toml', () => {
      const project = {
        files: ['pyproject.toml', 'function_app.py'],
        contents: {
          'pyproject.toml': `
[project]
name = "my-functions"
dependencies = [
    "azure-functions",
]
`
        }
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.FUNCTIONS);
    });
  });

  describe('Flask', () => {
    test('detects Flask and recommends App Service', () => {
      const project = {
        files: ['requirements.txt', 'app.py'],
        contents: {
          'requirements.txt': 'flask==3.0.0\ngunicorn'
        }
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.APP_SERVICE);
      expect(result.skill).toBe(SKILL_ROUTES.APP_SERVICE);
      expect(result.framework).toBe('Flask');
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.MEDIUM);
    });
    
    test('detects Flask with version specifier', () => {
      const project = {
        files: ['requirements.txt', 'app.py'],
        contents: {
          'requirements.txt': 'Flask>=2.0.0,<4.0.0\nWerkzeug'
        }
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.APP_SERVICE);
      expect(result.framework).toBe('Flask');
    });
  });

  describe('Django', () => {
    test('detects Django and recommends App Service', () => {
      const project = {
        files: ['requirements.txt', 'manage.py', 'mysite/settings.py'],
        contents: {
          'requirements.txt': 'django==5.0.0\npsycopg2-binary'
        }
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.APP_SERVICE);
      expect(result.skill).toBe(SKILL_ROUTES.APP_SERVICE);
      expect(result.framework).toBe('Django');
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.MEDIUM);
    });
    
    test('detects Django in pyproject.toml', () => {
      const project = {
        files: ['pyproject.toml', 'manage.py'],
        contents: {
          'pyproject.toml': `
[project]
name = "my-django-app"
dependencies = [
    "django>=4.2",
    "gunicorn",
]
`
        }
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.APP_SERVICE);
      expect(result.framework).toBe('Django');
    });
  });

  describe('FastAPI', () => {
    test('detects FastAPI and recommends App Service', () => {
      const project = {
        files: ['requirements.txt', 'main.py'],
        contents: {
          'requirements.txt': 'fastapi==0.109.0\nuvicorn[standard]'
        }
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.APP_SERVICE);
      expect(result.skill).toBe(SKILL_ROUTES.APP_SERVICE);
      expect(result.framework).toBe('FastAPI');
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.MEDIUM);
    });
    
    test('detects FastAPI with tilde version specifier', () => {
      const project = {
        files: ['requirements.txt', 'app/main.py'],
        contents: {
          'requirements.txt': 'fastapi~=0.100.0\npydantic'
        }
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.APP_SERVICE);
      expect(result.framework).toBe('FastAPI');
    });
  });

  describe('Generic Python', () => {
    test('detects generic Python with requirements.txt and low confidence', () => {
      const project = {
        files: ['requirements.txt', 'main.py'],
        contents: {
          'requirements.txt': 'requests\nnumpy\npandas'
        }
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.APP_SERVICE);
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.LOW);
      expect(result.framework).toBeUndefined();
    });
    
    test('detects generic Python with pyproject.toml', () => {
      const project = {
        files: ['pyproject.toml', 'src/app.py'],
        contents: {
          'pyproject.toml': `
[project]
name = "my-app"
dependencies = ["requests", "pydantic"]
`
        }
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.APP_SERVICE);
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.LOW);
    });
  });

  describe('Framework Priority', () => {
    test('FastAPI takes priority when multiple frameworks present', () => {
      const project = {
        files: ['requirements.txt', 'main.py'],
        contents: {
          'requirements.txt': 'fastapi\nflask\ndjango'
        }
      };
      
      const result = detectAppType(project);
      
      // FastAPI is checked first based on order in detection logic
      expect(result.framework).toBe('FastAPI');
    });
  });
});
