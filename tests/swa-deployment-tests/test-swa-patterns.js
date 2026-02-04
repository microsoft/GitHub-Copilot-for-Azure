#!/usr/bin/env node
/**
 * Tests all SWA deployment patterns and generates a report with URLs.
 * 
 * Usage:
 *   node test-swa-patterns.js --subscription <subscription-id> [--location <region>] [--skip-deploy]
 * 
 * Examples:
 *   node test-swa-patterns.js --subscription "your-sub-id"
 *   node test-swa-patterns.js --subscription "your-sub-id" --location westus2
 *   node test-swa-patterns.js --subscription "your-sub-id" --skip-deploy
 */

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

// Parse arguments
const args = process.argv.slice(2);
const getArg = (name) => {
    const idx = args.indexOf(`--${name}`);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
};
const hasFlag = (name) => args.includes(`--${name}`);

const subscriptionId = getArg('subscription');
const location = getArg('location') || 'westus2';
const skipDeploy = hasFlag('skip-deploy');

// Validate inputs to prevent shell injection
const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validLocationPattern = /^[a-z0-9]+$/;

if (!subscriptionId) {
    console.error('Error: --subscription is required');
    console.error('Usage: node test-swa-patterns.js --subscription <subscription-id> [--location <region>] [--skip-deploy]');
    process.exit(1);
}

if (!guidPattern.test(subscriptionId)) {
    console.error('Error: Invalid subscription ID format. Must be a GUID (e.g., 12345678-1234-1234-1234-123456789abc)');
    process.exit(1);
}

if (!validLocationPattern.test(location)) {
    console.error('Error: Invalid location format');
    process.exit(1);
}

const scriptDir = __dirname;

const tests = [
    {
        name: '01-static-root',
        envName: 'swa-test-01',
        pattern: 'Static files in root',
        config: 'project: ., language: js, dist: public',
        path: path.join(scriptDir, '01-static-root'),
        expectedContent: /<title>.*Static.*<\/title>/i  // Check HTML title element
    },
    {
        name: '02-framework-root',
        envName: 'swa-test-02',
        pattern: 'Framework app in root',
        config: 'project: ., language: js, dist: dist',
        path: path.join(scriptDir, '02-framework-root'),
        expectedContent: /<title>.*Framework.*<\/title>/i  // Check HTML title element
    },
    {
        name: '03-static-subfolder',
        envName: 'swa-test-03',
        pattern: 'Static files in subfolder',
        config: 'project: ./src/web, dist: .',
        path: path.join(scriptDir, '03-static-subfolder'),
        expectedContent: /<title>.*Static.*<\/title>/i  // Check HTML title element
    },
    {
        name: '04-framework-subfolder',
        envName: 'swa-test-04',
        pattern: 'Framework app in subfolder',
        config: 'project: ./src/web, language: js, dist: dist',
        path: path.join(scriptDir, '04-framework-subfolder'),
        expectedContent: /<title>.*Framework.*<\/title>/i  // Check HTML title element
    }
];

const results = [];

function runSilent(exe, args, cwd) {
    const result = spawnSync(exe, args, { encoding: 'utf8', cwd, stdio: 'pipe' });
    return { stdout: result.stdout || '', stderr: result.stderr || '', exitCode: result.status };
}

async function httpGet(url, timeout = 15000) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        const req = client.get(url, { timeout }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, content: data }));
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

console.log('\n========================================');
console.log('  SWA Deployment Pattern Tests');
console.log('========================================\n');

async function deploy() {
    if (skipDeploy) return;

    for (const test of tests) {
        console.log(`\n[${test.name}] Deploying: ${test.pattern}`);
        console.log(`  Config: ${test.config}`);

        const cwd = test.path;

        // Clean up old env if exists
        const azureDir = path.join(cwd, '.azure');
        if (fs.existsSync(azureDir)) {
            fs.rmSync(azureDir, { recursive: true, force: true });
        }

        // Install npm dependencies for framework projects
        if (test.name.includes('framework')) {
            const packageJsonPath = test.name.includes('subfolder') 
                ? path.join(cwd, 'src/web/package.json')
                : path.join(cwd, 'package.json');
            
            if (fs.existsSync(packageJsonPath)) {
                const npmDir = path.dirname(packageJsonPath);
                console.log(`  Installing npm dependencies in ${path.relative(cwd, npmDir) || '.'}...`);
                const npmResult = runSilent('npm', ['install', '--quiet'], npmDir);
                if (npmResult.exitCode !== 0) {
                    console.log('  ❌ npm install failed');
                    continue;
                }
            }
        }

        // Set up azd environment
        let result = runSilent('azd', ['env', 'new', test.envName, '--no-prompt'], cwd);
        if (result.exitCode !== 0) {
            console.log('  ❌ Failed to create azd environment');
            continue;
        }

        runSilent('azd', ['env', 'set', 'AZURE_LOCATION', location], cwd);
        runSilent('azd', ['env', 'set', 'AZURE_SUBSCRIPTION_ID', subscriptionId], cwd);

        // Deploy
        console.log('  Deploying...');
        result = runSilent('azd', ['up', '--no-prompt'], cwd);

        if (result.exitCode === 0) {
            console.log('  ✅ Deployment succeeded');
        } else {
            console.log('  ❌ Deployment failed');
            console.log(result.stdout + result.stderr);
        }
    }
}

async function generateReport() {
    console.log('\n\n========================================');
    console.log('  DEPLOYMENT REPORT');
    console.log('========================================\n');

    for (const test of tests) {
        const cwd = test.path;
        const azureDir = path.join(cwd, '.azure');

        if (!fs.existsSync(azureDir)) {
            results.push({
                test: test.name,
                pattern: test.pattern,
                url: 'Not deployed',
                status: '❌ No env',
                content: 'N/A'
            });
            continue;
        }

        // Get URL from azd env
        const envResult = runSilent('azd', ['env', 'get-values'], cwd);
        const urlMatch = envResult.stdout.match(/WEB_URI="(https:\/\/[^"]+)"/);
        const url = urlMatch ? urlMatch[1] : null;

        if (!url) {
            results.push({
                test: test.name,
                pattern: test.pattern,
                url: 'No URL found',
                status: '❌ Not deployed',
                content: 'N/A'
            });
            continue;
        }

        // Test if site is responding with retries
        const maxRetries = 3;
        let status = '❌ Failed';
        let contentStatus = '❌ Not verified';

        for (let retry = 0; retry < maxRetries; retry++) {
            try {
                await sleep(2000);
                const response = await httpGet(url);

                if (response.statusCode === 200) {
                    status = '✅ 200 OK';

                    if (test.expectedContent.test(response.content)) {
                        contentStatus = '✅ Content verified';
                    } else if (/Congratulations/.test(response.content)) {
                        contentStatus = '⚠️ Azure default page (still deploying?)';
                    } else {
                        contentStatus = '⚠️ Unexpected content';
                    }
                    break;
                } else {
                    status = `⚠️ HTTP ${response.statusCode}`;
                }
            } catch (e) {
                status = `❌ ${e.message}`;
            }

            if (retry < maxRetries - 1) {
                console.log(`  Retrying ${test.name}...`);
                await sleep(5000);
            }
        }

        results.push({
            test: test.name,
            pattern: test.pattern,
            url,
            status,
            content: contentStatus
        });
    }

    // Display results table
    console.log('\nTest                    Pattern                      Status        Content');
    console.log('----------------------  ---------------------------  ------------  ---------------------');
    for (const r of results) {
        console.log(
            `${r.test.padEnd(22)}  ${r.pattern.padEnd(27)}  ${r.status.padEnd(12)}  ${r.content}`
        );
    }

    console.log('\n📋 URLs for manual testing:\n');
    for (const r of results) {
        const icon = r.status.includes('✅') ? '✅' : r.status.includes('⚠️') ? '⚠️' : '❌';
        if (!r.url.includes('Not deployed') && !r.url.includes('No URL')) {
            console.log(`  ${icon} ${r.test}: ${r.url}`);
        } else {
            console.log(`  ❌ ${r.test}: ${r.url}`);
        }
    }

    // Summary
    const passed = results.filter(r => r.status.includes('✅') && r.content.includes('✅')).length;
    const total = results.length;
    console.log('\n========================================');
    console.log(`  SUMMARY: ${passed}/${total} tests passed`);
    console.log('========================================');

    if (passed !== total) {
        console.log('\n⚠️  Some tests need attention. Check URLs above.\n');
    }

    console.log('\nTo clean up all resources, run:');
    console.log('  node cleanup-swa-tests.js\n');
}

async function main() {
    await deploy();
    await generateReport();
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
