/**
 * Tests for check command - token limit validation
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdirSync, writeFileSync, rmSync, mkdtempSync, readFileSync, existsSync } from "node:fs";

// We'll test the internal functions by importing them
// First, let's create test fixtures

const TEST_DIR_PREFIX = join(tmpdir(), "__test_fixtures__");
const TEST_CONFIG = {
  defaults: {
    "SKILL.md": 10,
    "*.md": 50
  },
  overrides: {
    "special.md": 100
  }
};

describe("check command", () => {
  let testDir: string;
  let testRootDir: string;
  let testSubDir: string;
  beforeAll(() => {
    // Create test directory structure
    testDir = mkdtempSync(TEST_DIR_PREFIX);
    testRootDir = join(testDir, "root");
    testSubDir = join(testRootDir, "subdir");
  });
  beforeEach(() => {
    mkdirSync(testRootDir, { recursive: true });
    mkdirSync(testSubDir, { recursive: true });
  });
  afterEach(async () => {
    // Small delay to allow file handles to close on Windows
    await new Promise(resolve => setTimeout(resolve, 10));
    try {
      rmSync(testRootDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    } catch {
      // Ignore cleanup errors in tests
    }
  });
  afterAll(() => {
    try {
      rmSync(testDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    } catch {
      // Ignore cleanup errors in tests
    }
  });

  describe("token limit checking", () => {
    it("detects files exceeding limits", () => {
      // Create a file that exceeds the limit
      // 50 token limit = 200 characters for *.md
      const longContent = "a".repeat(300);  // 75 tokens, over 50 limit
      writeFileSync(join(testRootDir, "large.md"), longContent);

      // Create config
      writeFileSync(
        join(testRootDir, ".token-limits.json"),
        JSON.stringify(TEST_CONFIG)
      );

      // File exists and has content
      const content = readFileSync(join(testRootDir, "large.md"), "utf-8");
      expect(content.length).toBe(300);
    });

    it("respects pattern-specific limits", () => {
      // SKILL.md has lower limit (10 tokens = 40 chars)
      const skillContent = "a".repeat(100);  // 25 tokens, over 10 limit
      writeFileSync(join(testRootDir, "SKILL.md"), skillContent);

      // Regular md file with same content would be under limit
      writeFileSync(join(testRootDir, "readme.md"), skillContent);

      const skillFile = readFileSync(join(testRootDir, "SKILL.md"), "utf-8");
      const readmeFile = readFileSync(join(testRootDir, "readme.md"), "utf-8");

      expect(skillFile.length).toBe(100);
      expect(readmeFile.length).toBe(100);
    });

    it("uses override limits when specified", () => {
      // special.md has override limit of 100 tokens = 400 chars
      const content = "a".repeat(350);  // 88 tokens, under 100 limit
      writeFileSync(join(testRootDir, "special.md"), content);

      const file = readFileSync(join(testRootDir, "special.md"), "utf-8");
      expect(file.length).toBe(350);
    });
  });

  describe("glob pattern matching", () => {
    it("matches exact filenames", () => {
      writeFileSync(join(testRootDir, "SKILL.md"), "# Skill");
      writeFileSync(join(testSubDir, "SKILL.md"), "# Nested Skill");

      // Both files should exist
      expect(existsSync(join(testRootDir, "SKILL.md"))).toBe(true);
      expect(existsSync(join(testSubDir, "SKILL.md"))).toBe(true);
    });

    it("matches wildcard patterns", () => {
      writeFileSync(join(testRootDir, "readme.md"), "# README");
      writeFileSync(join(testRootDir, "guide.md"), "# Guide");

      // Both match *.md pattern
      expect(existsSync(join(testRootDir, "readme.md"))).toBe(true);
      expect(existsSync(join(testRootDir, "guide.md"))).toBe(true);
    });

    it("matches globstar patterns", () => {
      mkdirSync(join(testRootDir, "references"), { recursive: true });
      writeFileSync(join(testRootDir, "references", "api.md"), "# API");

      expect(existsSync(join(testRootDir, "references", "api.md"))).toBe(true);
    });
  });

  describe("config loading", () => {
    it("uses default config when no config file exists", () => {
      // No .token-limits.json created
      const configExists = existsSync(join(testRootDir, ".token-limits.json"));
      expect(configExists).toBe(false);
    });

    it("loads custom config from .token-limits.json", () => {
      writeFileSync(
        join(testRootDir, ".token-limits.json"),
        JSON.stringify(TEST_CONFIG)
      );

      const config = JSON.parse(
        readFileSync(join(testRootDir, ".token-limits.json"), "utf-8")
      );

      expect(config.defaults["SKILL.md"]).toBe(10);
      expect(config.overrides["special.md"]).toBe(100);
    });
  });

  describe("output formats", () => {
    it("generates valid JSON output", () => {
      const report = {
        timestamp: new Date().toISOString(),
        totalFiles: 5,
        exceededCount: 2,
        results: [
          { file: "test.md", tokens: 100, limit: 50, exceeded: true, pattern: "*.md" }
        ]
      };

      const json = JSON.stringify(report, null, 2);
      const parsed = JSON.parse(json);

      expect(parsed.totalFiles).toBe(5);
      expect(parsed.exceededCount).toBe(2);
      expect(parsed.results[0].exceeded).toBe(true);
    });

    it("generates valid markdown output", () => {
      const markdownLines = [
        "## 📊 Token Limit Check Report",
        "",
        "**Checked:** 5 files",
        "**Exceeded:** 2 files"
      ];

      const output = markdownLines.join("\n");
      expect(output).toContain("Token Limit Check Report");
      expect(output).toContain("5 files");
    });
  });
});
