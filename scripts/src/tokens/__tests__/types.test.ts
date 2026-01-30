/**
 * Tests for shared types and utility functions
 */

import { describe, it, expect } from 'vitest';
import { 
  estimateTokens, 
  isMarkdownFile, 
  normalizePath,
  getErrorMessage,
  globToRegex,
  matchesPattern,
  EXCLUDED_DIRS,
  MARKDOWN_EXTENSIONS,
  MAX_PATTERN_LENGTH
} from '../commands/types.js';

describe('estimateTokens', () => {
  it('estimates ~4 characters per token', () => {
    expect(estimateTokens('test')).toBe(1);      // 4 chars = 1 token
    expect(estimateTokens('testing1')).toBe(2);  // 8 chars = 2 tokens
    expect(estimateTokens('')).toBe(0);          // empty = 0 tokens
  });

  it('rounds up partial tokens', () => {
    expect(estimateTokens('hi')).toBe(1);        // 2 chars rounds to 1
    expect(estimateTokens('hello')).toBe(2);     // 5 chars rounds to 2
  });

  it('handles long content', () => {
    const content = 'a'.repeat(1000);
    expect(estimateTokens(content)).toBe(250);   // 1000/4 = 250
  });

  it('handles unicode characters', () => {
    const emoji = '🚀🔥💡';  // Each emoji is 2+ bytes
    const tokens = estimateTokens(emoji);
    expect(tokens).toBeGreaterThan(0);
  });

  it('handles multiline content', () => {
    const content = 'line1\nline2\nline3';
    expect(estimateTokens(content)).toBe(5);     // 17 chars = 5 tokens (rounded up)
  });
});

describe('isMarkdownFile', () => {
  it('returns true for .md files', () => {
    expect(isMarkdownFile('README.md')).toBe(true);
    expect(isMarkdownFile('path/to/file.md')).toBe(true);
    expect(isMarkdownFile('SKILL.md')).toBe(true);
  });

  it('returns true for .mdx files', () => {
    expect(isMarkdownFile('component.mdx')).toBe(true);
    expect(isMarkdownFile('path/to/doc.mdx')).toBe(true);
  });

  it('is case insensitive', () => {
    expect(isMarkdownFile('README.MD')).toBe(true);
    expect(isMarkdownFile('file.Md')).toBe(true);
    expect(isMarkdownFile('doc.MDX')).toBe(true);
  });

  it('returns false for non-markdown files', () => {
    expect(isMarkdownFile('script.ts')).toBe(false);
    expect(isMarkdownFile('package.json')).toBe(false);
    expect(isMarkdownFile('image.png')).toBe(false);
    expect(isMarkdownFile('readme.txt')).toBe(false);
  });

  it('returns false for files without extension', () => {
    expect(isMarkdownFile('Makefile')).toBe(false);
    expect(isMarkdownFile('LICENSE')).toBe(false);
  });

  it('handles edge cases', () => {
    expect(isMarkdownFile('.md')).toBe(false);   // Just extension - no filename
    expect(isMarkdownFile('file.md.bak')).toBe(false);  // Wrong ending
  });
});

describe('normalizePath', () => {
  it('converts backslashes to forward slashes', () => {
    expect(normalizePath('path\\to\\file.md')).toBe('path/to/file.md');
    expect(normalizePath('C:\\Users\\test')).toBe('C:/Users/test');
  });

  it('leaves forward slashes unchanged', () => {
    expect(normalizePath('path/to/file.md')).toBe('path/to/file.md');
  });

  it('handles mixed slashes', () => {
    expect(normalizePath('path\\to/mixed\\file.md')).toBe('path/to/mixed/file.md');
  });

  it('handles empty string', () => {
    expect(normalizePath('')).toBe('');
  });

  it('handles paths with no slashes', () => {
    expect(normalizePath('file.md')).toBe('file.md');
  });
});

describe('EXCLUDED_DIRS', () => {
  it('contains common directories to exclude', () => {
    expect(EXCLUDED_DIRS).toContain('node_modules');
    expect(EXCLUDED_DIRS).toContain('.git');
    expect(EXCLUDED_DIRS).toContain('dist');
    expect(EXCLUDED_DIRS).toContain('coverage');
  });

  it('is a readonly array', () => {
    expect(Array.isArray(EXCLUDED_DIRS)).toBe(true);
    expect(EXCLUDED_DIRS.length).toBe(4);
  });
});

describe('MARKDOWN_EXTENSIONS', () => {
  it('contains expected extensions', () => {
    expect(MARKDOWN_EXTENSIONS).toContain('.md');
    expect(MARKDOWN_EXTENSIONS).toContain('.mdx');
  });

  it('has correct length', () => {
    expect(MARKDOWN_EXTENSIONS.length).toBe(2);
  });
});

describe('getErrorMessage', () => {
  it('extracts message from Error instances', () => {
    const error = new Error('Test error message');
    expect(getErrorMessage(error)).toBe('Test error message');
  });

  it('handles Error with empty message', () => {
    const error = new Error('');
    expect(getErrorMessage(error)).toBe('');
  });

  it('converts string errors to strings', () => {
    expect(getErrorMessage('String error')).toBe('String error');
  });

  it('converts number errors to strings', () => {
    expect(getErrorMessage(404)).toBe('404');
  });

  it('converts null to string', () => {
    expect(getErrorMessage(null)).toBe('null');
  });

  it('converts undefined to string', () => {
    expect(getErrorMessage(undefined)).toBe('undefined');
  });

  it('converts object errors to strings', () => {
    expect(getErrorMessage({ code: 'ERR_UNKNOWN' })).toBe('[object Object]');
  });

  it('handles custom error classes', () => {
    class CustomError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'CustomError';
      }
    }
    const error = new CustomError('Custom error');
    expect(getErrorMessage(error)).toBe('Custom error');
  });
});

describe('globToRegex', () => {
  it('converts simple filename patterns', () => {
    const regex = globToRegex('SKILL.md');
    expect(regex.test('SKILL.md')).toBe(true);
    expect(regex.test('path/to/SKILL.md')).toBe(true);
    expect(regex.test('README.md')).toBe(false);
  });

  it('converts wildcard patterns', () => {
    const regex = globToRegex('*.md');
    expect(regex.test('README.md')).toBe(true);
    expect(regex.test('SKILL.md')).toBe(true);
    expect(regex.test('path/to/file.md')).toBe(true);
    expect(regex.test('file.txt')).toBe(false);
  });

  it('converts globstar patterns', () => {
    const regex = globToRegex('references/**/*.md');
    // Note: references/**/*.md requires at least one directory between references and file
    expect(regex.test('references/sub/file.md')).toBe(true);
    expect(regex.test('references/a/b/c/file.md')).toBe(true);
    expect(regex.test('other/file.md')).toBe(false);
  });

  it('escapes regex special characters', () => {
    const regex = globToRegex('file.name.md');
    expect(regex.test('file.name.md')).toBe(true);
    expect(regex.test('fileXnameXmd')).toBe(false);
  });

  it('rejects patterns exceeding max length', () => {
    const longPattern = 'a'.repeat(MAX_PATTERN_LENGTH + 1);
    expect(() => globToRegex(longPattern)).toThrow('Pattern too long');
  });

  it('accepts patterns at max length', () => {
    const maxPattern = 'a'.repeat(MAX_PATTERN_LENGTH);
    expect(() => globToRegex(maxPattern)).not.toThrow();
  });

  it('uses non-greedy matching to prevent catastrophic backtracking', () => {
    // This pattern could cause ReDoS with greedy matching
    const regex = globToRegex('**/*.md');
    const startTime = Date.now();
    regex.test('a/b/c/d/e/f/g/h/i/j/k/l/m/file.md');
    const elapsed = Date.now() - startTime;
    // Should complete quickly (< 100ms), not hang
    expect(elapsed).toBeLessThan(100);
  });
});

describe('matchesPattern', () => {
  it('matches simple filename patterns', () => {
    expect(matchesPattern('SKILL.md', 'SKILL.md')).toBe(true);
    expect(matchesPattern('path/to/SKILL.md', 'SKILL.md')).toBe(true);
    expect(matchesPattern('README.md', 'SKILL.md')).toBe(false);
  });

  it('matches wildcard patterns', () => {
    expect(matchesPattern('README.md', '*.md')).toBe(true);
    expect(matchesPattern('path/README.md', '*.md')).toBe(true);
    expect(matchesPattern('file.txt', '*.md')).toBe(false);
  });

  it('matches globstar patterns', () => {
    // Note: references/**/*.md requires at least one directory between references and file
    expect(matchesPattern('references/sub/file.md', 'references/**/*.md')).toBe(true);
    expect(matchesPattern('other/file.md', 'references/**/*.md')).toBe(false);
  });

  it('normalizes path separators', () => {
    expect(matchesPattern('path\\to\\SKILL.md', 'SKILL.md')).toBe(true);
    expect(matchesPattern('references\\sub\\file.md', 'references/**/*.md')).toBe(true);
  });

  it('handles paths without leading slash', () => {
    expect(matchesPattern('SKILL.md', 'SKILL.md')).toBe(true);
    expect(matchesPattern('plugin/skills/SKILL.md', 'SKILL.md')).toBe(true);
  });
});
