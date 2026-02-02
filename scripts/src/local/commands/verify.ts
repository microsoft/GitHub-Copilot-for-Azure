/**
 * Verify Command
 * 
 * Verifies that local plugin files match the installed plugin by:
 * 1. Checking for nested plugin install (plugin/azure/ should not exist)
 * 2. Creating a temporary marker file in the local plugin
 * 3. Checking if it appears in the installed location
 * 4. Comparing content of key files between both locations
 * 5. Cleaning up the marker file
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

interface VerifyOptions {
  fix: boolean;
  verbose: boolean;
}

interface VerifyResult {
  success: boolean;
  nestedInstallCheck: boolean;
  markerTest: boolean;
  fileMatches: number;
  fileMismatches: number;
  missingFiles: string[];
  contentDiffs: string[];
}

function parseArgs(args: string[]): VerifyOptions {
  return {
    fix: args.includes('--fix'),
    verbose: args.includes('--verbose') || args.includes('-v'),
  };
}

function getInstalledPluginPath(): string {
  return join(homedir(), '.copilot', 'installed-plugins', 'github-copilot-for-azure');
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

  // Test 2: Marker file test
  console.log('\n🧪 Test 2: Marker File Propagation');
  console.log('   Creating temporary marker file...');
  const markerResult = runMarkerTest(localPluginPath, installedPluginPath);
  
  if (markerResult.passed) {
    console.log('   ✅ Marker file created, visible, and cleaned up correctly');
  } else {
    console.log(`   ❌ Failed: ${markerResult.error}`);
  }

  // Test 3: File content comparison
  console.log('\n🧪 Test 3: File Content Comparison');
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
    if (!markerResult.passed) {
      console.log('   The installed plugin is NOT properly linked to local repo.');
    }
    if (comparison.mismatches.length > 0 || comparison.missing.length > 0) {
      console.log('   File content does not match between locations.');
    }
    
    if (options.fix && !nestedCheck.passed) {
      // Re-run verification after fixing nested install
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
