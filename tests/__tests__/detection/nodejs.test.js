/**
 * Node.js Framework Detection Tests
 * 
 * Tests for detecting Node.js/JavaScript/TypeScript frameworks
 * and routing to appropriate Azure services.
 */

const { detectAppType } = require('../../src/detection/appTypeDetector');
const { AZURE_SERVICES, SKILL_ROUTES, CONFIDENCE_LEVELS } = require('../../src/detection/serviceMapping');

describe('Node.js Framework Detection', () => {
  describe('Next.js', () => {
    test('detects Next.js with SSR and recommends App Service', () => {
      const project = {
        files: ['package.json', 'next.config.js'],
        contents: {
          'package.json': { dependencies: { next: '^14.0.0', react: '^18.0.0' } },
          'next.config.js': 'module.exports = { reactStrictMode: true };'
        }
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.APP_SERVICE);
      expect(result.skill).toBe(SKILL_ROUTES.APP_SERVICE);
      expect(result.framework).toBe('Next.js (SSR)');
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.MEDIUM);
    });
    
    test('detects Next.js with static export and recommends Static Web Apps', () => {
      const project = {
        files: ['package.json', 'next.config.js'],
        contents: {
          'package.json': { dependencies: { next: '^14.0.0' } },
          'next.config.js': "module.exports = { output: 'export' };"
        }
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.STATIC_WEB_APPS);
      expect(result.skill).toBe(SKILL_ROUTES.STATIC_WEB_APPS);
      expect(result.framework).toBe('Next.js (SSG)');
    });
    
    test('detects next.config.mjs', () => {
      const project = {
        files: ['package.json', 'next.config.mjs'],
        contents: {
          'package.json': { dependencies: { next: '^14.0.0' } },
          'next.config.mjs': 'export default { reactStrictMode: true };'
        }
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.APP_SERVICE);
      expect(result.framework).toBe('Next.js (SSR)');
    });
    
    test('detects next.config.ts', () => {
      const project = {
        files: ['package.json', 'next.config.ts'],
        contents: {
          'package.json': { dependencies: { next: '^14.0.0' } },
          'next.config.ts': 'export default { reactStrictMode: true };'
        }
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.APP_SERVICE);
    });
  });

  describe('Nuxt', () => {
    test('detects Nuxt with SSR and recommends App Service', () => {
      const project = {
        files: ['package.json', 'nuxt.config.ts'],
        contents: {
          'package.json': { dependencies: { nuxt: '^3.0.0' } },
          'nuxt.config.ts': 'export default defineNuxtConfig({ });'
        }
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.APP_SERVICE);
      expect(result.framework).toBe('Nuxt (SSR)');
    });
    
    test('detects Nuxt with static target and recommends Static Web Apps', () => {
      const project = {
        files: ['package.json', 'nuxt.config.ts'],
        contents: {
          'package.json': { dependencies: { nuxt: '^3.0.0' } },
          'nuxt.config.ts': "export default defineNuxtConfig({ ssr: false });"
        }
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.STATIC_WEB_APPS);
      expect(result.framework).toBe('Nuxt (Static)');
    });
  });

  describe('Angular', () => {
    test('detects Angular and recommends Static Web Apps', () => {
      const project = {
        files: ['package.json', 'angular.json'],
        contents: {
          'package.json': { dependencies: { '@angular/core': '^17.0.0' } }
        }
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.STATIC_WEB_APPS);
      expect(result.skill).toBe(SKILL_ROUTES.STATIC_WEB_APPS);
      expect(result.framework).toBe('Angular');
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.MEDIUM);
    });
  });

  describe('Vite-based (React, Vue, Svelte)', () => {
    test('detects Vite with React', () => {
      const project = {
        files: ['package.json', 'vite.config.ts'],
        contents: {
          'package.json': { 
            dependencies: { react: '^18.0.0' },
            devDependencies: { vite: '^5.0.0' }
          }
        }
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.STATIC_WEB_APPS);
      expect(result.framework).toBe('React (Vite)');
    });
    
    test('detects Vite with Vue', () => {
      const project = {
        files: ['package.json', 'vite.config.js'],
        contents: {
          'package.json': { 
            dependencies: { vue: '^3.0.0' },
            devDependencies: { vite: '^5.0.0' }
          }
        }
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.STATIC_WEB_APPS);
      expect(result.framework).toBe('Vue (Vite)');
    });
    
    test('detects Vite with Svelte', () => {
      const project = {
        files: ['package.json', 'vite.config.js'],
        contents: {
          'package.json': { 
            dependencies: { svelte: '^4.0.0' },
            devDependencies: { vite: '^5.0.0' }
          }
        }
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.STATIC_WEB_APPS);
      expect(result.framework).toBe('Svelte (Vite)');
    });
    
    test('detects plain Vite without specific framework', () => {
      const project = {
        files: ['package.json', 'vite.config.mjs'],
        contents: {
          'package.json': { 
            devDependencies: { vite: '^5.0.0' }
          }
        }
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.STATIC_WEB_APPS);
      expect(result.framework).toBe('Vite');
    });
  });

  describe('Gatsby', () => {
    test('detects Gatsby and recommends Static Web Apps', () => {
      const project = {
        files: ['package.json', 'gatsby-config.js'],
        contents: {
          'package.json': { dependencies: { gatsby: '^5.0.0' } }
        }
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.STATIC_WEB_APPS);
      expect(result.framework).toBe('Gatsby');
    });
  });

  describe('Astro', () => {
    test('detects Astro and recommends Static Web Apps', () => {
      const project = {
        files: ['package.json', 'astro.config.mjs'],
        contents: {
          'package.json': { dependencies: { astro: '^4.0.0' } }
        }
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.STATIC_WEB_APPS);
      expect(result.framework).toBe('Astro');
    });
  });

  describe('NestJS', () => {
    test('detects NestJS and recommends App Service', () => {
      const project = {
        files: ['package.json', 'nest-cli.json'],
        contents: {
          'package.json': { dependencies: { '@nestjs/core': '^10.0.0' } }
        }
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.APP_SERVICE);
      expect(result.skill).toBe(SKILL_ROUTES.APP_SERVICE);
      expect(result.framework).toBe('NestJS');
    });
  });

  describe('Express and other server frameworks', () => {
    test('detects Express and recommends App Service', () => {
      const project = {
        files: ['package.json', 'src/index.js'],
        contents: {
          'package.json': { dependencies: { express: '^4.18.0' } }
        }
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.APP_SERVICE);
      expect(result.framework).toBe('Express');
    });
    
    test('detects Fastify and recommends App Service', () => {
      const project = {
        files: ['package.json', 'src/server.js'],
        contents: {
          'package.json': { dependencies: { fastify: '^4.0.0' } }
        }
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.APP_SERVICE);
      expect(result.framework).toBe('Fastify');
    });
    
    test('detects Koa and recommends App Service', () => {
      const project = {
        files: ['package.json', 'app.js'],
        contents: {
          'package.json': { dependencies: { koa: '^2.14.0' } }
        }
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.APP_SERVICE);
      expect(result.framework).toBe('Koa');
    });
    
    test('detects Hapi and recommends App Service', () => {
      const project = {
        files: ['package.json', 'server.js'],
        contents: {
          'package.json': { dependencies: { '@hapi/hapi': '^21.0.0' } }
        }
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.APP_SERVICE);
      expect(result.framework).toBe('@hapi/hapi');
    });
  });

  describe('Generic Node.js', () => {
    test('detects generic Node.js project with low confidence', () => {
      const project = {
        files: ['package.json', 'index.js'],
        contents: {
          'package.json': { name: 'my-app', version: '1.0.0' }
        }
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.APP_SERVICE);
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.LOW);
      expect(result.framework).toBeUndefined();
    });
  });
});
