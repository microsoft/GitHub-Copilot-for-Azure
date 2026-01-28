/**
 * Tests for Dockerfile Validator
 */

const {
  checkNodeEnvProduction,
  checkHealthcheck,
  checkNonRootUser,
  checkBaseImage
} = require('../src/validators/dockerfileValidator');

describe('Dockerfile Validator', () => {
  
  describe('checkNodeEnvProduction', () => {
    test('passes with ENV NODE_ENV=production', () => {
      const content = `
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY . .
RUN npm ci --only=production
CMD ["node", "server.js"]
      `;
      const result = checkNodeEnvProduction(content);
      expect(result.passed).toBe(true);
    });

    test('passes with ENV NODE_ENV production (space separator)', () => {
      const content = `
FROM node:20
ENV NODE_ENV production
CMD ["npm", "start"]
      `;
      const result = checkNodeEnvProduction(content);
      expect(result.passed).toBe(true);
    });

    test('passes with ARG NODE_ENV=production', () => {
      const content = `
FROM node:20-alpine
ARG NODE_ENV=production
RUN npm ci
      `;
      const result = checkNodeEnvProduction(content);
      expect(result.passed).toBe(true);
    });

    test('fails when NODE_ENV is missing', () => {
      const content = `
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm ci
CMD ["node", "server.js"]
      `;
      const result = checkNodeEnvProduction(content);
      expect(result.passed).toBe(false);
      expect(result.message).toContain('NODE_ENV=production');
    });

    test('fails when NODE_ENV is set to development', () => {
      const content = `
FROM node:20
ENV NODE_ENV=development
CMD ["npm", "start"]
      `;
      const result = checkNodeEnvProduction(content);
      expect(result.passed).toBe(false);
    });
  });

  describe('checkHealthcheck', () => {
    test('passes with HEALTHCHECK CMD', () => {
      const content = `
FROM node:20-alpine
HEALTHCHECK CMD curl -f http://localhost:3000/health || exit 1
CMD ["node", "server.js"]
      `;
      const result = checkHealthcheck(content);
      expect(result.passed).toBe(true);
    });

    test('passes with HEALTHCHECK with options', () => {
      const content = `
FROM node:20-alpine
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD curl -f http://localhost:3000/health || exit 1
CMD ["node", "server.js"]
      `;
      const result = checkHealthcheck(content);
      expect(result.passed).toBe(true);
    });

    test('passes with HEALTHCHECK NONE (explicitly disabled)', () => {
      const content = `
FROM node:20-alpine
HEALTHCHECK NONE
CMD ["node", "server.js"]
      `;
      const result = checkHealthcheck(content);
      expect(result.passed).toBe(true);
    });

    test('fails when HEALTHCHECK is missing', () => {
      const content = `
FROM node:20-alpine
WORKDIR /app
COPY . .
CMD ["node", "server.js"]
      `;
      const result = checkHealthcheck(content);
      expect(result.passed).toBe(false);
      expect(result.message).toContain('HEALTHCHECK');
    });
  });

  describe('checkNonRootUser', () => {
    test('passes with USER node', () => {
      const content = `
FROM node:20-alpine
WORKDIR /app
COPY --chown=node:node . .
USER node
CMD ["node", "server.js"]
      `;
      const result = checkNonRootUser(content);
      expect(result.passed).toBe(true);
    });

    test('passes with USER appuser', () => {
      const content = `
FROM node:20-alpine
RUN adduser -D appuser
USER appuser
CMD ["node", "server.js"]
      `;
      const result = checkNonRootUser(content);
      expect(result.passed).toBe(true);
    });

    test('passes with numeric USER', () => {
      const content = `
FROM node:20-alpine
USER 1000
CMD ["node", "server.js"]
      `;
      const result = checkNonRootUser(content);
      expect(result.passed).toBe(true);
    });

    test('fails when running as root (node image)', () => {
      const content = `
FROM node:20-alpine
WORKDIR /app
COPY . .
CMD ["node", "server.js"]
      `;
      const result = checkNonRootUser(content);
      expect(result.passed).toBe(false);
      expect(result.message).toContain('node');
    });

    test('fails when USER root is explicit', () => {
      const content = `
FROM node:20
USER root
CMD ["node", "server.js"]
      `;
      const result = checkNonRootUser(content);
      expect(result.passed).toBe(false);
    });
  });

  describe('checkBaseImage', () => {
    test('passes with alpine image', () => {
      const content = `FROM node:20-alpine`;
      const result = checkBaseImage(content);
      expect(result.passed).toBe(true);
      expect(result.message).toContain('optimized');
    });

    test('passes with slim image', () => {
      const content = `FROM node:20-slim`;
      const result = checkBaseImage(content);
      expect(result.passed).toBe(true);
    });

    test('passes with explicit version', () => {
      const content = `FROM node:20.10.0`;
      const result = checkBaseImage(content);
      expect(result.passed).toBe(true);
    });

    test('warns with :latest tag', () => {
      const content = `FROM node:latest`;
      const result = checkBaseImage(content);
      expect(result.passed).toBe(false);
      expect(result.message).toContain('specific version');
    });

    test('warns with no tag', () => {
      const content = `FROM node`;
      const result = checkBaseImage(content);
      expect(result.passed).toBe(false);
    });

    test('fails with no FROM instruction', () => {
      const content = `
WORKDIR /app
COPY . .
      `;
      const result = checkBaseImage(content);
      expect(result.passed).toBe(false);
    });
  });
});
