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
  isMarkdownFile 
} from './types.js';

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

function analyzeFile(filePath: string): FileAnalysis {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  const suggestions: Suggestion[] = [
    ...findEmojis(lines),
    ...findVerbosePhrases(content),
    ...findLargeCodeBlocks(lines),
    ...findLargeTables(lines),
  ].sort((a, b) => a.line - b.line);
  
  return {
    file: filePath,
    tokens: estimateTokens(content),
    characters: content.length,
    lines: lines.length,
    suggestions,
    potentialSavings: suggestions.reduce((sum, s) => sum + s.estimatedSavings, 0)
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

function printAnalysis(analysis: FileAnalysis, rootDir: string): void {
  const relativePath = relative(rootDir, analysis.file).replace(/\\/g, '/');
  
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📄 ${relativePath}`);
  console.log(`${'─'.repeat(60)}`);
  console.log(`   Tokens: ${analysis.tokens.toLocaleString()} | Lines: ${analysis.lines}`);
  
  if (analysis.suggestions.length === 0) {
    console.log('\n   ✅ No optimization suggestions');
  } else {
    console.log(`\n   📋 ${analysis.suggestions.length} suggestions (~${analysis.potentialSavings} tokens)\n`);
    
    for (const s of analysis.suggestions) {
      console.log(`   Line ${s.line.toString().padStart(4)}: ${s.issue}`);
      console.log(`             → ${s.suggestion}`);
    }
  }
}

export function suggest(rootDir: string, args: string[]): void {
  const targetArg = args.filter(a => !a.startsWith('--'))[0];
  
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
    files = findMarkdownFiles(rootDir);
  }
  
  if (files.length === 0) {
    console.log('No markdown files found.');
    return;
  }
  
  console.log(`\n🔍 Analyzing ${files.length} file(s)...\n`);
  
  const analyses = files.map(analyzeFile);
  const withSuggestions = analyses.filter(a => a.suggestions.length > 0);
  
  (files.length === 1 ? analyses : withSuggestions).forEach(a => printAnalysis(a, rootDir));
  
  if (files.length > 1) {
    const totalSavings = analyses.reduce((sum, a) => sum + a.potentialSavings, 0);
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`📊 SUMMARY: ${withSuggestions.length}/${analyses.length} files have suggestions (~${totalSavings} tokens)`);
    console.log('═'.repeat(60) + '\n');
  }
}
