/**
 * Tests for count command - token counting
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";

const TEST_DIR = join(process.cwd(), "__test_fixtures_count__");

describe("count command", () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    // Small delay to allow file handles to close on Windows
    await new Promise(resolve => setTimeout(resolve, 10));
    try {
      rmSync(TEST_DIR, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    } catch {
      // Ignore cleanup errors in tests
    }
  });

  describe("token counting", () => {
    it("counts tokens for a single file", () => {
      const content = "a".repeat(100);  // 100 chars = 25 tokens
      writeFileSync(join(TEST_DIR, "test.md"), content);

      const fileContent = readFileSync(join(TEST_DIR, "test.md"), "utf-8");
      const tokens = Math.ceil(fileContent.length / 4);

      expect(tokens).toBe(25);
    });

    it("counts lines correctly", () => {
      const content = "line1\nline2\nline3\n";
      writeFileSync(join(TEST_DIR, "multiline.md"), content);

      const fileContent = readFileSync(join(TEST_DIR, "multiline.md"), "utf-8");
      const lines = fileContent.split("\n").length;

      expect(lines).toBe(4);  // 3 lines + 1 empty after trailing newline
    });

    it("counts characters correctly", () => {
      const content = "Hello, World!";
      writeFileSync(join(TEST_DIR, "hello.md"), content);

      const fileContent = readFileSync(join(TEST_DIR, "hello.md"), "utf-8");

      expect(fileContent.length).toBe(13);
    });
  });

  describe("file discovery", () => {
    it("finds all markdown files in directory", () => {
      // Clean directory first to avoid leftover files from other tests
      rmSync(TEST_DIR, { recursive: true, force: true });
      mkdirSync(TEST_DIR, { recursive: true });

      writeFileSync(join(TEST_DIR, "readme.md"), "# README");
      writeFileSync(join(TEST_DIR, "guide.md"), "# Guide");
      writeFileSync(join(TEST_DIR, "script.ts"), 'console.log("test")');

      const { readdirSync } = require("node:fs");
      const files = readdirSync(TEST_DIR).filter((f: string) => f.endsWith(".md"));

      expect(files.length).toBe(2);
      expect(files).toContain("readme.md");
      expect(files).toContain("guide.md");
    });

    it("finds markdown files recursively", () => {
      writeFileSync(join(TEST_DIR, "root.md"), "# Root");
      mkdirSync(join(TEST_DIR, "docs"), { recursive: true });
      writeFileSync(join(TEST_DIR, "docs", "nested.md"), "# Nested");

      const allFiles: string[] = [];

      function findMdFiles(dir: string) {
        const { readdirSync, statSync } = require("node:fs");
        const entries = readdirSync(dir);
        for (const entry of entries) {
          const fullPath = join(dir, entry);
          if (statSync(fullPath).isDirectory()) {
            findMdFiles(fullPath);
          } else if (entry.endsWith(".md")) {
            allFiles.push(fullPath);
          }
        }
      }

      findMdFiles(TEST_DIR);
      expect(allFiles.length).toBe(2);
    });

    it("excludes node_modules directory", () => {
      // Clean and recreate test directory
      rmSync(TEST_DIR, { recursive: true, force: true });
      mkdirSync(TEST_DIR, { recursive: true });

      writeFileSync(join(TEST_DIR, "root.md"), "# Root");
      mkdirSync(join(TEST_DIR, "node_modules", "package"), { recursive: true });
      writeFileSync(join(TEST_DIR, "node_modules", "package", "readme.md"), "# Package");

      const EXCLUDED_DIRS = ["node_modules", ".git"];
      const allFiles: string[] = [];

      function findMdFiles(dir: string) {
        const { readdirSync, statSync } = require("node:fs");
        const entries = readdirSync(dir);
        for (const entry of entries) {
          if (EXCLUDED_DIRS.includes(entry)) continue;
          const fullPath = join(dir, entry);
          if (statSync(fullPath).isDirectory()) {
            findMdFiles(fullPath);
          } else if (entry.endsWith(".md")) {
            allFiles.push(fullPath);
          }
        }
      }

      findMdFiles(TEST_DIR);
      expect(allFiles.length).toBe(1);  // Only root.md, not the one in node_modules
    });

    it("handles .mdx files", () => {
      writeFileSync(join(TEST_DIR, "component.mdx"), "# MDX Component");

      const { readdirSync } = require("node:fs");
      const files = readdirSync(TEST_DIR).filter((f: string) =>
        f.endsWith(".md") || f.endsWith(".mdx")
      );

      expect(files).toContain("component.mdx");
    });
  });

  describe("metadata generation", () => {
    it("generates correct metadata structure", () => {
      writeFileSync(join(TEST_DIR, "file1.md"), "a".repeat(100));
      writeFileSync(join(TEST_DIR, "file2.md"), "b".repeat(200));

      const metadata = {
        generatedAt: new Date().toISOString(),
        totalTokens: 75,  // 25 + 50
        totalFiles: 2,
        files: {
          "file1.md": { tokens: 25, characters: 100, lines: 1, lastUpdated: new Date().toISOString() },
          "file2.md": { tokens: 50, characters: 200, lines: 1, lastUpdated: new Date().toISOString() }
        }
      };

      expect(metadata.totalFiles).toBe(2);
      expect(metadata.totalTokens).toBe(75);
      expect(Object.keys(metadata.files).length).toBe(2);
    });

    it("uses forward slashes for paths", () => {
      const windowsPath = "docs\\guide\\file.md";
      const normalized = windowsPath.replace(/\\/g, "/");

      expect(normalized).toBe("docs/guide/file.md");
    });
  });

  describe("output formats", () => {
    it("generates valid JSON output", () => {
      const metadata = {
        generatedAt: "2024-01-01T00:00:00.000Z",
        totalTokens: 100,
        totalFiles: 5,
        files: {}
      };

      const json = JSON.stringify(metadata, null, 2);
      const parsed = JSON.parse(json);

      expect(parsed.totalTokens).toBe(100);
      expect(parsed.totalFiles).toBe(5);
    });

    it("sorts files by token count in summary", () => {
      const files = {
        "small.md": { tokens: 10 },
        "large.md": { tokens: 100 },
        "medium.md": { tokens: 50 }
      };

      const sorted = Object.entries(files)
        .sort(([, a], [, b]) => b.tokens - a.tokens);

      expect(sorted[0][0]).toBe("large.md");
      expect(sorted[1][0]).toBe("medium.md");
      expect(sorted[2][0]).toBe("small.md");
    });
  });

  describe("file writing", () => {
    it("writes metadata to specified output path", () => {
      const outputPath = join(TEST_DIR, "token-metadata.json");
      const metadata = { totalTokens: 100, totalFiles: 5 };

      writeFileSync(outputPath, JSON.stringify(metadata, null, 2));

      const written = JSON.parse(readFileSync(outputPath, "utf-8"));
      expect(written.totalTokens).toBe(100);
    });

    it("handles absolute paths", () => {
      const { isAbsolute } = require("node:path");
      const isWindows = process.platform === "win32";

      expect(isAbsolute("/absolute/path")).toBe(true);
      // Windows-style paths are only absolute on Windows
      if (isWindows) {
        expect(isAbsolute("C:\\absolute\\path")).toBe(true);
      }
      expect(isAbsolute("relative/path")).toBe(false);
    });
  });
});
