/**
 * Fixtures Utility
 * 
 * Helper functions for loading and managing test fixtures.
 */

const fs = require('fs');
const path = require('path');

/**
 * Load fixtures for a skill
 * @param {string} skillName - Name of the skill
 * @returns {object} - Parsed fixtures object
 */
function loadFixtures(skillName) {
  const fixturesPath = path.join(
    global.TESTS_PATH || __dirname + '/..',
    skillName,
    'fixtures'
  );

  if (!fs.existsSync(fixturesPath)) {
    return {};
  }

  const fixtures = {};
  const files = fs.readdirSync(fixturesPath);

  for (const file of files) {
    const filePath = path.join(fixturesPath, file);
    const ext = path.extname(file);
    const name = path.basename(file, ext);

    try {
      if (ext === '.json') {
        fixtures[name] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } else if (ext === '.txt' || ext === '.md') {
        fixtures[name] = fs.readFileSync(filePath, 'utf-8');
      }
    } catch (error) {
      console.warn(`Failed to load fixture ${file}: ${error.message}`);
    }
  }

  return fixtures;
}

/**
 * Load a specific fixture file
 * @param {string} skillName - Name of the skill
 * @param {string} fixtureName - Name of the fixture file (without extension)
 * @param {string} extension - File extension (default: 'json')
 * @returns {*} - Parsed fixture content
 */
function loadFixture(skillName, fixtureName, extension = 'json') {
  const fixturePath = path.join(
    global.TESTS_PATH || __dirname + '/..',
    skillName,
    'fixtures',
    `${fixtureName}.${extension}`
  );

  if (!fs.existsSync(fixturePath)) {
    throw new Error(`Fixture not found: ${fixturePath}`);
  }

  const content = fs.readFileSync(fixturePath, 'utf-8');

  if (extension === 'json') {
    return JSON.parse(content);
  }

  return content;
}

/**
 * Create a fixture file for a skill
 * @param {string} skillName - Name of the skill
 * @param {string} fixtureName - Name of the fixture file
 * @param {*} content - Content to write
 * @param {string} extension - File extension (default: 'json')
 */
function createFixture(skillName, fixtureName, content, extension = 'json') {
  const fixturesDir = path.join(
    global.TESTS_PATH || __dirname + '/..',
    skillName,
    'fixtures'
  );

  // Ensure fixtures directory exists
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true });
  }

  const fixturePath = path.join(fixturesDir, `${fixtureName}.${extension}`);
  const fileContent = extension === 'json' 
    ? JSON.stringify(content, null, 2) 
    : content;

  fs.writeFileSync(fixturePath, fileContent, 'utf-8');
}

/**
 * Load prompts from a fixture file
 * @param {string} skillName - Name of the skill
 * @returns {{shouldTrigger: string[], shouldNotTrigger: string[]}}
 */
function loadPromptFixtures(skillName) {
  try {
    const fixtures = loadFixture(skillName, 'prompts');
    return {
      shouldTrigger: fixtures.shouldTrigger || [],
      shouldNotTrigger: fixtures.shouldNotTrigger || []
    };
  } catch {
    return { shouldTrigger: [], shouldNotTrigger: [] };
  }
}

module.exports = {
  loadFixtures,
  loadFixture,
  createFixture,
  loadPromptFixtures
};
