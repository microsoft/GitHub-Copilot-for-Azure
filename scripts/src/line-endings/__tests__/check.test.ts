import { describe, it, expect } from "vitest";
import { findLineEndingViolations } from "../check.js";

function entry(indexEol: string, file: string): string {
  return `i/${indexEol.padEnd(6)}w/${indexEol.padEnd(6)}attr/text=auto eol=lf \t${file}`;
}

describe("findLineEndingViolations", () => {
  it("returns no violations for LF, empty, and binary files", () => {
    const output = [
      entry("lf", "README.md"),
      entry("none", "empty.txt"),
      entry("-text", "image.png"),
      "",
    ].join("\0");

    expect(findLineEndingViolations(output)).toEqual([]);
  });

  it("reports CRLF and mixed files", () => {
    const output = [
      entry("crlf", "docs/a.md"),
      entry("lf", "docs/b.md"),
      entry("mixed", "scripts/c.py"),
    ].join("\0");

    expect(findLineEndingViolations(output)).toEqual([
      { file: "docs/a.md", indexEol: "crlf" },
      { file: "scripts/c.py", indexEol: "mixed" },
    ]);
  });

  it("preserves file paths containing spaces", () => {
    const output = entry("crlf", "dir with space/file name.md");

    expect(findLineEndingViolations(output)).toEqual([
      { file: "dir with space/file name.md", indexEol: "crlf" },
    ]);
  });

  it("throws on malformed entries", () => {
    expect(() => findLineEndingViolations("not-valid-output")).toThrow(/Unexpected/);
  });
});
