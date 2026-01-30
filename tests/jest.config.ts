import type { Config } from 'jest';

// Check if @github/copilot-sdk is available
let sdkAvailable = false;
try {
  require.resolve('@github/copilot-sdk');
  sdkAvailable = true;
} catch {
  sdkAvailable = false;
}

const config: Config = {
  // Use ts-jest for TypeScript support
  preset: 'ts-jest',
  
  // Root directory for tests
  rootDir: '.',
  
  // Test file patterns
  testMatch: [
    '**/*.test.js',
    '**/*.test.ts'
  ],
  
  // Ignore template folder in test runs (it's just examples)
  testPathIgnorePatterns: [
    '/node_modules/',
    '/_template/',
    '/dist/',
    // Skip integration tests if SDK is not available
    ...(sdkAvailable ? [] : ['integration.test.ts', 'integration.test.js'])
  ],
  
  // Setup file for shared utilities
  setupFilesAfterEnv: ['./jest.setup.ts'],
  
  // Coverage configuration
  collectCoverageFrom: [
    '../plugin/skills/**/*.js',
    '../plugin/skills/**/*.ts',
    '!**/node_modules/**',
    '!**/_template/**'
  ],
  coverageDirectory: './coverage',
  coverageReporters: ['text', 'text-summary', 'html', 'json-summary'],
  
  // Reporter configuration for CI/Console/PR readability
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: './reports',
      outputName: 'junit.xml',
      ancestorSeparator: ' › ',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}'
    }]
  ],
  
  // Verbose output for better readability
  verbose: true,
  
  // Fail fast in CI
  bail: process.env.CI ? 1 : 0,
  
  // Test timeout - longer for integration tests (agent sessions can take 60s+)
  testTimeout: 120000,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Module paths for easier imports
  moduleNameMapper: {
    '^@utils/(.*)$': '<rootDir>/utils/$1',
    '^@fixtures/(.*)$': '<rootDir>/$1/fixtures'
  },
  
  // Display individual test results
  displayName: {
    name: 'SKILLS',
    color: 'blue'
  },
};

export default config;
