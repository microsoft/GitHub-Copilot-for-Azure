/**
 * Suggest command - Token optimization suggestions
 */

import { readFileSync, readdirSync, existsSync, statSync, Dirent } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { 
  Suggestion, 
  FileAnalysis, 
  estimateTokens, 
  EXCLUDED_DIRS, 
  isMarkdownFile,
  TokenLimitsConfig,
  normalizePath,
  DEFAULT_SCAN_DIRS
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

function getLimitForFile(filePath: string, config: TokenLimitsConfig, rootDir: string): { limit: number; pattern: string } {
  const normalizedPath = normalizePath(relative(rootDir, filePath));
  
  for (const [overridePath, limit] of Object.entries(config.overrides)) {
    if (normalizedPath === overridePath || normalizedPath.endsWith('/' + overridePath)) {
      return { limit, pattern: overridePath };
    }
  }
  
  const sortedDefaults = Object.entries(config.defaults)
    .sort(([a], [b]) => b.length - a.length);
  
  for (const [pattern, limit] of sortedDefaults) {
    if (matchesPattern(normalizedPath, pattern)) {
      return { limit, pattern };
    }
  }
  
  return { limit: config.defaults['*.md'] ?? 2000, pattern: '*.md' };
}

const VERBOSE_PHRASES: Record<string, string> = {
  'in order to': 'to',
  'it is important to note that': 'note:',
  'due to the fact that': 'because',
  'in the event that': 'if',
  'for the purpose of': 'to/for',
  'has the ability to': 'can',
  'at the present time': 'now',
};

function findEmojis(lines: string[]): Suggestion[] {
  const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
  const suggestions: Suggestion[] = [];
  
  lines.forEach((line, index) => {
    const emojis = line.match(EMOJI_REGEX);
    if (emojis && emojis.length > 2) {
      suggestions.push({
        line: index + 1,
        issue: `Decorative emoji(s): ${emojis.join(' ')}`,
        suggestion: 'Remove decorative emojis (keep functional ones like ✅❌⚠️)',
        estimatedSavings: emojis.length * 2
      });
    }
  });
  
  return suggestions;
}

function findVerbosePhrases(content: string): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const lowerContent = content.toLowerCase();
  
  for (const [verbose, concise] of Object.entries(VERBOSE_PHRASES)) {
    let idx = 0;
    while ((idx = lowerContent.indexOf(verbose, idx)) !== -1) {
      const lineNum = content.substring(0, idx).split('\n').length;
      suggestions.push({
        line: lineNum,
        issue: `Verbose: "${verbose}"`,
        suggestion: `Use "${concise}"`,
        estimatedSavings: Math.ceil((verbose.length - concise.length) / 4)
      });
      idx += verbose.length;
    }
  }
  
  return suggestions;
}

function findLargeCodeBlocks(lines: string[]): Suggestion[] {
  const suggestions: Suggestion[] = [];
  let inBlock = false, blockStart = 0, blockLines = 0;
  
  lines.forEach((line, index) => {
    if (line.startsWith('```')) {
      if (!inBlock) {
        inBlock = true;
        blockStart = index + 1;
        blockLines = 0;
      } else {
        inBlock = false;
        if (blockLines > 10) {
          suggestions.push({
            line: blockStart,
            issue: `Large code block (${blockLines} lines)`,
            suggestion: 'Move to references/ or use shorter examples',
            estimatedSavings: Math.ceil(blockLines * 16)
          });
        }
      }
    } else if (inBlock) {
      blockLines++;
    }
  });
  
  return suggestions;
}

function findLargeTables(lines: string[]): Suggestion[] {
  const suggestions: Suggestion[] = [];
  let tableStart = -1, tableRows = 0;
  
  lines.forEach((line, index) => {
    const isTableRow = line.trim().startsWith('|') && line.trim().endsWith('|');
    const isSeparator = /^\|[\s\-:|]+\|$/.test(line.trim());
    
    if (isTableRow && !isSeparator) {
      if (tableStart === -1) { tableStart = index + 1; tableRows = 1; }
      else tableRows++;
    } else if (tableStart !== -1 && !isSeparator) {
      if (tableRows > 10) {
        suggestions.push({
          line: tableStart,
          issue: `Large table (${tableRows} rows)`,
          suggestion: 'Move to references/ directory',
          estimatedSavings: Math.ceil(tableRows * 12)
        });
      }
      tableStart = -1;
      tableRows = 0;
    }
  });
  
  return suggestions;
}

function analyzeFile(filePath: string, rootDir: string, config: TokenLimitsConfig): FileAnalysis & { limit: number; exceeded: boolean } {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const tokens = estimateTokens(content);
  const { limit } = getLimitForFile(filePath, config, rootDir);
  
  const suggestions: Suggestion[] = [
    ...findEmojis(lines),
    ...findVerbosePhrases(content),
    ...findLargeCodeBlocks(lines),
    ...findLargeTables(lines),
  ].sort((a, b) => a.line - b.line);
  
  return {
    file: filePath,
    tokens,
    characters: content.length,
    lines: lines.length,
    suggestions,
    potentialSavings: suggestions.reduce((sum, s) => sum + s.estimatedSavings, 0),
    limit,
    exceeded: tokens > limit
  };
}

function findMarkdownFiles(dir: string): string[] {
  const files: string[] = [];
  const entries: Dirent[] = readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.includes(entry.name as typeof EXCLUDED_DIRS[number])) {
        files.push(...findMarkdownFiles(fullPath));
      }
    } else if (isMarkdownFile(entry.name)) {
      files.push(fullPath);
    }
  }
  
  return files;
}

function printAnalysis(analysis: FileAnalysis & { limit: number; exceeded: boolean }, rootDir: string): void {
  const relativePath = relative(rootDir, analysis.file).replace(/\\/g, '/');
  const overBy = analysis.exceeded ? ` (over by ${analysis.tokens - analysis.limit})` : '';
  const status = analysis.exceeded ? '❌' : '✅';
  
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`${status} ${relativePath}`);
  console.log(`${'─'.repeat(60)}`);
  console.log(`   Tokens: ${analysis.tokens.toLocaleString()} / ${analysis.limit.toLocaleString()}${overBy} | Lines: ${analysis.lines}`);
  
  if (analysis.suggestions.length === 0) {
    if (analysis.exceeded) {
      console.log('\n   ⚠️  File exceeds limit but no automatic suggestions found');
      console.log('   💡 Consider moving detailed content to references/ directory');
    } else {
      console.log('\n   ✅ No optimization suggestions');
    }
  } else {
    const willFixExceeded = analysis.exceeded && analysis.potentialSavings >= (analysis.tokens - analysis.limit);
    const fixIndicator = willFixExceeded ? ' (will fix ✅)' : '';
    console.log(`\n   📋 ${analysis.suggestions.length} suggestions (~${analysis.potentialSavings} tokens)${fixIndicator}\n`);
    
    for (const s of analysis.suggestions) {
      console.log(`   Line ${s.line.toString().padStart(4)}: ${s.issue}`);
      console.log(`             → ${s.suggestion}`);
    }
  }
}

export function suggest(rootDir: string, args: string[]): void {
  const targetArg = args.filter(a => !a.startsWith('--'))[0];
  const config = loadConfig(rootDir);
  
  let files: string[];
  if (targetArg) {
    const targetPath = resolve(rootDir, targetArg);
    if (!existsSync(targetPath)) {
      console.error(`❌ Path not found: ${targetPath}`);
      process.exit(1);
    }
    files = statSync(targetPath).isDirectory() 
      ? findMarkdownFiles(targetPath) 
      : [targetPath];
  } else {
    // Default: scan only skill/agent directories
    files = [];
    for (const dir of DEFAULT_SCAN_DIRS) {
      const fullPath = join(rootDir, dir);
      try {
        files.push(...findMarkdownFiles(fullPath));
      } catch {
        // Skip if directory doesn't exist
      }
    }
  }
  
  if (files.length === 0) {
    console.log('No markdown files found.');
    return;
  }
  
  console.log(`\n🔍 Analyzing ${files.length} file(s)...\n`);
  
  const analyses = files.map(f => analyzeFile(f, rootDir, config));
  
  // Prioritize files that exceed their limits
  const exceeded = analyses.filter(a => a.exceeded);
  const withinLimit = analyses.filter(a => !a.exceeded && a.suggestions.length > 0);
  
  // For single file, show it regardless
  // For multiple files, show exceeded files first, then files with suggestions
  const toShow = files.length === 1 
    ? analyses 
    : [...exceeded, ...withinLimit];
  
  toShow.forEach(a => printAnalysis(a, rootDir));
  
  if (files.length > 1) {
    const totalSavings = analyses.reduce((sum, a) => sum + a.potentialSavings, 0);
    const filesWithSuggestions = analyses.filter(a => a.suggestions.length > 0).length;
    
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`📊 SUMMARY`);
    console.log(`   Files analyzed: ${analyses.length}`);
    console.log(`   Files exceeding limits: ${exceeded.length}${exceeded.length > 0 ? ' ⚠️' : ''}`);
    console.log(`   Files with suggestions: ${filesWithSuggestions}`);
    console.log(`   Total potential savings: ~${totalSavings} tokens`);
    
    if (exceeded.length > 0) {
      const fixableCount = exceeded.filter(a => 
        a.potentialSavings >= (a.tokens - a.limit)
      ).length;
      
      if (fixableCount > 0) {
        console.log(`\n   ✅ ${fixableCount} file(s) can be brought under limits with suggestions`);
      }
      
      const remainingExceeded = exceeded.length - fixableCount;
      if (remainingExceeded > 0) {
        console.log(`   ⚠️  ${remainingExceeded} file(s) need manual optimization or references/ refactoring`);
      }
    }
    
    console.log('═'.repeat(60) + '\n');
  }
}
