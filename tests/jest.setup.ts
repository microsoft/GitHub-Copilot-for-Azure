/**
 * Jest Setup File
 * 
 * This file runs before each test file and provides:
 * - Global test utilities
 * - Custom matchers
 * - Shared mock configurations
 */

const path = require("path");

// Make utils available globally for convenience
global.SKILLS_PATH = path.resolve(__dirname, "../plugin/skills");
global.TESTS_PATH = __dirname;

// Helper to get skill path
global.getSkillPath = (skillName) => {
  return path.join(global.SKILLS_PATH, skillName);
};

// Helper to get test fixtures path
global.getFixturesPath = (skillName) => {
  return path.join(global.TESTS_PATH, skillName, "fixtures");
};

// Suppress console output during tests unless DEBUG is set
if (!process.env.DEBUG) {
  global.console = {
    ...console,
    // Keep warn and error for test debugging
    warn: console.warn,
    error: console.error
  };
}
