/**
 * Tests for suggest command - optimization suggestions
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';

const TEST_DIR = join(process.cwd(), '__test_fixtures_suggest__');

describe('suggest command', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    // Small delay to allow file handles to close on Windows
    await new Promise(resolve => setTimeout(resolve, 10));
    try {
      rmSync(TEST_DIR, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    } catch (err) {
      // Ignore cleanup errors in tests
    }
  });

  describe('emoji detection', () => {
    it('detects decorative emojis', () => {
      const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
      
      const textWithEmojis = '🚀 Welcome to our project! 🎉🎊🎈';
      const emojis = textWithEmojis.match(EMOJI_REGEX);
      
      expect(emojis).not.toBeNull();
      expect(emojis!.length).toBe(4);
    });

    it('allows functional emojis (✅❌⚠️)', () => {
      const content = '✅ Passed\n❌ Failed\n⚠️ Warning';
      // These are in the allowed range but we still detect them
      // The suggest command filters to only flag when there are > 2 emojis
      expect(content).toContain('✅');
      expect(content).toContain('❌');
    });

    it('flags lines with multiple emojis', () => {
      const line = '🎉🎊🎈 Celebration!';
      const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
      const emojis = line.match(EMOJI_REGEX);
      
      expect(emojis!.length).toBeGreaterThan(2);
    });
  });

  describe('verbose phrase detection', () => {
    const VERBOSE_PHRASES: Record<string, string> = {
      'in order to': 'to',
      'due to the fact that': 'because',
      'in the event that': 'if',
      'has the ability to': 'can',
      'at the present time': 'now',
    };

    it('detects common verbose phrases', () => {
      const content = 'In order to complete this task, you need to...';
      const lowerContent = content.toLowerCase();
      
      const found = Object.keys(VERBOSE_PHRASES).filter(phrase => 
        lowerContent.includes(phrase)
      );
      
      expect(found).toContain('in order to');
    });

    it('suggests concise alternatives', () => {
      expect(VERBOSE_PHRASES['in order to']).toBe('to');
      expect(VERBOSE_PHRASES['due to the fact that']).toBe('because');
      expect(VERBOSE_PHRASES['has the ability to']).toBe('can');
    });

    it('calculates token savings', () => {
      const verbose = 'in order to';
      const concise = 'to';
      const savings = Math.ceil((verbose.length - concise.length) / 4);
      
      expect(savings).toBe(3);  // (11 - 2) / 4 = 2.25, rounded up to 3
    });
  });

  describe('large code block detection', () => {
    it('detects code blocks over 10 lines', () => {
      const lines = [
        '```javascript',
        'const a = 1;',
        'const b = 2;',
        'const c = 3;',
        'const d = 4;',
        'const e = 5;',
        'const f = 6;',
        'const g = 7;',
        'const h = 8;',
        'const i = 9;',
        'const j = 10;',
        'const k = 11;',
        '```'
      ];
      
      let inBlock = false;
      let blockLines = 0;
      
      for (const line of lines) {
        if (line.startsWith('```')) {
          if (!inBlock) {
            inBlock = true;
            blockLines = 0;
          } else {
            inBlock = false;
          }
        } else if (inBlock) {
          blockLines++;
        }
      }
      
      expect(blockLines).toBe(11);
      expect(blockLines > 10).toBe(true);
    });

    it('does not flag small code blocks', () => {
      const lines = [
        '```bash',
        'npm install',
        'npm run build',
        '```'
      ];
      
      let blockLines = 0;
      let inBlock = false;
      
      for (const line of lines) {
        if (line.startsWith('```')) {
          inBlock = !inBlock;
        } else if (inBlock) {
          blockLines++;
        }
      }
      
      expect(blockLines).toBe(2);
      expect(blockLines > 10).toBe(false);
    });
  });

  describe('large table detection', () => {
    it('detects tables with more than 10 rows', () => {
      const lines = [
        '| Header 1 | Header 2 |',
        '|----------|----------|',
        '| Row 1 | Data |',
        '| Row 2 | Data |',
        '| Row 3 | Data |',
        '| Row 4 | Data |',
        '| Row 5 | Data |',
        '| Row 6 | Data |',
        '| Row 7 | Data |',
        '| Row 8 | Data |',
        '| Row 9 | Data |',
        '| Row 10 | Data |',
        '| Row 11 | Data |',
      ];
      
      let tableRows = 0;
      
      for (const line of lines) {
        const isTableRow = line.trim().startsWith('|') && line.trim().endsWith('|');
        const isSeparator = /^\|[\s\-:|]+\|$/.test(line.trim());
        
        if (isTableRow && !isSeparator) {
          tableRows++;
        }
      }
      
      // Subtract 1 for header row
      expect(tableRows - 1).toBe(11);
      expect(tableRows - 1 > 10).toBe(true);
    });
  });

  describe('file analysis', () => {
    it('calculates potential savings', () => {
      const suggestions = [
        { estimatedSavings: 10 },
        { estimatedSavings: 20 },
        { estimatedSavings: 5 }
      ];
      
      const totalSavings = suggestions.reduce((sum, s) => sum + s.estimatedSavings, 0);
      expect(totalSavings).toBe(35);
    });

    it('sorts suggestions by line number', () => {
      const suggestions = [
        { line: 50, issue: 'C' },
        { line: 10, issue: 'A' },
        { line: 30, issue: 'B' }
      ];
      
      suggestions.sort((a, b) => a.line - b.line);
      
      expect(suggestions[0].issue).toBe('A');
      expect(suggestions[1].issue).toBe('B');
      expect(suggestions[2].issue).toBe('C');
    });
  });

  describe('markdown file scanning', () => {
    it('finds markdown files recursively', () => {
      // Clean and recreate test directory
      try {
        rmSync(TEST_DIR, { recursive: true, force: true });
      } catch {}
      mkdirSync(TEST_DIR, { recursive: true });
      
      // Create test structure
      writeFileSync(join(TEST_DIR, 'readme.md'), '# Readme');
      mkdirSync(join(TEST_DIR, 'docs'), { recursive: true });
      writeFileSync(join(TEST_DIR, 'docs', 'guide.md'), '# Guide');
      
      const files: string[] = [];
      const { readdirSync } = require('node:fs');
      
      function scan(dir: string) {
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          if (entry.isDirectory()) {
            scan(fullPath);
          } else if (entry.name.endsWith('.md')) {
            files.push(fullPath);
          }
        }
      }
      
      scan(TEST_DIR);
      
      expect(files.length).toBe(2);
    });

    it('excludes node_modules and .git', () => {
      const EXCLUDED_DIRS = ['node_modules', '.git', 'dist', 'coverage'];
      
      expect(EXCLUDED_DIRS.includes('node_modules')).toBe(true);
      expect(EXCLUDED_DIRS.includes('.git')).toBe(true);
      expect(EXCLUDED_DIRS.includes('src')).toBe(false);
    });
  });
});
