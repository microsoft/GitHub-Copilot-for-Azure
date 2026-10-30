import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyBuildOutputVersions } from "../verify-build-output-versions.js";

let root: string;

function writePlugin(name: string, version = "1.2.3"): string {
  const pluginRoot = join(root, name);
  for (const directory of [".", ".plugin", ".claude-plugin", ".cursor-plugin"]) {
    mkdirSync(join(pluginRoot, directory), { recursive: true });
    writeFileSync(join(pluginRoot, directory, "plugin.json"), JSON.stringify({ name, version }));
  }
  return pluginRoot;
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "built-plugin-versions-"));
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

describe("built plugin version verification", () => {
  it("verifies every plugin in a collection and supports a single package", () => {
    const first = writePlugin("alpha");
    writePlugin("beta");
    expect(verifyBuildOutputVersions(root)).toBe(true);
    expect(verifyBuildOutputVersions(first)).toBe(true);
  });

  it("reports portable placeholder versions in all packages without short-circuiting", () => {
    for (const name of ["alpha", "beta"]) {
      const pluginRoot = writePlugin(name);
      writeFileSync(join(pluginRoot, "plugin.json"), JSON.stringify({ version: "0.0.0-placeholder" }));
    }
    expect(verifyBuildOutputVersions(root)).toBe(false);
    for (const name of ["alpha", "beta"]) {
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining(join(name, "plugin.json") + ": version is still placeholder")
      );
    }
  });

  it.each([".", ".plugin", ".claude-plugin", ".cursor-plugin"])("rejects missing %s manifests", directory => {
    const pluginRoot = writePlugin("alpha");
    rmSync(join(pluginRoot, directory, "plugin.json"));
    expect(verifyBuildOutputVersions(root)).toBe(false);
  });

  it("rejects an empty output collection", () => {
    expect(verifyBuildOutputVersions(root)).toBe(false);
  });
});
