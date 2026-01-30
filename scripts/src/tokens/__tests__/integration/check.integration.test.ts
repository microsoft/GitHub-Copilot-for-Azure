/**
 * Integration tests for check command - actual command execution
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { check } from '../../commands/check.js';

const TEST_DIR = join(process.cwd(), '__integration_check__');

describe('check command integration', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  
  beforeEach(() => {
    // Clean and create test directory structure
    try {
      rmSync(TEST_DIR, { recursive: true, force: true });
    } catch {}
    mkdirSync(join(TEST_DIR, '.github', 'skills'), { recursive: true });
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    // Small delay to allow file handles to close on Windows
    await new Promise(resolve => setTimeout(resolve, 10));
    try {
      rmSync(TEST_DIR, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    } catch (err) {
      // Ignore cleanup errors in tests
    }
    consoleSpy.mockRestore();
  });

  it('validates files against token limits', () => {
    writeFileSync(join(TEST_DIR, '.github', 'skills', 'SKILL.md'), 'a'.repeat(100));
    
    check(TEST_DIR, []);
    
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Token Limit Check'));
  });

  it('detects files exceeding limits', () => {
    // Create file that exceeds 500 token SKILL.md limit
    writeFileSync(join(TEST_DIR, '.github', 'skills', 'SKILL.md'), 'a'.repeat(2500)); // 625 tokens > 500 limit
    
    check(TEST_DIR, []);
    
    const output = consoleSpy.mock.calls.map((call: any) => call[0]).join('');
    expect(output).toContain('exceeding');
  });

  it('outputs markdown format when --markdown flag is provided', () => {
    writeFileSync(join(TEST_DIR, '.github', 'skills', 'test.md'), 'test');
    
    check(TEST_DIR, ['--markdown']);
    
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('## 📊 Token Limit Check Report'));
  });

  it('outputs JSON when --json flag is provided', () => {
    writeFileSync(join(TEST_DIR, '.github', 'skills', 'test.md'), 'test');
    
    check(TEST_DIR, ['--json']);
    
    const output = consoleSpy.mock.calls.map((call: any) => call[0]).join('');
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it('checks specific files when provided as arguments', () => {
    const testFile = join(TEST_DIR, '.github', 'skills', 'specific.md');
    writeFileSync(testFile, 'specific content');
    
    check(TEST_DIR, [testFile]);
    
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('loads custom config from .token-limits.json', () => {
    const config = {
      defaults: { '*.md': 10 },
      overrides: {}
    };
    writeFileSync(join(TEST_DIR, '.token-limits.json'), JSON.stringify(config));
    writeFileSync(join(TEST_DIR, '.github', 'skills', 'test.md'), 'a'.repeat(100)); // Will exceed 10 token limit
    
    check(TEST_DIR, []);
    
    const output = consoleSpy.mock.calls.map((call: any) => call[0]).join('');
    expect(output).toContain('exceeding');
  });
});
