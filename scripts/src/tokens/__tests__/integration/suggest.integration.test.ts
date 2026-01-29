/**
 * Integration tests for suggest command - actual command execution
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { suggest } from '../../commands/suggest.js';

const TEST_DIR = join(process.cwd(), '__integration_suggest__');

describe('suggest command integration', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  
  beforeEach(() => {
    mkdirSync(join(TEST_DIR, '.github', 'skills'), { recursive: true });
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    consoleSpy.mockRestore();
  });

  it('analyzes files and provides suggestions', () => {
    writeFileSync(join(TEST_DIR, '.github', 'skills', 'test.md'), 'In order to test this file');
    
    suggest(TEST_DIR, []);
    
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Analyzing'));
  });

  it('detects verbose phrases', () => {
    const verboseContent = 'In order to complete this task, due to the fact that we need it.';
    writeFileSync(join(TEST_DIR, '.github', 'skills', 'verbose.md'), verboseContent);
    
    suggest(TEST_DIR, [join(TEST_DIR, '.github', 'skills', 'verbose.md')]);
    
    const output = consoleSpy.mock.calls.map(call => call[0]).join('');
    expect(output).toContain('Verbose');
  });

  it('detects excessive emojis', () => {
    const emojiContent = '🎉🎊🎈🎁 Welcome to our project! 🚀✨💫';
    writeFileSync(join(TEST_DIR, '.github', 'skills', 'emoji.md'), emojiContent);
    
    suggest(TEST_DIR, [join(TEST_DIR, '.github', 'skills', 'emoji.md')]);
    
    const output = consoleSpy.mock.calls.map(call => call[0]).join('');
    expect(output).toContain('emoji');
  });

  it('detects large code blocks', () => {
    const largeCodeBlock = '```javascript\n' + 'const x = 1;\n'.repeat(15) + '```';
    writeFileSync(join(TEST_DIR, '.github', 'skills', 'code.md'), largeCodeBlock);
    
    suggest(TEST_DIR, [join(TEST_DIR, '.github', 'skills', 'code.md')]);
    
    const output = consoleSpy.mock.calls.map(call => call[0]).join('');
    expect(output).toContain('code block');
  });

  it('prioritizes files exceeding limits', () => {
    // Create file under limit with suggestions
    writeFileSync(join(TEST_DIR, '.github', 'skills', 'good.md'), 'In order to be brief');
    // Create file over limit
    writeFileSync(join(TEST_DIR, '.github', 'skills', 'SKILL.md'), 'a'.repeat(2500)); // >500 limit
    
    suggest(TEST_DIR, []);
    
    const output = consoleSpy.mock.calls.map(call => call[0]).join('');
    expect(output).toContain('exceeding');
  });

  it('shows summary for multiple files', () => {
    writeFileSync(join(TEST_DIR, '.github', 'skills', 'file1.md'), 'In order to test');
    writeFileSync(join(TEST_DIR, '.github', 'skills', 'file2.md'), 'Due to the fact that');
    
    suggest(TEST_DIR, []);
    
    const output = consoleSpy.mock.calls.map(call => call[0]).join('');
    expect(output).toContain('SUMMARY');
    expect(output).toContain('Files analyzed');
  });

  it('handles no markdown files gracefully', () => {
    suggest(TEST_DIR, []);
    
    expect(consoleSpy).toHaveBeenCalledWith('No markdown files found.');
  });

  it('analyzes specific target directory', () => {
    const targetDir = join(TEST_DIR, 'custom');
    mkdirSync(targetDir, { recursive: true });
    writeFileSync(join(targetDir, 'test.md'), 'test content');
    
    suggest(TEST_DIR, [targetDir]);
    
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Analyzing'));
  });
});
