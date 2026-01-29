/**
 * Suggest command - Token optimization suggestions
 */

import { parseArgs } from 'node:util';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import type { 
  Suggestion, 
  FileAnalysis,
  TokenLimitsConfig
} from './types.js';
import { 
  estimateTokens,
  normalizePath,
  DEFAULT_SCAN_DIRS,
  MAX_DECORATIVE_EMOJIS,
  LARGE_CODE_BLOCK_LINES,
  LARGE_TABLE_ROWS,
  TOKENS_PER_EMOJI,
  TOKENS_PER_CODE_LINE,
  TOKENS_PER_TABLE_ROW,
  getErrorMessage
} from './types.js';
import { loadConfig, getLimitForFile, findMarkdownFiles } from './utils.js';

const VERBOSE_PHRASES: Record<string, string> = {
  'in order to': 'to',
  'it is important to note that': 'note:',
  'due to the fact that': 'because',
  'in the event that': 'if',
  'for the purpose of': 'to/for',
  'has the ability to': 'can',
  'at the present time': 'now',
};

/**
 * Finds excessive emoji usage in markdown lines.
 * Allows functional emojis like ✅❌⚠️ but flags decorative ones.
 * @param lines - Array of file lines
 * @returns Array of suggestions
 */
function findEmojis(lines: string[]): Suggestion[] {
  const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
  const suggestions: Suggestion[] = [];
  
  lines.forEach((line, index) => {
    const emojis = line.match(EMOJI_REGEX);
    if (emojis && emojis.length > MAX_DECORATIVE_EMOJIS) {
      suggestions.push({
        line: index + 1,
        issue: `Decorative emoji(s): ${emojis.join(' ')}`,
        suggestion: 'Remove decorative emojis (keep functional ones like ✅❌⚠️)',
        estimatedSavings: emojis.length * TOKENS_PER_EMOJI
      });
    }
  });
  
  return suggestions;
}

/**
 * Finds verbose phrases that can be made more concise.
 * @param content - File content
 * @returns Array of suggestions
 */
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
        if (blockLines > LARGE_CODE_BLOCK_LINES) {
          suggestions.push({
            line: blockStart,
            issue: `Large code block (${blockLines} lines)`,
            suggestion: 'Move to references/ or use shorter examples',
            estimatedSavings: Math.ceil(blockLines * TOKENS_PER_CODE_LINE)
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
      if (tableRows > LARGE_TABLE_ROWS) {
        suggestions.push({
          line: tableStart,
          issue: `Large table (${tableRows} rows)`,
          suggestion: 'Move to references/ directory',
          estimatedSavings: Math.ceil(tableRows * TOKENS_PER_TABLE_ROW)
        });
      }
      tableStart = -1;
      tableRows = 0;
    }
  });
  
  return suggestions;
}

function analyzeFile(filePath: string, rootDir: string, config: TokenLimitsConfig): FileAnalysis & { limit: number; exceeded: boolean } {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const tokens = estimateTokens(content);
    const relativePath = normalizePath(relative(rootDir, filePath));
    const { limit } = getLimitForFile(relativePath, config, rootDir);
    
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
  } catch (error) {
    throw new Error(`Failed to analyze ${filePath}: ${getErrorMessage(error)}`);
  }
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
  const { positionals } = parseArgs({
    args,
    options: {},
    strict: false,
    allowPositionals: true
  });

  const targetArg = positionals[0];
  const config = loadConfig(rootDir);
  
  let files: string[];
  if (targetArg) {
    const targetPath = resolve(rootDir, targetArg);
    if (!existsSync(targetPath)) {
      console.error(`❌ Path not found: ${targetPath}`);
      process.exitCode = 1;
      return;
    }
    try {
      files = statSync(targetPath).isDirectory() 
        ? findMarkdownFiles(targetPath) 
        : [targetPath];
    } catch (error) {
      console.error(`❌ Failed to access path ${targetPath}: ${getErrorMessage(error)}`);
      process.exitCode = 1;
      return;
    }
  } else {
    // Default: scan only skill/agent directories
    files = [];
    for (const dir of DEFAULT_SCAN_DIRS) {
      const fullPath = join(rootDir, dir);
      try {
        files.push(...findMarkdownFiles(fullPath));
      } catch (error) {
        if (process.env.DEBUG) {
          console.error(`Failed to scan ${dir}: ${getErrorMessage(error)}`);
        }
      }
    }
  }
  
  if (files.length === 0) {
    console.log('No markdown files found.');
    return;
  }
  
  console.log(`\n🔍 Analyzing ${files.length} file(s)...\n`);
  
  const analyses: (FileAnalysis & { limit: number; exceeded: boolean })[] = [];
  let errorCount = 0;
  
  for (const file of files) {
    try {
      analyses.push(analyzeFile(file, rootDir, config));
    } catch (error) {
      console.error(`⚠️  ${getErrorMessage(error)}`);
      errorCount++;
    }
  }
  
  if (errorCount > 0) {
    console.error(`⚠️  Failed to analyze ${errorCount} file(s)\n`);
  }
  
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
