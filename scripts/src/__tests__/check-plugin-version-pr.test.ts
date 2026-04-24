/**
 * Tests for check-plugin-version-pr.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from "vitest";
import * as fs from "node:fs";
import { checkPluginVersionPlaceholders } from "../check-plugin-version-pr.js";

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  };
});

describe("checkPluginVersionPlaceholders", () => {
  let mockExit: MockInstance;
  let mockConsoleLog: MockInstance;
  let mockConsoleError: MockInstance;

  beforeEach(() => {
    mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit() called");
    });
    mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => { });
    mockConsoleError = vi.spyOn(console, "error").mockImplementation(() => { });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should pass when all files have the placeholder version", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ version: "0.0.0-placeholder" })
    );

    checkPluginVersionPlaceholders();

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining("All plugin.json files have the correct placeholder version")
    );
    expect(mockExit).not.toHaveBeenCalled();
  });

  it("should fail when a file has a real version", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ version: "1.0.1" })
    );

    expect(() => checkPluginVersionPlaceholders()).toThrow("process.exit() called");
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining('expected version "0.0.0-placeholder", found "1.0.1"')
    );
  });

  it("should skip files that do not exist", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    checkPluginVersionPlaceholders();

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining("All plugin.json files have the correct placeholder version")
    );
    expect(mockExit).not.toHaveBeenCalled();
  });
});