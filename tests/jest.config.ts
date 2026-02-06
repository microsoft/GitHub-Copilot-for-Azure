import type { Config } from "jest";

const config: Config = {
  // Use ts-jest ESM preset for ESM-only packages like @github/copilot-sdk
  preset: "ts-jest/presets/default-esm",

  // Use Node test environment
  testEnvironment: "node",

  // Treat .ts files as ESM
  extensionsToTreatAsEsm: [".ts"],

  // Root directory for tests
  rootDir: ".",

  // Test file patterns
  testMatch: [
    "**/*.test.js",
    "**/*.test.ts"
  ],

  // Ignore template folder in test runs (it's just examples)
  testPathIgnorePatterns: [
    "/node_modules/",
    "/_template/",
    "/dist/"
  ],

  // Global setup — runs once before any worker starts
  globalSetup: "./jest.globalSetup.ts",
  
  // Setup file for shared utilities
  setupFilesAfterEnv: ["./jest.setup.ts"],

  // Coverage configuration
  collectCoverageFrom: [
    "../plugin/skills/**/*.js",
    "../plugin/skills/**/*.ts",
    "!**/node_modules/**",
    "!**/_template/**"
  ],
  coverageDirectory: "./coverage",
  coverageReporters: ["text", "text-summary", "html", "json-summary"],

  // Reporter configuration for CI/Console/PR readability
  reporters: [
    "default",
    ["jest-junit", {
      outputDirectory: "./reports",
      outputName: "junit.xml",
      ancestorSeparator: " › ",
      classNameTemplate: "{classname}",
      titleTemplate: "{title}"
    }]
  ],

  // Verbose output for better readability
  verbose: true,

  // Fail fast in CI
  bail: process.env.CI ? 1 : 0,

  // Test timeout - longer for integration tests (agent sessions can take 60s+)
  testTimeout: 20 * 60 * 1000, // 20 minutes

  // Clear mocks between tests
  clearMocks: true,

  // Module paths for easier imports
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",  // Handle ESM .js extension imports
    "^@utils/(.*)$": "<rootDir>/utils/$1",
    "^@fixtures/(.*)$": "<rootDir>/$1/fixtures"
  },

  // ts-jest configuration for ESM
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
      },
    ],
  },

  // Display individual test results
  displayName: {
    name: "SKILLS",
    color: "blue"
  },
};

export default config;
