/**
 * Jest Setup File
 * 
 * This file runs before each test file and provides:
 * - Global test utilities
 * - Custom matchers
 * - Shared mock configurations
 */

const path = require('path');

// Make utils available globally for convenience
global.SKILLS_PATH = path.resolve(__dirname, '../plugin/skills');
global.TESTS_PATH = __dirname;

// Custom matcher: check if a skill should trigger on a prompt
expect.extend({
  toTriggerSkill(prompt, skillName, triggerMatcher) {
    const result = triggerMatcher.shouldTrigger(prompt, skillName);
    return {
      pass: result.triggered,
      message: () => 
        result.triggered
          ? `Expected prompt "${prompt}" NOT to trigger skill "${skillName}"`
          : `Expected prompt "${prompt}" to trigger skill "${skillName}". ` +
            `Confidence: ${result.confidence}. Reason: ${result.reason}`
    };
  },
  
  toNotTriggerSkill(prompt, skillName, triggerMatcher) {
    const result = triggerMatcher.shouldTrigger(prompt, skillName);
    return {
      pass: !result.triggered,
      message: () =>
        !result.triggered
          ? `Expected prompt "${prompt}" to trigger skill "${skillName}"`
          : `Expected prompt "${prompt}" NOT to trigger skill "${skillName}", ` +
            `but it matched with confidence ${result.confidence}`
    };
  }
});

// Suppress console output during tests unless DEBUG is set
if (!process.env.DEBUG) {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    // Keep warn and error for test debugging
    warn: console.warn,
    error: console.error
  };
}

// Helper to get skill path
global.getSkillPath = (skillName) => {
  return path.join(global.SKILLS_PATH, skillName);
};

// Helper to get test fixtures path
global.getFixturesPath = (skillName) => {
  return path.join(global.TESTS_PATH, skillName, 'fixtures');
};
