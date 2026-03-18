/**
 * Tests for check-plugin-version-pr.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from "vitest";
import { execFileSync } from "node:child_process";
import { checkPluginVersionChanges } from "../check-plugin-version-pr.js";

// Mock child_process
vi.mock("node:child_process", () => ({
  execFileSync: vi.fn()
}));

describe("checkPluginVersionChanges", () => {
  let mockExecFileSync: MockInstance;
  let mockExit: MockInstance;
  let mockConsoleLog: MockInstance;
  let mockConsoleError: MockInstance;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    mockExecFileSync = vi.mocked(execFileSync);
    mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit() called");
    });
    mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
    mockConsoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Restore environment
    process.env = originalEnv;
  });

  describe("environment validation", () => {
    it("should exit if BASE_SHA is missing", () => {
      delete process.env.BASE_SHA;
      process.env.HEAD_SHA = "head123";

      expect(() => checkPluginVersionChanges()).toThrow("process.exit() called");
      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockConsoleError).toHaveBeenCalledWith("❌ Missing BASE_SHA or HEAD_SHA environment variables");
    });

    it("should exit if HEAD_SHA is missing", () => {
      process.env.BASE_SHA = "base123";
      delete process.env.HEAD_SHA;

      expect(() => checkPluginVersionChanges()).toThrow("process.exit() called");
      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockConsoleError).toHaveBeenCalledWith("❌ Missing BASE_SHA or HEAD_SHA environment variables");
    });
  });

  describe("version comparison", () => {
    beforeEach(() => {
      process.env.BASE_SHA = "base123";
      process.env.HEAD_SHA = "head123";
    });

    it("should pass when no version changes detected", () => {
      const pluginJsonContent = JSON.stringify({
        name: "test-plugin",
        version: "1.0.0",
        description: "Test plugin"
      });

      // Mock same content for both base and head
      mockExecFileSync.mockReturnValue(pluginJsonContent);

      checkPluginVersionChanges();

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringMatching(/No plugin version changes detected. PR check passed!/));
      expect(mockExit).not.toHaveBeenCalled();
    });

    it("should fail when version changes detected", () => {
      const baseContent = JSON.stringify({
        name: "test-plugin",
        version: "1.0.0",
        description: "Test plugin"
      });

      const headContent = JSON.stringify({
        name: "test-plugin",
        version: "1.1.0", // Version changed
        description: "Test plugin"
      });

      // Mock different content for base vs head
      mockExecFileSync.mockImplementation((command, args) => {
        const gitShowArg = args && args[1]; // git show ref:path
        if (gitShowArg && gitShowArg.includes("base123:")) {
          return baseContent;
        } else if (gitShowArg && gitShowArg.includes("head123:")) {
          return headContent;
        }
        return "";
      });

      expect(() => checkPluginVersionChanges()).toThrow("process.exit() called");
      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining("❌ Plugin version changes detected in this PR!"));
    });

    it("should handle new files gracefully", () => {
      const newFileContent = JSON.stringify({
        name: "new-plugin",
        version: "1.0.0",
        description: "New plugin"
      });

      mockExecFileSync.mockImplementation((command, args) => {
        const gitShowArg = args && args[1]; // git show ref:path
        if (gitShowArg && gitShowArg.includes("base123:")) {
          // Simulate file not existing in base
          const error = new Error("File not found") as Error & { status: number };
          error.status = 128;
          throw error;
        } else if (gitShowArg && gitShowArg.includes("head123:")) {
          return newFileContent;
        }
        return "";
      });

      checkPluginVersionChanges();

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringMatching(/No plugin version changes detected/));
      expect(mockExit).not.toHaveBeenCalled();
    });

    it("should handle deleted files gracefully", () => {
      const deletedFileContent = JSON.stringify({
        name: "deleted-plugin",
        version: "1.0.0",
        description: "Deleted plugin"
      });

      mockExecFileSync.mockImplementation((command, args) => {
        const gitShowArg = args && args[1]; // git show ref:path
        if (gitShowArg && gitShowArg.includes("base123:")) {
          return deletedFileContent;
        } else if (gitShowArg && gitShowArg.includes("head123:")) {
          // Simulate file not existing in head
          const error = new Error("File not found") as Error & { status: number };
          error.status = 128;
          throw error;
        }
        return "";
      });

      checkPluginVersionChanges();

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringMatching(/No plugin version changes detected/));
      expect(mockExit).not.toHaveBeenCalled();
    });

    it("should handle invalid JSON gracefully", () => {
      mockExecFileSync.mockImplementation(() => {
        return "{ invalid json content"; // Invalid JSON
      });

      checkPluginVersionChanges();

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringMatching(/No plugin version changes detected/));
      expect(mockExit).not.toHaveBeenCalled();
    });

    it("should detect version changes in multiple files", () => {
      const baseContent1 = JSON.stringify({ version: "1.0.0" });
      const headContent1 = JSON.stringify({ version: "1.1.0" }); // Changed
      const baseContent2 = JSON.stringify({ version: "2.0.0" });
      const headContent2 = JSON.stringify({ version: "2.1.0" }); // Also changed

      mockExecFileSync.mockImplementation((command, args) => {
        const gitShowArg = args && args[1]; // git show ref:path
        if (gitShowArg && gitShowArg.includes("plugin/.plugin/plugin.json")) {
          return gitShowArg.includes("base123:") ? baseContent1 : headContent1;
        } else if (gitShowArg && gitShowArg.includes("plugin/.claude-plugin/plugin.json")) {
          return gitShowArg.includes("base123:") ? baseContent2 : headContent2;
        }
        return "";
      });

      expect(() => checkPluginVersionChanges()).toThrow("process.exit() called");
      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining("❌ Plugin version changes detected in this PR!"));
    });
  });

  describe("console output", () => {
    beforeEach(() => {
      process.env.BASE_SHA = "base123";
      process.env.HEAD_SHA = "head123";
    });

    it("should provide detailed output for version changes", () => {
      const baseContent = JSON.stringify({ version: "1.0.0" });
      const headContent = JSON.stringify({ version: "1.1.0" });

      mockExecFileSync.mockImplementation((command, args) => {
        const gitShowArg = args && args[1]; // git show ref:path
        return gitShowArg && gitShowArg.includes("base123:") ? baseContent : headContent;
      });

      expect(() => checkPluginVersionChanges()).toThrow("process.exit() called");

      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining("🚫 Plugin versions should not be updated manually in PRs."));
      expect(mockConsoleError).toHaveBeenCalledWith("   Plugin versions are managed automatically through CI/CD.");
      expect(mockConsoleError).toHaveBeenCalledWith("   Please revert the version changes in your PR.\n");
    });

    it("should log progress information", () => {
      const pluginContent = JSON.stringify({ version: "1.0.0" });
      mockExecFileSync.mockReturnValue(pluginContent);

      checkPluginVersionChanges();

      expect(mockConsoleLog).toHaveBeenCalledWith("🔍 Checking plugin version changes between base123 and head123");
      expect(mockConsoleLog).toHaveBeenCalledWith("\n📝 Checking plugin/.plugin/plugin.json...");
      expect(mockConsoleLog).toHaveBeenCalledWith("\n📝 Checking plugin/.claude-plugin/plugin.json...");
    });
  });
});