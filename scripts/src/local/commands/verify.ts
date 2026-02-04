/**
 * Verify Command
 * 
 * Verifies that local plugin files match the installed plugin by:
 * 1. Checking for nested plugin install (plugin/azure/ should not exist)
 * 2. Checking Copilot CLI config for stale/misconfigured plugin entries
 * 3. Creating a temporary marker file in the local plugin
 * 4. Checking if it appears in the installed location
 * 5. Comparing content of key files between both locations
 * 6. Cleaning up the marker file
 */

import { 
  existsSync, 
  readFileSync, 
  writeFileSync, 
  unlinkSync, 
  readdirSync, 
  statSync,
  realpathSync,
  rmSync
} from 'node:fs';
import { join, relative } from 'node:path';
import { homedir } from 'node:os';
import { setup } from './setup.js';

interface InstalledPlugin {
  name: string;
  marketplace: string;
  version?: string;
  installed_at?: string;
  enabled: boolean;
  cache_path: string;
}

interface CopilotConfig {
  installed_plugins?: InstalledPlugin[];
  [key: string]: unknown;
}

interface VerifyOptions {
  fix: boolean;
  verbose: boolean;
}

interface ConfigCheckResult {
  passed: boolean;
  stalePlugins: InstalledPlugin[];
  misconfiguredPlugins: InstalledPlugin[];
  error?: string;
}

function parseArgs(args: string[]): VerifyOptions {
  return {
    fix: args.includes('--fix'),
    verbose: args.includes('--verbose') || args.includes('-v'),
  };
}

function getCopilotConfigPath(): string {
  return join(homedir(), '.copilot', 'config.json');
}

function getInstalledPluginPath(): string {
  return join(homedir(), '.copilot', 'installed-plugins', 'github-copilot-for-azure');
}

interface ConfigReadResult {
  config: CopilotConfig | null;
  error?: string;
  fileExists: boolean;
}

function readCopilotConfig(): ConfigReadResult {
  const configPath = getCopilotConfigPath();
  if (!existsSync(configPath)) {
    return { config: null, fileExists: false };
  }
  try {
    return { config: JSON.parse(readFileSync(configPath, 'utf-8')), fileExists: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { config: null, error: `Failed to parse config: ${message}`, fileExists: true };
  }
}

function writeCopilotConfig(config: CopilotConfig): boolean {
  const configPath = getCopilotConfigPath();
  try {
    // Backup first
    const backupPath = configPath + '.bak';
    if (existsSync(configPath)) {
      writeFileSync(backupPath, readFileSync(configPath));
    }
    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    return true;
  } catch {
    return false;
  }
}

/**
 * Check Copilot CLI config for issues with azure plugin entries
 */
function checkCopilotConfig(): ConfigCheckResult {
  const result = readCopilotConfig();
  
  // If there was a parse error, fail the check and surface the error
  if (result.error) {
    return { 
      passed: false, 
      stalePlugins: [], 
      misconfiguredPlugins: [], 
      error: result.error 
    };
  }
  
  // No config file or no config content - nothing to check
  if (!result.config) {
    return { passed: true, stalePlugins: [], misconfiguredPlugins: [] };
  }

  const plugins = result.config.installed_plugins ?? [];
  const stalePlugins: InstalledPlugin[] = [];
  const misconfiguredPlugins: InstalledPlugin[] = [];
  const expectedCachePath = getInstalledPluginPath();

  // Helper to safely convert unknown plugin entry to InstalledPlugin
  const toSafePlugin = (raw: unknown): InstalledPlugin | null => {
    if (!raw || typeof raw !== 'object') return null;
    const candidate = raw as Record<string, unknown>;
    
    // Validate required fields
    if (typeof candidate.name !== 'string' || candidate.name.trim() === '') return null;
    if (typeof candidate.cache_path !== 'string') return null;
    
    return {
      name: candidate.name,
      marketplace: typeof candidate.marketplace === 'string' ? candidate.marketplace : '',
      cache_path: candidate.cache_path,
      enabled: typeof candidate.enabled === 'boolean' ? candidate.enabled : false,
      version: typeof candidate.version === 'string' ? candidate.version : undefined,
      installed_at: typeof candidate.installed_at === 'string' ? candidate.installed_at : undefined,
    };
  };

  for (const rawPlugin of plugins) {
    const plugin = toSafePlugin(rawPlugin);
    
    // Skip malformed entries
    if (!plugin) continue;
    
    if (plugin.name !== 'azure') continue;

    // Check for stale plugins (cache_path doesn't exist)
    if (!existsSync(plugin.cache_path)) {
      stalePlugins.push(plugin);
      continue;
    }

    // Check for misconfigured marketplace plugins
    // The cache_path should point to the symlink root, not a subdirectory
    if (plugin.marketplace === 'github-copilot-for-azure') {
      const normalizedCache = plugin.cache_path.toLowerCase().replace(/\\/g, '/');
      const normalizedExpected = expectedCachePath.toLowerCase().replace(/\\/g, '/');
      
      // If cache_path points to a subdirectory (e.g., .../github-copilot-for-azure/azure)
      // instead of the root, it's misconfigured
      if (normalizedCache !== normalizedExpected && 
          normalizedCache.startsWith(normalizedExpected + '/')) {
        misconfiguredPlugins.push(plugin);
      }
    }
  }

  return {
    passed: stalePlugins.length === 0 && misconfiguredPlugins.length === 0,
    stalePlugins,
    misconfiguredPlugins,
  };
}

/**
 * Fix config issues by removing stale plugins and correcting cache paths
 */
function fixCopilotConfig(
  stalePlugins: InstalledPlugin[], 
  misconfiguredPlugins: InstalledPlugin[]
): boolean {
  const result = readCopilotConfig();
  if (!result.config || !result.config.installed_plugins) {
    return false;
  }

  const expectedCachePath = getInstalledPluginPath();
  const staleNames = new Set(stalePlugins.map(p => `${p.name}|${p.cache_path}`));
  
  // Helper to check if entry is a valid plugin object
  const isValidPlugin = (p: unknown): p is InstalledPlugin => {
    if (!p || typeof p !== 'object') return false;
    const candidate = p as Record<string, unknown>;
    return typeof candidate.name === 'string' && typeof candidate.cache_path === 'string';
  };

  // Filter out stale plugins and fix misconfigured ones, preserving malformed entries
  result.config.installed_plugins = (result.config.installed_plugins as unknown[])
    .map((p: unknown) => {
      // Skip malformed entries - leave them untouched
      if (!isValidPlugin(p)) return p;
      
      // Remove stale plugins
      if (staleNames.has(`${p.name}|${p.cache_path}`)) return null;
      
      // Fix misconfigured plugins
      const isMisconfigured = misconfiguredPlugins.some(
        mp => mp.name === p.name && mp.cache_path === p.cache_path
      );
      if (isMisconfigured) {
        return { ...p, cache_path: expectedCachePath };
      }
      return p;
    })
    .filter((p: unknown): p is InstalledPlugin => p !== null) as InstalledPlugin[];

  return writeCopilotConfig(result.config);
}

function generateMarkerContent(): string {
  return `# Verification Marker
# Generated: ${new Date().toISOString()}
# Random: ${Math.random().toString(36).substring(2, 15)}
# This file is used to verify symlink setup and should be auto-deleted.
`;
}

function getAllFiles(dir: string, baseDir: string = dir): string[] {
  const files: string[] = [];
  
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relativePath = relative(baseDir, fullPath);
      
      // Skip hidden files and node_modules
      if (entry.name.startsWith('.') || entry.name === 'node_modules') {
        continue;
      }
      
      if (entry.isDirectory()) {
        files.push(...getAllFiles(fullPath, baseDir));
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(relativePath);
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }
  
  return files;
}

function compareFiles(file1: string, file2: string): boolean {
  try {
    const content1 = readFileSync(file1, 'utf-8');
    const content2 = readFileSync(file2, 'utf-8');
    return content1 === content2;
  } catch {
    return false;
  }
}

function checkNestedInstall(localPath: string): { passed: boolean; error?: string } {
  const nestedPluginPath = join(localPath, 'azure');
  
  if (existsSync(nestedPluginPath)) {
    // Check if it has skills (confirming it's an installed plugin copy)
    const nestedSkillsPath = join(nestedPluginPath, 'skills');
    if (existsSync(nestedSkillsPath)) {
      return {
        passed: false,
        error: `Found nested plugin at ${nestedPluginPath}. This was likely created by "/plugin install". ` +
               `Remove it with: Remove-Item "${nestedPluginPath}" -Recurse -Force`
      };
    }
  }
  
  return { passed: true };
}

function runMarkerTest(localPath: string, installedPath: string): { passed: boolean; error?: string } {
  const markerFileName = '.copilot-verify-marker.md';
  const localMarker = join(localPath, markerFileName);
  const installedMarker = join(installedPath, markerFileName);
  const markerContent = generateMarkerContent();

  try {
    // Create marker in local
    writeFileSync(localMarker, markerContent, 'utf-8');

    // Check if it appears in installed
    if (!existsSync(installedMarker)) {
      unlinkSync(localMarker);
      return { passed: false, error: 'Marker file not visible in installed location' };
    }

    // Verify content matches
    const installedContent = readFileSync(installedMarker, 'utf-8');
    if (installedContent !== markerContent) {
      unlinkSync(localMarker);
      return { passed: false, error: 'Marker content mismatch between locations' };
    }

    // Clean up
    unlinkSync(localMarker);
    
    // Verify cleanup propagated
    if (existsSync(installedMarker)) {
      return { passed: false, error: 'Marker deletion did not propagate' };
    }

    return { passed: true };
  } catch (error) {
    // Ensure cleanup
    try { unlinkSync(localMarker); } catch { /* ignore */ }
    return { 
      passed: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

function runFileComparison(
  localPath: string, 
  installedPath: string, 
  verbose: boolean
): { matches: number; mismatches: string[]; missing: string[] } {
  const localFiles = getAllFiles(localPath);
  const matches: string[] = [];
  const mismatches: string[] = [];
  const missing: string[] = [];

  for (const file of localFiles) {
    const localFile = join(localPath, file);
    const installedFile = join(installedPath, file);

    if (!existsSync(installedFile)) {
      missing.push(file);
    } else if (compareFiles(localFile, installedFile)) {
      matches.push(file);
    } else {
      mismatches.push(file);
    }
  }

  if (verbose && matches.length > 0) {
    console.log('\n   ✅ Matching files:');
    for (const file of matches.slice(0, 5)) {
      console.log(`      ${file}`);
    }
    if (matches.length > 5) {
      console.log(`      ... and ${matches.length - 5} more`);
    }
  }

  return { matches: matches.length, mismatches, missing };
}

export function verify(rootDir: string, args: string[]): void {
  const options = parseArgs(args);
  const localPluginPath = join(rootDir, 'plugin');
  const installedPluginPath = getInstalledPluginPath();

  console.log('\n🔍 Verifying Local Plugin Setup\n');
  console.log('────────────────────────────────────────────────────────────');

  // Check paths exist
  console.log(`\n📁 Local plugin:`);
  console.log(`   ${localPluginPath}`);
  if (!existsSync(localPluginPath)) {
    console.log('   ❌ Not found\n');
    process.exitCode = 1;
    return;
  }
  console.log('   ✅ Exists');

  console.log(`\n📁 Installed plugin:`);
  console.log(`   ${installedPluginPath}`);
  if (!existsSync(installedPluginPath)) {
    console.log('   ❌ Not found\n');
    if (options.fix) {
      console.log('   🔧 Running setup with --fix...\n');
      setup(rootDir, ['--force']);
      return;
    }
    console.log('   Run "npm run local setup" or use --fix to create.\n');
    process.exitCode = 1;
    return;
  }
  console.log('   ✅ Exists');

  // Show resolved paths
  try {
    const resolvedLocal = realpathSync(localPluginPath);
    const resolvedInstalled = realpathSync(installedPluginPath);
    console.log(`\n📍 Resolved paths:`);
    console.log(`   Local:     ${resolvedLocal}`);
    console.log(`   Installed: ${resolvedInstalled}`);
    
    const normalizedLocal = resolvedLocal.toLowerCase().replace(/\\/g, '/');
    const normalizedInstalled = resolvedInstalled.toLowerCase().replace(/\\/g, '/');
    
    if (normalizedLocal === normalizedInstalled) {
      console.log('   ✅ Paths resolve to same location (symlink working)');
    } else {
      console.log('   ⚠️  Paths resolve to different locations');
    }
  } catch (error) {
    console.log(`\n   ⚠️  Could not resolve paths: ${error}`);
  }

  console.log('\n────────────────────────────────────────────────────────────');

  // Test 1: Check for nested plugin install
  console.log('\n🧪 Test 1: Nested Plugin Check');
  const nestedCheck = checkNestedInstall(localPluginPath);
  
  if (nestedCheck.passed) {
    console.log('   ✅ No nested plugin install detected');
  } else {
    console.log(`   ❌ ${nestedCheck.error}`);
  }

  // Test 2: Check Copilot CLI config
  console.log('\n🧪 Test 2: Copilot CLI Config Check');
  const configCheck = checkCopilotConfig();
  
  if (configCheck.passed) {
    console.log('   ✅ Plugin config is correct');
  } else {
    if (configCheck.error) {
      console.log(`   ❌ Failed to read config: ${configCheck.error}`);
    }
    if (configCheck.stalePlugins.length > 0) {
      console.log('   ⚠️  Stale plugin entries found (cache_path does not exist):');
      for (const p of configCheck.stalePlugins) {
        console.log(`      - ${p.name} (${p.marketplace || 'direct'}): ${p.cache_path}`);
      }
    }
    if (configCheck.misconfiguredPlugins.length > 0) {
      console.log('   ⚠️  Misconfigured plugin entries (wrong cache_path):');
      for (const p of configCheck.misconfiguredPlugins) {
        console.log(`      - ${p.name}: points to ${p.cache_path}`);
        console.log(`        should be: ${installedPluginPath}`);
      }
    }
  }

  // Test 3: Marker file test
  console.log('\n🧪 Test 3: Marker File Propagation');
  console.log('   Creating temporary marker file...');
  const markerResult = runMarkerTest(localPluginPath, installedPluginPath);
  
  if (markerResult.passed) {
    console.log('   ✅ Marker file created, visible, and cleaned up correctly');
  } else {
    console.log(`   ❌ Failed: ${markerResult.error}`);
  }

  // Test 4: File content comparison
  console.log('\n🧪 Test 4: File Content Comparison');
  const comparison = runFileComparison(localPluginPath, installedPluginPath, options.verbose);
  
  console.log(`   📊 Results:`);
  console.log(`      Matching files:    ${comparison.matches}`);
  console.log(`      Content mismatch:  ${comparison.mismatches.length}`);
  console.log(`      Missing files:     ${comparison.missing.length}`);

  if (comparison.mismatches.length > 0) {
    console.log('\n   ⚠️  Files with content differences:');
    for (const file of comparison.mismatches.slice(0, 5)) {
      console.log(`      ${file}`);
    }
    if (comparison.mismatches.length > 5) {
      console.log(`      ... and ${comparison.mismatches.length - 5} more`);
    }
  }

  if (comparison.missing.length > 0) {
    console.log('\n   ⚠️  Files missing from installed location:');
    for (const file of comparison.missing.slice(0, 5)) {
      console.log(`      ${file}`);
    }
    if (comparison.missing.length > 5) {
      console.log(`      ... and ${comparison.missing.length - 5} more`);
    }
  }

  console.log('\n────────────────────────────────────────────────────────────');

  // Summary
  const allPassed = nestedCheck.passed &&
                    configCheck.passed &&
                    markerResult.passed && 
                    comparison.mismatches.length === 0 && 
                    comparison.missing.length === 0;

  if (allPassed) {
    console.log('\n✅ VERIFICATION PASSED\n');
    console.log('   Local plugin is correctly linked to installed location.');
    console.log('   Changes to skills will be picked up by Copilot CLI.\n');
  } else {
    console.log('\n❌ VERIFICATION FAILED\n');
    
    if (!nestedCheck.passed) {
      console.log('   ⚠️  Nested plugin install detected (plugin/azure/).');
      console.log('      This shadows your local skills. Remove it to use local development.');
      if (options.fix) {
        const nestedPath = join(localPluginPath, 'azure');
        console.log(`\n   🔧 Removing nested plugin at ${nestedPath}...`);
        try {
          rmSync(nestedPath, { recursive: true });
          console.log('   ✅ Removed nested plugin');
        } catch (error) {
          console.log(`   ❌ Failed to remove: ${error instanceof Error ? error.message : error}`);
        }
      }
    }
    if (!configCheck.passed) {
      console.log('   ⚠️  Copilot CLI config has issues that prevent skills from loading.');
      if (options.fix) {
        console.log('\n   🔧 Fixing config...');
        if (fixCopilotConfig(configCheck.stalePlugins, configCheck.misconfiguredPlugins)) {
          console.log('   ✅ Config fixed');
          if (configCheck.stalePlugins.length > 0) {
            console.log(`      Removed ${configCheck.stalePlugins.length} stale plugin(s)`);
          }
          if (configCheck.misconfiguredPlugins.length > 0) {
            console.log(`      Fixed ${configCheck.misconfiguredPlugins.length} cache path(s)`);
          }
          console.log('   ℹ️  Restart Copilot CLI or run /skills reload to apply changes');
        } else {
          console.log('   ❌ Failed to fix config');
        }
      }
    }
    if (!markerResult.passed) {
      console.log('   The installed plugin is NOT properly linked to local repo.');
    }
    if (comparison.mismatches.length > 0 || comparison.missing.length > 0) {
      console.log('   File content does not match between locations.');
    }
    
    if (options.fix && (!nestedCheck.passed || !configCheck.passed)) {
      // Re-run verification after fixing issues
      console.log('\n   🔄 Re-running verification...\n');
      verify(rootDir, args.filter(a => a !== '--fix'));
      return;
    } else if (options.fix) {
      console.log('\n   🔧 Attempting to fix with setup --force...\n');
      setup(rootDir, ['--force']);
    } else {
      console.log('\n   Run "npm run local verify --fix" to attempt automatic fixes.');
      console.log('   Or manually remove plugin/azure/ and re-run setup.\n');
    }
    
    process.exitCode = 1;
  }
}
