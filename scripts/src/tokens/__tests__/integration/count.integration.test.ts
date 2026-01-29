/**
 * Integration tests for count command - actual command execution
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { count } from '../../commands/count.js';

const TEST_DIR = join(process.cwd(), '__integration_count__');

describe('count command integration', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  
  beforeEach(() => {
    // Create test directory structure
    mkdirSync(join(TEST_DIR, '.github', 'skills'), { recursive: true });
    mkdirSync(join(TEST_DIR, 'plugin', 'skills'), { recursive: true });
    
    // Spy on console.log to capture output
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    consoleSpy.mockRestore();
  });

  it('counts tokens in default directories', () => {
    // Create test files
    writeFileSync(join(TEST_DIR, '.github', 'skills', 'test.md'), 'a'.repeat(400)); // 100 tokens
    writeFileSync(join(TEST_DIR, 'plugin', 'skills', 'another.md'), 'b'.repeat(800)); // 200 tokens
    
    count(TEST_DIR, []);
    
    // Verify console output
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Token Count Summary'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Total Files'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Total Tokens'));
  });

  it('generates JSON output when --json flag is provided', () => {
    writeFileSync(join(TEST_DIR, '.github', 'skills', 'test.md'), 'test content');
    
    count(TEST_DIR, ['--json']);
    
    // Should output JSON
    const output = consoleSpy.mock.calls.map(call => call[0]).join('');
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it('writes to output file when --output is specified', () => {
    writeFileSync(join(TEST_DIR, '.github', 'skills', 'test.md'), 'test');
    const outputPath = join(TEST_DIR, 'output.json');
    
    count(TEST_DIR, ['--output', outputPath]);
    
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Token metadata written'));
  });

  it('rejects output paths outside repository', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    count(TEST_DIR, ['--output', '/etc/passwd']);
    
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('must be within the repository'));
    
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('handles empty directories gracefully', () => {
    count(TEST_DIR, []);
    
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Token Count Summary'));
  });
});
