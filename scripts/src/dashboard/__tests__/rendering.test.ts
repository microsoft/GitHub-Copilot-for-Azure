import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Security gate: ensure dashboard JS files never use dangerous DOM APIs.
 * If anyone adds innerHTML/outerHTML/insertAdjacentHTML/document.write,
 * this test will catch it.
 */

const DASHBOARD_ASSETS_DIR = resolve(
  import.meta.dirname,
  "../../../../dashboard/assets",
);

/** Patterns that are forbidden in dashboard JavaScript files. */
const FORBIDDEN_PATTERNS = [
  /\.innerHTML\b/,
  /\.outerHTML\b/,
  /\.insertAdjacentHTML\b/,
  /document\.write\b/,
];

/** Human-readable names for each pattern. */
const PATTERN_NAMES = [
  "innerHTML",
  "outerHTML",
  "insertAdjacentHTML",
  "document.write",
];

/**
 * Collect all .js files from the dashboard/assets directory.
 */
function getJsFiles(dir: string): string[] {
  try {
    return readdirSync(dir, { recursive: true })
      .map(String)
      .filter((f) => f.endsWith(".js"))
      .map((f) => join(dir, f));
  } catch {
    return [];
  }
}

describe("dashboard rendering security", () => {
  const jsFiles = getJsFiles(DASHBOARD_ASSETS_DIR);

  it("finds at least one JS file in dashboard/assets", () => {
    expect(jsFiles.length).toBeGreaterThan(0);
  });

  it("contains ZERO occurrences of innerHTML in any JS file", () => {
    for (const filePath of jsFiles) {
      const content = readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Skip comment lines (single-line comments)
        if (line.trimStart().startsWith("//")) continue;

        for (let p = 0; p < FORBIDDEN_PATTERNS.length; p++) {
          const match = FORBIDDEN_PATTERNS[p].test(line);
          expect(
            match,
            `Forbidden API "${PATTERN_NAMES[p]}" found in ${filePath}:${i + 1}: ${line.trim()}`,
          ).toBe(false);
        }
      }
    }
  });

  it("uses only safe DOM APIs (createElement, textContent, setAttribute)", () => {
    // Positive check: at least one file should use safe DOM APIs
    const allContent = jsFiles
      .map((f) => readFileSync(f, "utf-8"))
      .join("\n");

    expect(allContent).toContain("createElement");
    expect(allContent).toContain("textContent");
  });
});
