/**
 * Setup Command
 * 
 * Creates a symlink from ~/.copilot/installed-plugins/github-copilot-for-azure
 * to the local plugin directory for development.
 */

import { existsSync, lstatSync, mkdirSync, rmSync, symlinkSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, platform } from 'node:os';
import { execSync } from 'node:child_process';

interface SetupOptions {
  force: boolean;
}

function parseArgs(args: string[]): SetupOptions {
  return {
    force: args.includes('--force') || args.includes('-f'),
  };
}

function getInstalledPluginsDir(): string {
  return join(homedir(), '.copilot', 'installed-plugins');
}

function getInstalledPluginPath(): string {
  return join(getInstalledPluginsDir(), 'github-copilot-for-azure');
}

function isSymlink(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}

function isAdmin(): boolean {
  if (platform() !== 'win32') return true;
  
  try {
    execSync('net session', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function createSymlink(target: string, link: string): void {
  const isWindows = platform() === 'win32';
  
  if (isWindows) {
    // On Windows, use mklink /D via cmd for directory symlinks
    // This requires admin privileges or Developer Mode enabled
    try {
      execSync(`mklink /D "${link}" "${target}"`, { 
        shell: 'cmd.exe',
        stdio: 'pipe' 
      });
    } catch (error) {
      // Try junction as fallback (doesn't require admin)
      try {
        execSync(`mklink /J "${link}" "${target}"`, { 
          shell: 'cmd.exe',
          stdio: 'pipe' 
        });
        console.log('   ℹ️  Created as junction (admin not available)');
      } catch {
        throw new Error(
          'Failed to create symlink. On Windows, either:\n' +
          '   1. Run as Administrator, or\n' +
          '   2. Enable Developer Mode in Settings > Privacy & Security > For developers'
        );
      }
    }
  } else {
    symlinkSync(target, link, 'dir');
  }
}

export function setup(rootDir: string, args: string[]): void {
  const options = parseArgs(args);
  const localPluginPath = join(rootDir, 'plugin');
  const installedPluginsDir = getInstalledPluginsDir();
  const installedPluginPath = getInstalledPluginPath();

  console.log('\n🔧 Local Development Setup\n');
  console.log('────────────────────────────────────────────────────────────');

  // Check local plugin exists
  console.log(`\n📁 Local plugin path:`);
  console.log(`   ${localPluginPath}`);
  if (!existsSync(localPluginPath)) {
    console.log('   ❌ Not found\n');
    console.error('Error: Local plugin directory not found.');
    process.exitCode = 1;
    return;
  }
  console.log('   ✅ Exists');

  // Ensure installed-plugins directory exists
  console.log(`\n📁 Installed plugins directory:`);
  console.log(`   ${installedPluginsDir}`);
  if (!existsSync(installedPluginsDir)) {
    console.log('   📂 Creating...');
    mkdirSync(installedPluginsDir, { recursive: true });
  }
  console.log('   ✅ Ready');

  // Check if target already exists
  console.log(`\n📁 Target symlink path:`);
  console.log(`   ${installedPluginPath}`);

  if (existsSync(installedPluginPath)) {
    if (isSymlink(installedPluginPath)) {
      const currentTarget = realpathSync(installedPluginPath);
      const normalizedCurrent = currentTarget.toLowerCase().replace(/\\/g, '/');
      const normalizedLocal = realpathSync(localPluginPath).toLowerCase().replace(/\\/g, '/');
      
      if (normalizedCurrent === normalizedLocal) {
        console.log('   ✅ Already linked to local repo\n');
        console.log('────────────────────────────────────────────────────────────');
        console.log('\n✅ Setup complete! Already configured correctly.\n');
        return;
      }
      
      console.log(`   ⚠️  Linked to different location: ${currentTarget}`);
      if (!options.force) {
        console.log('\n   Use --force to replace existing symlink.\n');
        process.exitCode = 1;
        return;
      }
      console.log('   🔄 Removing existing symlink...');
      rmSync(installedPluginPath);
    } else {
      console.log('   ⚠️  Exists but is not a symlink (regular directory/file)');
      if (!options.force) {
        console.log('\n   Use --force to replace (will delete existing!).\n');
        process.exitCode = 1;
        return;
      }
      console.log('   🔄 Removing existing directory...');
      rmSync(installedPluginPath, { recursive: true });
    }
  } else {
    console.log('   📂 Does not exist (will create)');
  }

  // Create symlink
  console.log('\n🔗 Creating symlink...');
  
  if (platform() === 'win32' && !isAdmin()) {
    console.log('   ℹ️  Not running as admin, will try junction fallback');
  }

  try {
    createSymlink(localPluginPath, installedPluginPath);
    console.log('   ✅ Symlink created');
  } catch (error) {
    console.log(`   ❌ Failed: ${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 1;
    return;
  }

  console.log('\n────────────────────────────────────────────────────────────');
  console.log('\n✅ Setup complete!\n');
  console.log('   Your local plugin is now linked. Changes to skills will be');
  console.log('   picked up by Copilot CLI (restart CLI after changes).\n');
  console.log('   Run "npm run local verify" to confirm the setup.\n');
}
