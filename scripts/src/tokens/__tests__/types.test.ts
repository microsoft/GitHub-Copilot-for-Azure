/**
 * Tests for shared types and utility functions
 */

import { describe, it, expect } from 'vitest';
import { 
  estimateTokens, 
  isMarkdownFile, 
  normalizePath,
  EXCLUDED_DIRS,
  MARKDOWN_EXTENSIONS
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
    expect(isMarkdownFile('.md')).toBe(true);    // Just extension
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
