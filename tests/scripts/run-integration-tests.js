#!/usr/bin/env node

/**
 * Integration Test Runner
 * 
 * Runs integration tests and shows results table when not in CI.
 * Cross-platform compatible (Windows + macOS).
 */

const { spawn } = require('child_process');
const path = require('path');

const isCI = process.env.CI === 'true' || process.env.CI === '1' || process.env.GITHUB_ACTIONS === 'true';

// Get any additional args passed to the script
const extraArgs = process.argv.slice(2);

// Build jest command args
const jestArgs = [
  '--testMatch=**/*integration*.ts',
  '--testPathIgnorePatterns=node_modules|_template',
  ...extraArgs
];

console.log(`Running integration tests${isCI ? ' (CI mode)' : ''}...`);
console.log(`jest ${jestArgs.join(' ')}\n`);

// Set NODE_OPTIONS for ESM support
const env = {
  ...process.env,
  NODE_OPTIONS: '--experimental-vm-modules'
};

// Run jest
const jest = spawn('npx', ['jest', ...jestArgs], {
  stdio: 'inherit',
  shell: true,
  env,
  cwd: path.resolve(__dirname, '..')
});

jest.on('close', (code) => {
  // Show results table if not in CI
  if (!isCI) {
    console.log('\n');
    const results = spawn('node', [path.join(__dirname, 'show-test-results.js')], {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '..')
    });
    
    results.on('close', () => {
      process.exit(code);
    });
  } else {
    process.exit(code);
  }
});
