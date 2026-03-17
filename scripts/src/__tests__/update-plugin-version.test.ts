/**
 * Tests for update-plugin-version.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from "vitest";
import { join } from "node:path";
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from "node:fs";

const TEST_DIR = join(process.cwd(), "__test_fixtures_update_plugin__");

// Import the actual function we want to test
import { updatePluginVersion } from "../update-plugin-version.js";

describe("updatePluginVersion", () => {
  let consoleLogSpy: MockInstance;
  let consoleErrorSpy: MockInstance;

  beforeEach(() => {
    // Clean up and create test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });

    // Setup spies
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Create the directory structure that the function expects
    mkdirSync(join(TEST_DIR, "plugin", ".claude-plugin"), { recursive: true });
    mkdirSync(join(TEST_DIR, "plugin", ".plugin"), { recursive: true });
  });

  afterEach(async () => {
    // Restore spies
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();

    // Small delay to allow file handles to close
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Clean up test directory
    try {
      if (existsSync(TEST_DIR)) {
        rmSync(TEST_DIR, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
      }
    } catch {
      // Ignore cleanup errors in tests
    }
  });

  describe("successful version updates", () => {
    it("updates both plugin.json files with the new version", () => {
      // Create test plugin files
      const claudePluginPath = join(TEST_DIR, "plugin", ".claude-plugin", "plugin.json");
      const regularPluginPath = join(TEST_DIR, "plugin", ".plugin", "plugin.json");

      const testPluginFiles = [claudePluginPath, regularPluginPath];

      const initialConfig = {
        version: "1.0.0",
        name: "test-plugin",
        description: "Test plugin"
      };

      writeFileSync(claudePluginPath, JSON.stringify(initialConfig, null, 2) + "\n");
      writeFileSync(regularPluginPath, JSON.stringify(initialConfig, null, 2) + "\n");

      // Call the function with custom paths
      const result = updatePluginVersion("2.0.0", testPluginFiles);

      // Verify function returned success (no errors)
      expect(result).toBe(false);

      // Verify both files were updated
      const claudePluginContent = JSON.parse(readFileSync(claudePluginPath, "utf8"));
      const regularPluginContent = JSON.parse(readFileSync(regularPluginPath, "utf8"));

      expect(claudePluginContent.version).toBe("2.0.0");
      expect(regularPluginContent.version).toBe("2.0.0");

      // Verify other properties were preserved
      expect(claudePluginContent.name).toBe("test-plugin");
      expect(regularPluginContent.description).toBe("Test plugin");

      // Verify console output
      expect(consoleLogSpy).toHaveBeenCalledWith("Updating plugin files to version: 2.0.0");
      expect(consoleLogSpy).toHaveBeenCalledWith(`✓ Updated ${claudePluginPath} to version 2.0.0`);
      expect(consoleLogSpy).toHaveBeenCalledWith(`✓ Updated ${regularPluginPath} to version 2.0.0`);
    });

    it("preserves existing properties while updating version", () => {
      const claudePluginPath = join(TEST_DIR, "plugin", ".claude-plugin", "plugin.json");
      const regularPluginPath = join(TEST_DIR, "plugin", ".plugin", "plugin.json");
      
      const testPluginFiles = [claudePluginPath, regularPluginPath];
      
      const complexConfig = {
        version: "1.0.0",
        name: "complex-plugin",
        description: "A complex plugin with multiple properties",
        author: "Test Author",
        keywords: ["test", "plugin"],
        settings: {
          enabled: true,
          theme: "dark"
        }
      };

      writeFileSync(claudePluginPath, JSON.stringify(complexConfig, null, 2) + "\n");
      writeFileSync(regularPluginPath, JSON.stringify(complexConfig, null, 2) + "\n");

      const result = updatePluginVersion("3.0.0", testPluginFiles);

      // Verify function returned success (no errors)
      expect(result).toBe(false);

      const claudeUpdatedConfig = JSON.parse(readFileSync(claudePluginPath, "utf8"));
      const regularUpdatedConfig = JSON.parse(readFileSync(regularPluginPath, "utf8"));

      // Verify version was updated
      expect(claudeUpdatedConfig.version).toBe("3.0.0");
      expect(regularUpdatedConfig.version).toBe("3.0.0");

      // Verify other properties were preserved
      expect(claudeUpdatedConfig.name).toBe("complex-plugin");
      expect(claudeUpdatedConfig.keywords).toEqual(["test", "plugin"]);
      expect(claudeUpdatedConfig.settings).toEqual({ enabled: true, theme: "dark" });
    });

    it("formats JSON with proper indentation and trailing newline", () => {
      const claudePluginPath = join(TEST_DIR, "plugin", ".claude-plugin", "plugin.json");
      const regularPluginPath = join(TEST_DIR, "plugin", ".plugin", "plugin.json");
      
      const testPluginFiles = [claudePluginPath, regularPluginPath];
      const initialConfig = { version: "1.0.0", name: "test" };

      // Write without proper formatting
      writeFileSync(claudePluginPath, JSON.stringify(initialConfig));
      writeFileSync(regularPluginPath, JSON.stringify(initialConfig));

      const result = updatePluginVersion("2.0.0", testPluginFiles);

      // Verify function returned success (no errors)
      expect(result).toBe(false);

      const claudeFileContent = readFileSync(claudePluginPath, "utf8");
      const regularFileContent = readFileSync(regularPluginPath, "utf8");

      // Check proper formatting (2-space indentation and trailing newline)
      expect(claudeFileContent).toMatch(/\{\n  "version": "2\.0\.0",\n  "name": "test"\n\}\n$/);
      expect(regularFileContent).toMatch(/\{\n  "version": "2\.0\.0",\n  "name": "test"\n\}\n$/);
      expect(claudeFileContent.endsWith("\n")).toBe(true);
      expect(regularFileContent.endsWith("\n")).toBe(true);
    });
  });

  describe("error handling", () => {
    it("handles file not found error and returns true", () => {
      const nonExistentFiles = [join(TEST_DIR, "nonexistent1.json"), join(TEST_DIR, "nonexistent2.json")];
      
      const result = updatePluginVersion("2.0.0", nonExistentFiles);

      expect(result).toBe(true);
      expect(consoleErrorSpy).toHaveBeenCalledWith(`File not found: ${nonExistentFiles[0]}`);
    });

    it("handles invalid JSON content and returns true", () => {
      const claudePluginPath = join(TEST_DIR, "plugin", ".claude-plugin", "plugin.json");
      const testPluginFiles = [claudePluginPath];
      
      // Create file with invalid JSON
      writeFileSync(claudePluginPath, "{ invalid json content");

      const result = updatePluginVersion("2.0.0", testPluginFiles);

      expect(result).toBe(true);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `Failed to update ${claudePluginPath}:`,
        expect.any(String)
      );
    });

    it("stops processing further files after first error", () => {
      const claudePluginPath = join(TEST_DIR, "plugin", ".claude-plugin", "plugin.json");
      const regularPluginPath = join(TEST_DIR, "plugin", ".plugin", "plugin.json");
      const testPluginFiles = [claudePluginPath, regularPluginPath];
      
      // Create first file with invalid JSON, second file doesn't matter
      writeFileSync(claudePluginPath, "{ invalid json }");
      writeFileSync(regularPluginPath, JSON.stringify({ version: "1.0.0" }, null, 2) + "\n");

      const result = updatePluginVersion("2.0.0", testPluginFiles);

      // Should return true indicating an error occurred
      expect(result).toBe(true);
      // Should only see error for first file, not attempt second
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("version parameter validation", () => {
    it("accepts semantic versioning format", () => {
      const claudePluginPath = join(TEST_DIR, "plugin", ".claude-plugin", "plugin.json");
      const regularPluginPath = join(TEST_DIR, "plugin", ".plugin", "plugin.json");
      const testPluginFiles = [claudePluginPath, regularPluginPath];
      
      const initialConfig = { version: "1.0.0" };
      
      const versions = ["1.0.0", "2.1.3", "1.0.0-alpha.1", "1.0.0+build.123"];

      for (const version of versions) {
        writeFileSync(claudePluginPath, JSON.stringify(initialConfig, null, 2) + "\n");
        writeFileSync(regularPluginPath, JSON.stringify(initialConfig, null, 2) + "\n");

        const result = updatePluginVersion(version, testPluginFiles);

        expect(result).toBe(false);
        const claudeUpdatedConfig = JSON.parse(readFileSync(claudePluginPath, "utf8"));
        const regularUpdatedConfig = JSON.parse(readFileSync(regularPluginPath, "utf8"));
        
        expect(claudeUpdatedConfig.version).toBe(version);
        expect(regularUpdatedConfig.version).toBe(version);
      }
    });

    it("accepts any string as version", () => {
      const claudePluginPath = join(TEST_DIR, "plugin", ".claude-plugin", "plugin.json");
      const regularPluginPath = join(TEST_DIR, "plugin", ".plugin", "plugin.json");
      const testPluginFiles = [claudePluginPath, regularPluginPath];
      
      const initialConfig = { version: "1.0.0" };
      
      writeFileSync(claudePluginPath, JSON.stringify(initialConfig, null, 2) + "\n");
      writeFileSync(regularPluginPath, JSON.stringify(initialConfig, null, 2) + "\n");

      const result = updatePluginVersion("custom-version-string", testPluginFiles);

      expect(result).toBe(false);
      const claudeUpdatedConfig = JSON.parse(readFileSync(claudePluginPath, "utf8"));
      const regularUpdatedConfig = JSON.parse(readFileSync(regularPluginPath, "utf8"));
      
      expect(claudeUpdatedConfig.version).toBe("custom-version-string");
      expect(regularUpdatedConfig.version).toBe("custom-version-string");
    });
  });

  describe("functionality verification", () => {
    it("verifies the exported function from the original module exists", () => {
      expect(updatePluginVersion).toBeDefined();
      expect(typeof updatePluginVersion).toBe("function");
    });

    it("handles edge case of empty existing properties", () => {
      const claudePluginPath = join(TEST_DIR, "plugin", ".claude-plugin", "plugin.json");
      const regularPluginPath = join(TEST_DIR, "plugin", ".plugin", "plugin.json");
      const testPluginFiles = [claudePluginPath, regularPluginPath];
      
      const minimalConfig = { version: "0.0.1" };
      
      writeFileSync(claudePluginPath, JSON.stringify(minimalConfig, null, 2) + "\n");
      writeFileSync(regularPluginPath, JSON.stringify(minimalConfig, null, 2) + "\n");

      const result = updatePluginVersion("1.0.0", testPluginFiles);

      expect(result).toBe(false);
      const claudeUpdatedConfig = JSON.parse(readFileSync(claudePluginPath, "utf8"));
      const regularUpdatedConfig = JSON.parse(readFileSync(regularPluginPath, "utf8"));
      
      expect(claudeUpdatedConfig.version).toBe("1.0.0");
      expect(regularUpdatedConfig.version).toBe("1.0.0");
      expect(Object.keys(claudeUpdatedConfig)).toEqual(["version"]);
    });
  });
});