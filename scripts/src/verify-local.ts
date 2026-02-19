#!/usr/bin/env node
/**
 * Verify Local Skills Setup
 * 
 * Checks whether the installed plugin is symlinked to the current repository,
 * ensuring developers are working with local skills vs the user profile copy.
 * 
 * Usage: npm run verify-local
 */

import { existsSync, realpathSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

function getRepoRoot(): string {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  return resolve(scriptDir, '../..');
}

function getInstalledPluginPath(): string {
  return join(homedir(), '.copilot', 'installed-plugins', 'github-copilot-for-azure');
}

function resolveSymlinkTarget(linkPath: string): string | null {
  try {
    return realpathSync(linkPath);
  } catch {
    return null;
  }
}

function main(): void {
  const repoRoot = getRepoRoot();
  const installedPath = getInstalledPluginPath();
  const localPath = resolve(repoRoot, 'plugin');

  console.log('\n🔍 Verifying Local Skills Setup\n');
  console.log('────────────────────────────────────────────────────────────');

  console.log(`\n📁 Local plugin path:`);
  console.log(`   ${localPath}`);
  console.log(`   ${existsSync(localPath) ? '✅ Exists' : '❌ Not found'}`);

  console.log(`\n📁 Installed plugin path:`);
  console.log(`   ${installedPath}`);

  if (!existsSync(installedPath)) {
    console.log('   ❌ Not found\n');
    console.log('⚠️  No plugin installed. Run the symlink setup from CONTRIBUTING.md\n');
    process.exitCode = 1;
    return;
  }

  const target = resolveSymlinkTarget(installedPath);
  if (target) {
    console.log(`   → Points to: ${target}`);
  }

  console.log('\n────────────────────────────────────────────────────────────');

  // Compare normalized paths
  const normalizedTarget = target?.toLowerCase().replace(/\\/g, '/');
  const normalizedLocal = realpathSync(localPath).toLowerCase().replace(/\\/g, '/');
  const isLinkedToLocal = normalizedTarget === normalizedLocal;

  if (isLinkedToLocal) {
    console.log('\n✅ SUCCESS: Using local skills from this repository\n');
    console.log('   Your changes to skills will be picked up by Copilot CLI');
    console.log('   (restart CLI after making changes)\n');
  } else if (target) {
    console.log('\n⚠️  WARNING: Plugin is linked to a DIFFERENT location\n');
    console.log(`   Expected: ${localPath}`);
    console.log(`   Actual:   ${target}\n`);
    console.log('   To fix, remove the existing link and create a new one.');
    console.log('   See CONTRIBUTING.md for instructions.\n');
    process.exitCode = 1;
  } else {
    console.log('\n❌ ERROR: Plugin exists but is not a symlink\n');
    console.log('   The installed plugin may be a regular copy, not linked to your repo.');
    console.log('   Remove it and create a symlink per CONTRIBUTING.md\n');
    process.exitCode = 1;
  }
}

main();
