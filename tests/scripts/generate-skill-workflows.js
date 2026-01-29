#!/usr/bin/env node

/**
 * Workflow Generator Script
 * 
 * Generates per-skill GitHub Actions workflow files.
 * Run with: node scripts/generate-skill-workflows.js
 */

const fs = require('fs');
const path = require('path');

const SKILLS_PATH = path.resolve(__dirname, '../../plugin/skills');
const WORKFLOWS_PATH = path.resolve(__dirname, '../../.github/workflows');

function generateWorkflow(skillName) {
  return `# Auto-generated workflow for ${skillName}
# Runs tests when this skill or its tests change.

name: Test ${skillName}

on:
  push:
    branches:
      - main
    paths:
      - 'plugin/skills/${skillName}/**'
      - 'tests/${skillName}/**'
      - 'tests/utils/**'
  pull_request:
    paths:
      - 'plugin/skills/${skillName}/**'
      - 'tests/${skillName}/**'
      - 'tests/utils/**'
  workflow_dispatch:

jobs:
  test:
    uses: ./.github/workflows/test-skill-reusable.yml
    with:
      skill-name: ${skillName}
`;
}

function main() {
  // Get all skill directories
  const skills = fs.readdirSync(SKILLS_PATH, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  console.log(`Found ${skills.length} skills`);

  // Ensure workflows directory exists
  if (!fs.existsSync(WORKFLOWS_PATH)) {
    fs.mkdirSync(WORKFLOWS_PATH, { recursive: true });
  }

  let generated = 0;
  for (const skillName of skills) {
    const workflowPath = path.join(WORKFLOWS_PATH, `test-skill-${skillName}.yml`);
    
    // Only generate if workflow doesn't exist
    if (!fs.existsSync(workflowPath)) {
      const workflow = generateWorkflow(skillName);
      fs.writeFileSync(workflowPath, workflow);
      console.log(`Generated: test-skill-${skillName}.yml`);
      generated++;
    } else {
      console.log(`Skipped (exists): test-skill-${skillName}.yml`);
    }
  }

  console.log(`\nGenerated ${generated} new workflow files`);
}

if (require.main === module) {
  main();
}

module.exports = { generateWorkflow };
