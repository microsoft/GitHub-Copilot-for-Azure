#!/usr/bin/env node

/**
 * Coverage Grid Generator
 * 
 * Scans skills and tests to generate a markdown coverage grid.
 * Updates the README.md with current test status.
 * 
 * Run with: npm run coverage:grid
 */

const fs = require('fs');
const path = require('path');

const SKILLS_PATH = path.resolve(__dirname, '../../plugin/skills');
const TESTS_PATH = path.resolve(__dirname, '..');
const README_PATH = path.resolve(__dirname, '../README.md');
const COVERAGE_PATH = path.resolve(__dirname, '../coverage/coverage-summary.json');

/**
 * Get list of all skills
 */
function getSkills() {
  return fs.readdirSync(SKILLS_PATH, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)
    .sort();
}

/**
 * Check if a test file exists for a skill
 */
function hasTestFile(skillName, testType) {
  const testFileJs = path.join(TESTS_PATH, skillName, `${testType}.test.js`);
  const testFileTs = path.join(TESTS_PATH, skillName, `${testType}.test.ts`);
  return fs.existsSync(testFileJs) || fs.existsSync(testFileTs);
}

/**
 * Check if a skill has any tests
 */
function hasTests(skillName) {
  const skillTestDir = path.join(TESTS_PATH, skillName);
  if (!fs.existsSync(skillTestDir)) return false;
  
  const files = fs.readdirSync(skillTestDir);
  return files.some(f => f.endsWith('.test.js') || f.endsWith('.test.ts'));
}

/**
 * Load coverage data if available
 */
function loadCoverage() {
  if (!fs.existsSync(COVERAGE_PATH)) {
    return null;
  }
  
  try {
    return JSON.parse(fs.readFileSync(COVERAGE_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Get coverage percentage for a skill
 */
function getSkillCoverage(skillName, coverageData) {
  if (!coverageData) return null;
  
  // Look for files matching the skill
  const skillPattern = `plugin/skills/${skillName}`;
  let totalStatements = 0;
  let coveredStatements = 0;
  
  for (const [filePath, data] of Object.entries(coverageData)) {
    if (filePath.includes(skillPattern) && data.statements) {
      totalStatements += data.statements.total;
      coveredStatements += data.statements.covered;
    }
  }
  
  if (totalStatements === 0) return null;
  return Math.round((coveredStatements / totalStatements) * 100);
}

/**
 * Generate the coverage grid markdown
 */
function generateGrid() {
  const skills = getSkills();
  const coverageData = loadCoverage();
  
  const rows = [];
  
  for (const skill of skills) {
    const hasAnyTests = hasTests(skill);
    const hasUnit = hasTestFile(skill, 'unit');
    const hasTriggers = hasTestFile(skill, 'triggers');
    const hasIntegration = hasTestFile(skill, 'integration');
    const coverage = getSkillCoverage(skill, coverageData);
    
    rows.push({
      skill,
      tests: hasAnyTests ? '✅' : '❌',
      unit: hasUnit ? '✅' : '-',
      triggers: hasTriggers ? '✅' : '-',
      integration: hasIntegration ? '✅' : '-',
      coverage: coverage !== null ? `${coverage}%` : '-'
    });
  }
  
  // Generate markdown table
  let table = '| Skill | Tests | Unit | Triggers | Integration | Coverage |\n';
  table += '|-------|-------|------|----------|-------------|----------|\n';
  
  for (const row of rows) {
    table += `| ${row.skill} | ${row.tests} | ${row.unit} | ${row.triggers} | ${row.integration} | ${row.coverage} |\n`;
  }
  
  table += `\n**Legend:** ✅ Exists | ❌ Missing | Coverage shown as percentage`;
  
  return table;
}

/**
 * Update README.md with new coverage grid
 */
function updateReadme() {
  let readme = fs.readFileSync(README_PATH, 'utf-8');
  
  const startMarker = '<!-- COVERAGE_GRID_START -->';
  const endMarker = '<!-- COVERAGE_GRID_END -->';
  
  const startIndex = readme.indexOf(startMarker);
  const endIndex = readme.indexOf(endMarker);
  
  if (startIndex === -1 || endIndex === -1) {
    console.error('Coverage grid markers not found in README.md');
    process.exit(1);
  }
  
  const grid = generateGrid();
  const newContent = readme.substring(0, startIndex + startMarker.length) + 
    '\n' + grid + '\n' + 
    readme.substring(endIndex);
  
  fs.writeFileSync(README_PATH, newContent);
  console.log('README.md updated with coverage grid');
}

/**
 * Print coverage grid to console
 */
function printGrid() {
  console.log('\n=== Skills Coverage Grid ===\n');
  console.log(generateGrid());
  
  const skills = getSkills();
  const tested = skills.filter(s => hasTests(s)).length;
  console.log(`\nSummary: ${tested}/${skills.length} skills have tests`);
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--print')) {
    printGrid();
  } else {
    updateReadme();
    printGrid();
  }
}

module.exports = {
  getSkills,
  hasTests,
  hasTestFile,
  generateGrid,
  updateReadme
};