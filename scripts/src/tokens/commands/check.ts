/**
 * Check command - Token limit validation
 */

import { readFileSync, readdirSync, existsSync, Dirent } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { 
  TokenLimitsConfig, 
  ValidationResult, 
  ValidationReport, 
  estimateTokens,
  EXCLUDED_DIRS,
  normalizePath,
  isMarkdownFile
} from './types.js';

const DEFAULT_LIMITS: TokenLimitsConfig = {
  defaults: {
    'SKILL.md': 500,
    'references/**/*.md': 1000,
    'docs/**/*.md': 1500,
    '*.md': 2000
  },
  overrides: {
    'README.md': 3000,
    'CONTRIBUTING.md': 2500,
    'plugin/README.md': 3000
  }
};

function loadConfig(rootDir: string): TokenLimitsConfig {
  const configPath = join(rootDir, '.token-limits.json');
  
  if (existsSync(configPath)) {
    try {
      const content = readFileSync(configPath, 'utf-8');
      return JSON.parse(content) as TokenLimitsConfig;
    } catch (error) {
      console.error(`⚠️  Warning: Invalid .token-limits.json, using defaults`);
      return DEFAULT_LIMITS;
    }
  }
  
  return DEFAULT_LIMITS;
}

function globToRegex(pattern: string): RegExp {
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/{{GLOBSTAR}}/g, '.*')
    .replace(/\//g, '\\/');
  
  return new RegExp(`(^|\\/)${regexPattern}$`);
}

function matchesPattern(filePath: string, pattern: string): boolean {
  const normalizedPath = normalizePath(filePath);
  
  if (!pattern.includes('/') && !pattern.includes('*')) {
    return normalizedPath.endsWith('/' + pattern) || normalizedPath === pattern;
  }
  
  return globToRegex(pattern).test(normalizedPath);
}

function getLimitForFile(filePath: string, config: TokenLimitsConfig): { limit: number; pattern: string } {
  const normalizedPath = normalizePath(filePath);
  
  for (const [overridePath, limit] of Object.entries(config.overrides)) {
    if (normalizedPath === overridePath || normalizedPath.endsWith('/' + overridePath)) {
      return { limit, pattern: overridePath };
    }
  }
  
  const sortedDefaults = Object.entries(config.defaults)
    .sort(([a], [b]) => b.length - a.length);
  
  for (const [pattern, limit] of sortedDefaults) {
    if (matchesPattern(filePath, pattern)) {
      return { limit, pattern };
    }
  }
  
  return { limit: config.defaults['*.md'] ?? 2000, pattern: '*.md' };
}

function findMarkdownFiles(dir: string, files: string[] = []): string[] {
  const entries: Dirent[] = readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.includes(entry.name as typeof EXCLUDED_DIRS[number])) {
        findMarkdownFiles(fullPath, files);
      }
    } else if (isMarkdownFile(entry.name)) {
      files.push(fullPath);
    }
  }
  
  return files;
}

function validateFiles(rootDir: string, filesToCheck?: string[]): ValidationReport {
  const config = loadConfig(rootDir);
  const files = filesToCheck ?? findMarkdownFiles(rootDir);
  const results: ValidationResult[] = [];
  const skipped: string[] = [];
  
  for (const file of files) {
    if (!existsSync(file)) {
      skipped.push(file);
      continue;
    }
    
    const relativePath = normalizePath(relative(rootDir, file));
    const content = readFileSync(file, 'utf-8');
    const tokens = estimateTokens(content);
    const { limit, pattern } = getLimitForFile(relativePath, config);
    
    results.push({
      file: relativePath,
      tokens,
      limit,
      exceeded: tokens > limit,
      pattern
    });
  }
  
  if (skipped.length > 0) {
    console.error(`⚠️  Skipped ${skipped.length} non-existent file(s)`);
  }
  
  return {
    timestamp: new Date().toISOString(),
    totalFiles: results.length,
    exceededCount: results.filter(r => r.exceeded).length,
    results
  };
}

function formatMarkdownReport(report: ValidationReport): string {
  const lines: string[] = [
    '## 📊 Token Limit Check Report\n',
    `**Checked:** ${report.totalFiles} files`,
    `**Exceeded:** ${report.exceededCount} files\n`
  ];
  
  if (report.exceededCount > 0) {
    lines.push(
      '### ⚠️ Files Exceeding Token Limits\n',
      '| File | Tokens | Limit | Over By |',
      '|------|--------|-------|---------|'
    );
    
    for (const result of report.results.filter(r => r.exceeded)) {
      const overBy = result.tokens - result.limit;
      lines.push(`| \`${result.file}\` | ${result.tokens} | ${result.limit} | +${overBy} |`);
    }
    
    lines.push('\n> Consider moving content to `references/` subdirectories.');
  } else {
    lines.push('### ✅ All files within token limits');
  }
  
  return lines.join('\n');
}

function printConsoleReport(report: ValidationReport): void {
  console.log('\n📊 Token Limit Check');
  console.log('═'.repeat(60));
  console.log(`Files Checked: ${report.totalFiles}`);
  console.log(`Files Exceeded: ${report.exceededCount}`);
  console.log('');
  
  if (report.exceededCount > 0) {
    console.log('⚠️  Files exceeding limits:');
    console.log('─'.repeat(60));
    
    for (const result of report.results.filter(r => r.exceeded)) {
      const overBy = result.tokens - result.limit;
      console.log(`  ❌ ${result.file}`);
      console.log(`     ${result.tokens} tokens (limit: ${result.limit}, over by ${overBy})`);
    }
    
    console.log('\n💡 Tip: Move detailed content to references/ subdirectories');
  } else {
    console.log('✅ All files within token limits!');
  }
  
  console.log('');
}

export function check(rootDir: string, args: string[]): void {
  const markdownOutput = args.includes('--markdown');
  const jsonOutput = args.includes('--json');
  const filesArg = args.filter(a => !a.startsWith('--'));
  
  const filesToCheck = filesArg.length > 0 
    ? filesArg.map(f => resolve(rootDir, f))
    : undefined;
  
  const report = validateFiles(rootDir, filesToCheck);
  
  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
  } else if (markdownOutput) {
    console.log(formatMarkdownReport(report));
  } else {
    printConsoleReport(report);
  }
}
