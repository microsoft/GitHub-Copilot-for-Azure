/**
 * Count command - Token counting for markdown files
 */

import { readFileSync, readdirSync, writeFileSync, Dirent } from 'node:fs';
import { join, relative, resolve, extname, isAbsolute } from 'node:path';
import { 
  TokenMetadata, 
  TokenCount, 
  estimateTokens, 
  EXCLUDED_DIRS, 
  MARKDOWN_EXTENSIONS,
  DEFAULT_SCAN_DIRS
} from './types.js';

function findMarkdownFiles(dir: string, files: string[] = []): string[] {
  const entries: Dirent[] = readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.includes(entry.name as typeof EXCLUDED_DIRS[number])) {
        findMarkdownFiles(fullPath, files);
      }
    } else if (MARKDOWN_EXTENSIONS.includes(extname(entry.name).toLowerCase() as typeof MARKDOWN_EXTENSIONS[number])) {
      files.push(fullPath);
    }
  }
  
  return files;
}

function countFileTokens(filePath: string): TokenCount {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').length;
  
  return {
    tokens: estimateTokens(content),
    characters: content.length,
    lines,
    lastUpdated: new Date().toISOString()
  };
}

function generateMetadata(rootDir: string, scanDirs: string[]): TokenMetadata {
  const allFiles: string[] = [];
  for (const dir of scanDirs) {
    const fullPath = join(rootDir, dir);
    try {
      const files = findMarkdownFiles(fullPath);
      allFiles.push(...files);
    } catch {
      // Skip if directory doesn't exist
    }
  }
  
  const fileTokens: Record<string, TokenCount> = {};
  let totalTokens = 0;
  
  for (const file of allFiles) {
    const relativePath = relative(rootDir, file).replace(/\/\\/g, '/');
    const tokenCount = countFileTokens(file);
    fileTokens[relativePath] = tokenCount;
    totalTokens += tokenCount.tokens;
  }
  
  return {
    generatedAt: new Date().toISOString(),
    totalTokens,
    totalFiles: allFiles.length,
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

function isPathWithinRoot(targetPath: string, rootDir: string): boolean {
  const resolvedTarget = resolve(targetPath);
  const resolvedRoot = resolve(rootDir);
  return resolvedTarget.startsWith(resolvedRoot);
}

export function count(rootDir: string, args: string[]): void {
  const outputIndex = args.indexOf('--output');
  const hasOutputValue = outputIndex !== -1 && args[outputIndex + 1] && !args[outputIndex + 1].startsWith('--');
  const outputPath = hasOutputValue ? args[outputIndex + 1] : null;
  const jsonOnly = args.includes('--json');

  const metadata = generateMetadata(rootDir, [...DEFAULT_SCAN_DIRS]);
  
  if (outputPath) {
    const fullOutputPath = isAbsolute(outputPath) 
      ? outputPath 
      : join(rootDir, outputPath);
    
    if (!isPathWithinRoot(fullOutputPath, rootDir)) {
      console.error('❌ Error: Output path must be within the repository');
      process.exit(1);
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
