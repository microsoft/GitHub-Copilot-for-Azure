#!/usr/bin/env node
/**
 * Cleans up all SWA test deployments.
 * 
 * Usage:
 *   node cleanup-swa-tests.js
 */

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const scriptDir = __dirname;

const tests = [
    { name: '01-static-root', envName: 'swa-test-01' },
    { name: '02-framework-root', envName: 'swa-test-02' },
    { name: '03-static-subfolder', envName: 'swa-test-03' },
    { name: '04-framework-subfolder', envName: 'swa-test-04' }
];

function runSilent(exe, args, cwd) {
    const result = spawnSync(exe, args, { encoding: 'utf8', cwd, stdio: 'pipe' });
    return { stdout: result.stdout || '', stderr: result.stderr || '', exitCode: result.status };
}

console.log('\n🧹 Cleaning up SWA test deployments...\n');

for (const test of tests) {
    const testPath = path.join(scriptDir, test.name);
    const envPath = path.join(testPath, '.azure', test.envName);

    if (fs.existsSync(envPath)) {
        console.log(`  Removing ${test.name}...`);
        const result = runSilent('azd', ['down', '--force', '--purge', '--no-prompt'], testPath);

        if (result.exitCode === 0) {
            console.log(`  ✅ ${test.name} removed`);
        } else {
            console.log(`  ❌ ${test.name} removal failed (exit code: ${result.exitCode})`);
            console.log(result.stdout + result.stderr);
        }
    } else {
        console.log(`  ⏭️ ${test.name} not deployed, skipping`);
    }
}

console.log('\n✅ Cleanup complete!\n');
