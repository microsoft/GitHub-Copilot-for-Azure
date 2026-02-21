/**
 * Tests for utility functions in utils.ts
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  loadConfig,
  getLimitForFile,
  findMarkdownFiles
} from "../commands/utils.js";
import type { TokenLimitsConfig } from "../commands/types.js";

describe("loadConfig", () => {
  let TEST_DIR = "";

  beforeEach(() => {
    TEST_DIR = mkdtempSync(join(tmpdir(), "utils-test-"));
  });

  afterEach(() => {
    if (TEST_DIR) {
      rmSync(TEST_DIR, { recursive: true, force: true });
      TEST_DIR = "";
    }
  });

  it("returns defaults when no config file exists", () => {
    const config = loadConfig(TEST_DIR);
    expect(config.defaults).toBeDefined();
    expect(config.defaults["*.md"]).toBeDefined();
  });

  it("loads valid configuration file", () => {
    const testConfig = {
      description: "Test config",
      defaults: {
        "*.md": 1500,
        "SKILL.md": 3000
      },
      overrides: {
        "special.md": 5000
      }
    };
    writeFileSync(join(TEST_DIR, ".token-limits.json"), JSON.stringify(testConfig));
    
    const config = loadConfig(TEST_DIR);
    expect(config.defaults["*.md"]).toBe(1500);
    expect(config.defaults["SKILL.md"]).toBe(3000);
    expect(config.overrides["special.md"]).toBe(5000);
  });

  it("returns defaults for invalid JSON", () => {
    writeFileSync(join(TEST_DIR, ".token-limits.json"), "not valid json");
    
    const config = loadConfig(TEST_DIR);
    expect(config.defaults).toBeDefined();
    expect(config.defaults["*.md"]).toBeDefined();
  });

  it("returns defaults for config missing defaults field", () => {
    writeFileSync(join(TEST_DIR, ".token-limits.json"), JSON.stringify({ overrides: {} }));
    
    const config = loadConfig(TEST_DIR);
    expect(config.defaults).toBeDefined();
  });
});

describe("getLimitForFile", () => {
  const mockConfig: TokenLimitsConfig = {
    defaults: {
      "*.md": 2000,
      "SKILL.md": 3500,
      "references/**/*.md": 1500
    },
    overrides: {
      "plugin/skills/special/SKILL.md": 5000
    }
  };

  it("returns override limit for exact match", () => {
    const result = getLimitForFile("plugin/skills/special/SKILL.md", mockConfig, "/root");
    expect(result.limit).toBe(5000);
    expect(result.pattern).toBe("plugin/skills/special/SKILL.md");
  });

  it("returns specific pattern limit for SKILL.md files", () => {
    const result = getLimitForFile("plugin/skills/my-skill/SKILL.md", mockConfig, "/root");
    expect(result.limit).toBe(3500);
    expect(result.pattern).toBe("SKILL.md");
  });

  it("returns globstar pattern limit for reference files", () => {
    const result = getLimitForFile("references/sub/GUIDE.md", mockConfig, "/root");
    expect(result.limit).toBe(1500);
    expect(result.pattern).toBe("references/**/*.md");
  });

  it("returns default limit for unmatched files", () => {
    const result = getLimitForFile("docs/README.md", mockConfig, "/root");
    expect(result.limit).toBe(2000);
    expect(result.pattern).toBe("*.md");
  });

  it("handles paths with backslashes (Windows)", () => {
    const result = getLimitForFile("plugin\\skills\\my-skill\\SKILL.md", mockConfig, "/root");
    expect(result.limit).toBe(3500);
  });

  it("applies more specific patterns over general ones", () => {
    const configWithMultiplePatterns: TokenLimitsConfig = {
      defaults: {
        "*.md": 2000,
        "SKILL.md": 3500,
        "plugin/skills/**/SKILL.md": 4000
      },
      overrides: {}
    };
    
    const result = getLimitForFile("plugin/skills/my-skill/SKILL.md", configWithMultiplePatterns, "/root");
    // SKILL.md exact filename match wins over globstar pattern due to specificity scoring
    // (no wildcards = +10000 points)
    expect(result.limit).toBe(3500);
  });
});

describe("findMarkdownFiles", () => {
  let TEST_DIR = "";

  beforeEach(() => {
    TEST_DIR = mkdtempSync(join(tmpdir(), "find-md-test-"));
  });

  afterEach(() => {
    if (TEST_DIR) {
      rmSync(TEST_DIR, { recursive: true, force: true });
      TEST_DIR = "";
    }
  });

  it("finds markdown files in directory", () => {
    writeFileSync(join(TEST_DIR, "README.md"), "# Test");
    writeFileSync(join(TEST_DIR, "GUIDE.md"), "# Guide");
    writeFileSync(join(TEST_DIR, "script.ts"), 'console.log("hi")');
    
    const files = findMarkdownFiles(TEST_DIR);
    expect(files.length).toBe(2);
    expect(files.some(f => f.endsWith("README.md"))).toBe(true);
    expect(files.some(f => f.endsWith("GUIDE.md"))).toBe(true);
  });

  it("finds .mdx files", () => {
    writeFileSync(join(TEST_DIR, "component.mdx"), "# MDX");
    
    const files = findMarkdownFiles(TEST_DIR);
    expect(files.length).toBe(1);
    expect(files[0].endsWith("component.mdx")).toBe(true);
  });

  it("searches subdirectories recursively", () => {
    mkdirSync(join(TEST_DIR, "sub", "deep"), { recursive: true });
    writeFileSync(join(TEST_DIR, "root.md"), "# Root");
    writeFileSync(join(TEST_DIR, "sub", "sub.md"), "# Sub");
    writeFileSync(join(TEST_DIR, "sub", "deep", "deep.md"), "# Deep");
    
    const files = findMarkdownFiles(TEST_DIR);
    expect(files.length).toBe(3);
  });

  it("excludes node_modules directory", () => {
    mkdirSync(join(TEST_DIR, "node_modules"));
    writeFileSync(join(TEST_DIR, "README.md"), "# Test");
    writeFileSync(join(TEST_DIR, "node_modules", "pkg.md"), "# Package");
    
    const files = findMarkdownFiles(TEST_DIR);
    expect(files.length).toBe(1);
    expect(files[0].endsWith("README.md")).toBe(true);
  });

  it("excludes .git directory", () => {
    mkdirSync(join(TEST_DIR, ".git"));
    writeFileSync(join(TEST_DIR, "README.md"), "# Test");
    writeFileSync(join(TEST_DIR, ".git", "config.md"), "# Config");
    
    const files = findMarkdownFiles(TEST_DIR);
    expect(files.length).toBe(1);
  });

  it("returns empty array for non-existent directory", () => {
    const files = findMarkdownFiles(join(TEST_DIR, "nonexistent"));
    expect(files).toEqual([]);
  });

  it("returns empty array for directory with no markdown files", () => {
    writeFileSync(join(TEST_DIR, "script.ts"), "code");
    writeFileSync(join(TEST_DIR, "data.json"), "{}");
    
    const files = findMarkdownFiles(TEST_DIR);
    expect(files).toEqual([]);
  });
});
