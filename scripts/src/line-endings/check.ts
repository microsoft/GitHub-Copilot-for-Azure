export interface LineEndingViolation {
  file: string;
  indexEol: string;
}

/**
 * Parses NUL-delimited `git ls-files --eol -z` output and returns tracked text
 * files whose index (committed) content contains CRLF or mixed line endings.
 */
export function findLineEndingViolations(lsFilesEolOutput: string): LineEndingViolation[] {
  const violations: LineEndingViolation[] = [];

  for (const entry of lsFilesEolOutput.split("\0")) {
    if (!entry) {
      continue;
    }

    const separatorIndex = entry.indexOf("\t");
    if (separatorIndex < 0) {
      throw new Error(`Unexpected git ls-files --eol output: ${entry}`);
    }

    const indexInfo = entry.slice(0, separatorIndex).trim().split(/\s+/)[0];
    const file = entry.slice(separatorIndex + 1);
    const indexEol = indexInfo.replace(/^i\//, "");

    if (indexEol === "crlf" || indexEol === "mixed") {
      violations.push({ file, indexEol });
    }
  }

  return violations;
}
