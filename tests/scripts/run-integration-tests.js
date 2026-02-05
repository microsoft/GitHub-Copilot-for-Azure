#!/usr/bin/env node

/**
 * Integration Test Runner
 * 
 * Runs integration tests and shows results table when not in CI.
 * Cross-platform compatible (Windows + macOS).
 */

import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isCI = !!(process.env.CI || process.env.GITHUB_ACTIONS);

// Get any additional args passed to the script
const extraArgs = process.argv.slice(2);

// Build jest command args
const jestArgs = [
  '--testMatch=**/*integration*.ts',
  '--testPathIgnorePatterns="node_modules|_template"',
  ...extraArgs
];

console.log(`Running integration tests${isCI ? ' (CI mode)' : ''}...`);
console.log(`jest ${jestArgs.join(' ')}\n`);

// Set NODE_OPTIONS for ESM support (append to existing if present)
const existingNodeOptions = process.env.NODE_OPTIONS || '';
const env = {
  ...process.env,
  NODE_OPTIONS: existingNodeOptions
    ? `${existingNodeOptions} --experimental-vm-modules`
    : '--experimental-vm-modules'
};

// Run jest
const jest = spawn('npx', ['jest', ...jestArgs], {
  stdio: 'inherit',
  shell: true,
  env,
  cwd: path.resolve(__dirname, '..')
});

jest.on('error', (err) => {
  console.error('Failed to start jest:', err.message);
  process.exit(1);
});

jest.on('close', (code) => {
  const jestExitCode = code || 0;

  // Show results table if not in CI
  if (!isCI) {
    console.log('\n');
    const results = spawn('node', [path.join(__dirname, 'show-test-results.js')], {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '..')
    });

    results.on('error', (err) => {
      console.error('Failed to display results:', err.message);
      process.exit(jestExitCode);
    });

    results.on('close', () => {
      // Always use jest exit code, not results script exit code
      process.exit(jestExitCode);
    });
  } else {
    process.exit(jestExitCode);
  }
});
