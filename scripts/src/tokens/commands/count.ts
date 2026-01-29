/**
 * Count command - Token counting for markdown files
 */

import { parseArgs } from 'node:util';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, isAbsolute } from 'node:path';
import type { 
  TokenMetadata, 
  TokenCount
} from './types.js';
import { 
  estimateTokens,
  DEFAULT_SCAN_DIRS,
  getErrorMessage
} from './types.js';
import { findMarkdownFiles } from './utils.js';

/**
 * Counts tokens, characters, and lines in a file.
 * @param filePath - Path to the file
 * @returns Token count information
 * @throws Error if file cannot be read
 */
function countFileTokens(filePath: string): TokenCount {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').length;
    
    return {
      tokens: estimateTokens(content),
      characters: content.length,
      lines,
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    throw new Error(`Failed to count tokens in ${filePath}: ${getErrorMessage(error)}`);
  }
}

function generateMetadata(rootDir: string, scanDirs: string[]): TokenMetadata {
  const allFiles: string[] = [];
  for (const dir of scanDirs) {
    const fullPath = join(rootDir, dir);
    try {
      const files = findMarkdownFiles(fullPath);
      allFiles.push(...files);
    } catch (error) {
      if (process.env.DEBUG) {
        console.error(`Failed to scan directory ${dir}: ${getErrorMessage(error)}`);
      }
    }
  }
  
  const fileTokens: Record<string, TokenCount> = {};
  let totalTokens = 0;
  let errorCount = 0;
  
  for (const file of allFiles) {
    try {
      const relativePath = relative(rootDir, file).replace(/[\\/]/g, '/');
      const tokenCount = countFileTokens(file);
      fileTokens[relativePath] = tokenCount;
      totalTokens += tokenCount.tokens;
    } catch (error) {
      console.error(`⚠️  ${getErrorMessage(error)}`);
      errorCount++;
    }
  }
  
  if (errorCount > 0) {
    console.error(`⚠️  Failed to process ${errorCount} file(s)`);
  }
  
  return {
    generatedAt: new Date().toISOString(),
    totalTokens,
    totalFiles: allFiles.length - errorCount,
    files: fileTokens
  };
}

function printSummary(metadata: TokenMetadata): void {
  console.log('\n📊 Token Count Summary');
  console.log('═'.repeat(60));
  console.log(`Total Files: ${metadata.totalFiles.toLocaleString()}`);
  console.log(`Total Tokens: ${metadata.totalTokens.toLocaleString()}`);
  console.log(`Generated: ${metadata.generatedAt}`);
  console.log('');
  
  const sorted = Object.entries(metadata.files)
    .sort(([, a], [, b]) => b.tokens - a.tokens);
  
  console.log('Top 10 Files by Token Count:');
  console.log('─'.repeat(60));
  
  for (const [file, count] of sorted.slice(0, 10)) {
    const tokens = count.tokens.toLocaleString().padStart(6);
    console.log(`  ${tokens} tokens │ ${file}`);
  }
  
  console.log('');
}

/**
 * Validates that a target path is within the repository root.
 * Prevents path traversal attacks.
 * @param targetPath - Path to validate
 * @param rootDir - Repository root directory
 * @returns True if path is within root
 */
function isPathWithinRoot(targetPath: string, rootDir: string): boolean {
  const resolvedTarget = resolve(targetPath);
  const resolvedRoot = resolve(rootDir);
  
  // Normalize paths to prevent traversal attacks
  const normalizedTarget = resolvedTarget.replace(/[\\/]+/g, '/').toLowerCase();
  const normalizedRoot = resolvedRoot.replace(/[\\/]+/g, '/').toLowerCase();
  
  // Ensure the target path starts with root and has proper separator
  return normalizedTarget.startsWith(normalizedRoot + '/') || normalizedTarget === normalizedRoot;
}

export function count(rootDir: string, args: string[]): void {
  const { values } = parseArgs({
    args,
    options: {
      output: { type: 'string' },
      json: { type: 'boolean', default: false }
    },
    strict: false,
    allowPositionals: true
  });

  const outputPath = values.output ?? null;
  const jsonOnly = values.json ?? false;

  const metadata = generateMetadata(rootDir, [...DEFAULT_SCAN_DIRS]);
  
  if (outputPath && typeof outputPath === 'string') {
    const fullOutputPath = isAbsolute(outputPath) 
      ? outputPath 
      : join(rootDir, outputPath);
    
    if (!isPathWithinRoot(fullOutputPath, rootDir)) {
      console.error(`❌ Error: Output path must be within the repository root`);
      console.error(`   Attempted path: ${fullOutputPath}`);
      console.error(`   Repository root: ${rootDir}`);
      process.exitCode = 1;
      return;
    }
    
    writeFileSync(fullOutputPath, JSON.stringify(metadata, null, 2));
    if (!jsonOnly) {
      console.log(`✅ Token metadata written to: ${fullOutputPath}`);
    }
  }
  
  if (jsonOnly) {
    console.log(JSON.stringify(metadata, null, 2));
  } else {
    printSummary(metadata);
  }
}
