/**
 * Fixture Loader Utilities
 * 
 * Loads project fixtures and expectations for testing.
 */

const fs = require('fs');
const path = require('path');

const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures', 'projects');
const EXPECTATIONS_FILE = path.join(__dirname, '..', 'fixtures', 'expectations.json');

/**
 * List all project fixture directories
 * @returns {string[]} Array of fixture names
 */
function listProjectFixtures() {
  if (!fs.existsSync(FIXTURES_DIR)) {
    return [];
  }
  return fs.readdirSync(FIXTURES_DIR).filter(name => {
    const fullPath = path.join(FIXTURES_DIR, name);
    return fs.statSync(fullPath).isDirectory();
  });
}

/**
 * Get the full path to a project fixture
 * @param {string} fixtureName - Name of the fixture
 * @returns {string} Full path to the fixture directory
 */
function getProjectPath(fixtureName) {
  return path.join(FIXTURES_DIR, fixtureName);
}

/**
 * Load expectations from JSON file
 * @returns {Object} Expectations object keyed by fixture name
 */
function loadExpectations() {
  if (!fs.existsSync(EXPECTATIONS_FILE)) {
    return {};
  }
  const content = fs.readFileSync(EXPECTATIONS_FILE, 'utf-8');
  return JSON.parse(content);
}

/**
 * Validate that all fixtures have corresponding expectations
 * @returns {{valid: boolean, missing: string[], extra: string[]}}
 */
function validateFixturesHaveExpectations() {
  const fixtures = listProjectFixtures();
  const expectations = loadExpectations();
  const expectationKeys = Object.keys(expectations);
  
  const missing = fixtures.filter(f => !expectationKeys.includes(f));
  const extra = expectationKeys.filter(e => !fixtures.includes(e));
  
  return {
    valid: missing.length === 0 && extra.length === 0,
    missing,
    extra
  };
}

module.exports = {
  listProjectFixtures,
  getProjectPath,
  loadExpectations,
  validateFixturesHaveExpectations,
  FIXTURES_DIR,
  EXPECTATIONS_FILE
};
