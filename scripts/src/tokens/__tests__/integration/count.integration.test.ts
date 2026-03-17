/**
 * Integration tests for count command - actual command execution
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { join } from "node:path";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { count } from "../../commands/count.js";

const TEST_DIR = join(process.cwd(), "__integration_count__");

describe("count command integration", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Clean and create test directory structure
    try {
      rmSync(TEST_DIR, { recursive: true, force: true });
    } catch {
      // Ignore clean up errors in tests
    }
    mkdirSync(join(TEST_DIR, ".github", "skills"), { recursive: true });
    mkdirSync(join(TEST_DIR, "plugin", "skills"), { recursive: true });

    // Spy on console.log to capture output
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => { });
  });

  afterEach(async () => {
    // Small delay to allow file handles to close on Windows
    await new Promise(resolve => setTimeout(resolve, 10));
    try {
      rmSync(TEST_DIR, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    } catch {
      // Ignore cleanup errors in tests
    }
    consoleSpy.mockRestore();
  });

  it("counts tokens in default directories", () => {
    // Create test files
    writeFileSync(join(TEST_DIR, ".github", "skills", "test.md"), "a".repeat(400)); // 100 tokens
    writeFileSync(join(TEST_DIR, "plugin", "skills", "another.md"), "b".repeat(800)); // 200 tokens

    count(TEST_DIR, []);

    // Verify console output
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Token Count Summary"));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Total Files"));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Total Tokens"));
  });

  it("generates JSON output when --json flag is provided", () => {
    writeFileSync(join(TEST_DIR, ".github", "skills", "test.md"), "test content");

    count(TEST_DIR, ["--json"]);

    // Should output JSON
    const output = consoleSpy.mock.calls.map((call: any) => call[0]).join("");
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it("writes to output file when --output is specified", () => {
    writeFileSync(join(TEST_DIR, ".github", "skills", "test.md"), "test");
    const outputPath = join(TEST_DIR, "output.json");

    count(TEST_DIR, ["--output", outputPath]);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Token metadata written"));
  });

  it("rejects output paths outside repository", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => { });
    const originalExitCode = process.exitCode;

    count(TEST_DIR, ["--output", "/etc/passwd"]);

    expect(process.exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("must be within the repository"));

    process.exitCode = originalExitCode;
    errorSpy.mockRestore();
  });

  it("handles empty directories gracefully", () => {
    count(TEST_DIR, []);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Token Count Summary"));
  });
});
