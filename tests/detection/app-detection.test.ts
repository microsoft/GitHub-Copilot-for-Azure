import { detectProject } from '../utils/project-scanner';
import { getProjectPath, loadExpectations } from '../utils/fixture-loader';

describe('Azure Deploy - Framework Detection', () => {
  const expectations = loadExpectations();

  describe('Node.js Framework Detection', () => {
    it('should detect React with Vite', () => {
      const result = detectProject(getProjectPath('react-vite'));
      expect(result.framework).toBe('react-vite');
    });

    it('should detect Vue with Vite', () => {
      const result = detectProject(getProjectPath('vue-vite'));
      expect(result.framework).toBe('vue-vite');
    });

    it('should detect Angular', () => {
      const result = detectProject(getProjectPath('angular'));
      expect(result.framework).toBe('angular');
    });

    it('should detect Next.js static export', () => {
      const result = detectProject(getProjectPath('nextjs-static'));
      expect(result.framework).toBe('nextjs-static');
    });

    it('should detect Next.js SSR (no export config)', () => {
      const result = detectProject(getProjectPath('nextjs-ssr'));
      expect(result.framework).toBe('nextjs-ssr');
    });

    it('should detect Gatsby', () => {
      const result = detectProject(getProjectPath('gatsby'));
      expect(result.framework).toBe('gatsby');
    });

    it('should detect Astro', () => {
      const result = detectProject(getProjectPath('astro'));
      expect(result.framework).toBe('astro');
    });

    it('should detect Express', () => {
      const result = detectProject(getProjectPath('express-api'));
      expect(result.framework).toBe('express');
    });
  });

  describe('Python Framework Detection', () => {
    it('should detect Flask', () => {
      const result = detectProject(getProjectPath('flask-app'));
      expect(result.framework).toBe('flask');
    });

    it('should detect Django', () => {
      const result = detectProject(getProjectPath('django-app'));
      expect(result.framework).toBe('django');
    });

    it('should detect FastAPI', () => {
      const result = detectProject(getProjectPath('fastapi-app'));
      expect(result.framework).toBe('fastapi');
    });
  });

  describe('.NET Framework Detection', () => {
    it('should detect ASP.NET Core', () => {
      const result = detectProject(getProjectPath('dotnet-webapp'));
      expect(result.framework).toBe('aspnetcore');
    });

    it('should detect Azure Functions .NET', () => {
      const result = detectProject(getProjectPath('functions-dotnet'));
      expect(result.framework).toBe('azure-functions-dotnet');
    });
  });

  describe('Java Framework Detection', () => {
    it('should detect Spring Boot', () => {
      const result = detectProject(getProjectPath('spring-boot'));
      expect(result.framework).toBe('spring-boot');
    });
  });

  describe('Static Site Detection', () => {
    it('should detect plain HTML site', () => {
      const result = detectProject(getProjectPath('plain-html'));
      expect(result.framework).toBe('static-html');
    });
  });

  describe('Framework to Service Mapping', () => {
    // Verify framework → service mapping is correct
    const frameworkServiceMap: Record<string, string> = {
      'react-vite': 'static-web-apps',
      'vue-vite': 'static-web-apps',
      'angular': 'static-web-apps',
      'nextjs-static': 'static-web-apps',
      'nextjs-ssr': 'app-service',
      'gatsby': 'static-web-apps',
      'astro': 'static-web-apps',
      'static-html': 'static-web-apps',
      'express': 'app-service',
      'flask': 'app-service',
      'django': 'app-service',
      'fastapi': 'app-service',
      'aspnetcore': 'app-service',
      'spring-boot': 'app-service',
      'azure-functions-dotnet': 'functions',
    };

    Object.entries(frameworkServiceMap).forEach(([framework, expectedService]) => {
      it(`should map ${framework} to ${expectedService}`, () => {
        // Find fixture with this framework
        const fixtureName = Object.entries(expectations)
          .find(([_, exp]) => exp.framework === framework)?.[0];
        
        if (!fixtureName) {
          console.warn(`No fixture found with framework: ${framework}`);
          return;
        }

        const result = detectProject(getProjectPath(fixtureName));
        expect(result.service).toBe(expectedService);
      });
    });
  });
});
