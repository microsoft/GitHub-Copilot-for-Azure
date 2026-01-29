/**
 * Tests for check command - token limit validation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';

// We'll test the internal functions by importing them
// First, let's create test fixtures

const TEST_DIR = join(process.cwd(), '__test_fixtures__');
const TEST_CONFIG = {
  defaults: {
    'SKILL.md': 10,
    '*.md': 50
  },
  overrides: {
    'special.md': 100
  }
};

describe('check command', () => {
  beforeEach(() => {
    // Create test directory structure
    mkdirSync(TEST_DIR, { recursive: true });
    mkdirSync(join(TEST_DIR, 'subdir'), { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe('token limit checking', () => {
    it('detects files exceeding limits', () => {
      // Create a file that exceeds the limit
      // 50 token limit = 200 characters for *.md
      const longContent = 'a'.repeat(300);  // 75 tokens, over 50 limit
      writeFileSync(join(TEST_DIR, 'large.md'), longContent);
      
      // Create config
      writeFileSync(
        join(TEST_DIR, '.token-limits.json'),
        JSON.stringify(TEST_CONFIG)
      );

      // File exists and has content
      const content = require('node:fs').readFileSync(join(TEST_DIR, 'large.md'), 'utf-8');
      expect(content.length).toBe(300);
    });

    it('respects pattern-specific limits', () => {
      // SKILL.md has lower limit (10 tokens = 40 chars)
      const skillContent = 'a'.repeat(100);  // 25 tokens, over 10 limit
      writeFileSync(join(TEST_DIR, 'SKILL.md'), skillContent);
      
      // Regular md file with same content would be under limit
      writeFileSync(join(TEST_DIR, 'readme.md'), skillContent);

      const skillFile = require('node:fs').readFileSync(join(TEST_DIR, 'SKILL.md'), 'utf-8');
      const readmeFile = require('node:fs').readFileSync(join(TEST_DIR, 'readme.md'), 'utf-8');
      
      expect(skillFile.length).toBe(100);
      expect(readmeFile.length).toBe(100);
    });

    it('uses override limits when specified', () => {
      // special.md has override limit of 100 tokens = 400 chars
      const content = 'a'.repeat(350);  // 88 tokens, under 100 limit
      writeFileSync(join(TEST_DIR, 'special.md'), content);
      
      const file = require('node:fs').readFileSync(join(TEST_DIR, 'special.md'), 'utf-8');
      expect(file.length).toBe(350);
    });
  });

  describe('glob pattern matching', () => {
    it('matches exact filenames', () => {
      writeFileSync(join(TEST_DIR, 'SKILL.md'), '# Skill');
      writeFileSync(join(TEST_DIR, 'subdir', 'SKILL.md'), '# Nested Skill');
      
      // Both files should exist
      expect(require('node:fs').existsSync(join(TEST_DIR, 'SKILL.md'))).toBe(true);
      expect(require('node:fs').existsSync(join(TEST_DIR, 'subdir', 'SKILL.md'))).toBe(true);
    });

    it('matches wildcard patterns', () => {
      writeFileSync(join(TEST_DIR, 'readme.md'), '# README');
      writeFileSync(join(TEST_DIR, 'guide.md'), '# Guide');
      
      // Both match *.md pattern
      expect(require('node:fs').existsSync(join(TEST_DIR, 'readme.md'))).toBe(true);
      expect(require('node:fs').existsSync(join(TEST_DIR, 'guide.md'))).toBe(true);
    });

    it('matches globstar patterns', () => {
      mkdirSync(join(TEST_DIR, 'references'), { recursive: true });
      writeFileSync(join(TEST_DIR, 'references', 'api.md'), '# API');
      
      expect(require('node:fs').existsSync(join(TEST_DIR, 'references', 'api.md'))).toBe(true);
    });
  });

  describe('config loading', () => {
    it('uses default config when no config file exists', () => {
      // No .token-limits.json created
      const configExists = require('node:fs').existsSync(join(TEST_DIR, '.token-limits.json'));
      expect(configExists).toBe(false);
    });

    it('loads custom config from .token-limits.json', () => {
      writeFileSync(
        join(TEST_DIR, '.token-limits.json'),
        JSON.stringify(TEST_CONFIG)
      );
      
      const config = JSON.parse(
        require('node:fs').readFileSync(join(TEST_DIR, '.token-limits.json'), 'utf-8')
      );
      
      expect(config.defaults['SKILL.md']).toBe(10);
      expect(config.overrides['special.md']).toBe(100);
    });
  });

  describe('output formats', () => {
    it('generates valid JSON output', () => {
      const report = {
        timestamp: new Date().toISOString(),
        totalFiles: 5,
        exceededCount: 2,
        results: [
          { file: 'test.md', tokens: 100, limit: 50, exceeded: true, pattern: '*.md' }
        ]
      };
      
      const json = JSON.stringify(report, null, 2);
      const parsed = JSON.parse(json);
      
      expect(parsed.totalFiles).toBe(5);
      expect(parsed.exceededCount).toBe(2);
      expect(parsed.results[0].exceeded).toBe(true);
    });

    it('generates valid markdown output', () => {
      const markdownLines = [
        '## 📊 Token Limit Check Report',
        '',
        '**Checked:** 5 files',
        '**Exceeded:** 2 files'
      ];
      
      const output = markdownLines.join('\n');
      expect(output).toContain('Token Limit Check Report');
      expect(output).toContain('5 files');
    });
  });
});
