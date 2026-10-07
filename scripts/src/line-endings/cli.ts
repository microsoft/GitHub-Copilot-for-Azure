#!/usr/bin/env node
/**
 * Line Ending Validator
 *
 * Fails when any tracked text file is stored in the Git index with CRLF or
 * mixed line endings. Binary files are reported by Git as `i/-text` and are
 * ignored. Exit codes: 0 = all LF, 1 = violations found.
 */
import { execFileSync } from "node:child_process";
import { findLineEndingViolations } from "./check.js";

const repositoryRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const output = execFileSync("git", ["ls-files", "--eol", "-z"], {
  cwd: repositoryRoot,
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});
const violations = findLineEndingViolations(output);

if (violations.length === 0) {
  console.log("All tracked text files use LF line endings.");
  process.exitCode = 0;
} else {
  console.error(`Found ${violations.length} tracked text file(s) committed with CRLF or mixed line endings:`);
  for (const { file, indexEol } of violations) {
    console.error(`  [${indexEol}] ${file}`);
  }
  console.error("");
  console.error("Fix: run `git add --renormalize <path>` (or convert the file to LF) and commit.");
  process.exitCode = 1;
}
