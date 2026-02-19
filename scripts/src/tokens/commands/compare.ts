/**
 * Compare command - Git-based token comparison
 */

import { parseArgs } from "node:util";
import { readFileSync, readdirSync, Dirent } from "node:fs";
import { join, relative } from "node:path";
import { execSync } from "node:child_process";
import type {
  FileTokens,
  FileComparison,
  ComparisonReport
} from "./types.js";
import {
  estimateTokens,
  EXCLUDED_DIRS,
  isMarkdownFile,
  normalizePath,
  DEFAULT_SCAN_DIRS,
  MAX_GIT_BUFFER_SIZE,
  GIT_OPERATION_TIMEOUT
} from "./types.js";

const GIT_REF_PATTERN = /^[a-zA-Z0-9._\-/~^]+$/;
const MAX_REF_LENGTH = 256;

/**
 * Validates a git ref to prevent command injection.
 * Checks format, length, and dangerous characters.
 * @param ref - Git reference to validate
 * @throws Error if ref is invalid or dangerous
 */
function validateGitRef(ref: string): void {
  if (!ref || typeof ref !== "string") {
    throw new Error("Git ref must be a non-empty string");
  }

  if (ref.length === 0 || ref.length >= MAX_REF_LENGTH) {
    throw new Error(`Git ref length must be between 1 and ${MAX_REF_LENGTH} characters`);
  }

  if (!GIT_REF_PATTERN.test(ref)) {
    throw new Error(`Invalid git ref format: ${ref}`);
  }

  // Prevent command injection attempts
  const dangerousPatterns = [";", "&&", "||", "|", "`", "$", "(", ")", "{", "}", "<", ">", "\n", "\r"];
  for (const pattern of dangerousPatterns) {
    if (ref.includes(pattern)) {
      throw new Error(`Git ref contains dangerous characters: ${ref}`);
    }
  }
}

/**
 * Validates a file path for shell safety.
 * Ensures path doesn't contain shell metacharacters that could cause injection.
 * @param path - File path to validate
 * @throws Error if path contains dangerous characters
 */
function validatePath(path: string): void {
  const dangerousChars = [";", "&&", "||", "|", "`", "$", "(", ")", "{", "}", "<", ">", "\n", "\r", '"', "'"];
  for (const char of dangerousChars) {
    if (path.includes(char)) {
      throw new Error(`Path contains dangerous characters: ${path}`);
    }
  }
}

/**
 * Gets token count for a file at a specific git ref.
 * 
 * Security: Uses validateGitRef() and validatePath() to prevent command injection.
 * All git refs and paths are validated against strict patterns before use.
 * 
 * @param filePath - Path to the file
 * @param ref - Git reference
 * @param rootDir - Repository root
 * @returns File tokens or null if file doesn't exist at ref
 */
function getFileTokensAtRef(filePath: string, ref: string, rootDir: string): FileTokens | null {
  validateGitRef(ref);

  try {
    const relativePath = normalizePath(relative(rootDir, filePath));
    validatePath(relativePath);
    const content = execSync(`git show "${ref}:${relativePath}"`, {
      cwd: rootDir,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "inherit"],
      maxBuffer: MAX_GIT_BUFFER_SIZE,
      timeout: GIT_OPERATION_TIMEOUT
    });

    return {
      tokens: estimateTokens(content),
      characters: content.length,
      lines: content.split("\n").length
    };
  } catch (error) {
    // Log specific error for debugging but return null for flow control
    if (process.env.DEBUG) {
      console.error(`Failed to get file tokens at ref ${ref}: ${error}`);
    }
    return null;
  }
}

/**
 * Gets current file tokens from the working tree.
 * @param filePath - Path to the file
 * @returns File tokens or null if file doesn't exist
 */
function getCurrentFileTokens(filePath: string): FileTokens | null {
  try {
    const content = readFileSync(filePath, "utf-8");
    return {
      tokens: estimateTokens(content),
      characters: content.length,
      lines: content.split("\n").length
    };
  } catch {
    return null;
  }
}

function getChangedFiles(baseRef: string, headRef: string, rootDir: string): string[] {
  validateGitRef(baseRef);
  validateGitRef(headRef);

  try {
    const output = execSync(`git diff --name-only "${baseRef}"..."${headRef}" -- "*.md" "*.mdx"`, {
      cwd: rootDir,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "inherit"],
      maxBuffer: MAX_GIT_BUFFER_SIZE,
      timeout: GIT_OPERATION_TIMEOUT
    });
    return output.trim().split("\n").filter(Boolean);
  } catch (error) {
    if (process.env.DEBUG) {
      console.error(`Failed to get changed files: ${error}`);
    }
    return getAllMarkdownFiles(rootDir);
  }
}

function getAllMarkdownFiles(dir: string, files: string[] = [], rootDir: string = dir): string[] {
  const entries: Dirent[] = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      const dirName = entry.name;
      const isExcluded = EXCLUDED_DIRS.some(excluded => excluded === dirName);
      if (!isExcluded) {
        getAllMarkdownFiles(fullPath, files, rootDir);
      }
    } else if (isMarkdownFile(entry.name)) {
      files.push(normalizePath(relative(rootDir, fullPath)));
    }
  }

  return files;
}

function getDefaultMarkdownFiles(rootDir: string): string[] {
  const files: string[] = [];
  for (const dir of DEFAULT_SCAN_DIRS) {
    const fullPath = join(rootDir, dir);
    try {
      getAllMarkdownFiles(fullPath, files, rootDir);
    } catch {
      // Skip if directory doesn't exist
    }
  }
  return files;
}

function compareTokens(baseRef: string, headRef: string, rootDir: string, onlyChanged: boolean): ComparisonReport {
  const files = onlyChanged
    ? getChangedFiles(baseRef, headRef, rootDir)
    : getDefaultMarkdownFiles(rootDir);

  const comparisons: FileComparison[] = [];
  let totalBefore = 0, totalAfter = 0;
  let filesAdded = 0, filesRemoved = 0, filesModified = 0, filesIncreased = 0, filesDecreased = 0;

  for (const file of files) {
    const fullPath = join(rootDir, file);
    const before = getFileTokensAtRef(fullPath, baseRef, rootDir);
    const after = headRef === "HEAD" || headRef === "WORKING"
      ? getCurrentFileTokens(fullPath)
      : getFileTokensAtRef(fullPath, headRef, rootDir);

    const beforeTokens = before?.tokens ?? 0;
    const afterTokens = after?.tokens ?? 0;
    const diff = afterTokens - beforeTokens;
    const percentChange = beforeTokens > 0
      ? Math.round((diff / beforeTokens) * 100)
      : (afterTokens > 0 ? 100 : 0);

    let status: FileComparison["status"];
    if (!before && after) { status = "added"; filesAdded++; }
    else if (before && !after) { status = "removed"; filesRemoved++; }
    else if (diff !== 0) {
      status = "modified";
      filesModified++;
      if (diff > 0) filesIncreased++;
      if (diff < 0) filesDecreased++;
    } else {
      status = "unchanged";
    }

    totalBefore += beforeTokens;
    totalAfter += afterTokens;
    comparisons.push({ file, before, after, diff, percentChange, status });
  }

  comparisons.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  const totalDiff = totalAfter - totalBefore;
  const totalPercentChange = totalBefore > 0 ? Math.round((totalDiff / totalBefore) * 100) : 0;

  return {
    baseRef,
    headRef,
    timestamp: new Date().toISOString(),
    summary: { totalBefore, totalAfter, totalDiff, percentChange: totalPercentChange, filesAdded, filesRemoved, filesModified, filesIncreased, filesDecreased },
    files: comparisons
  };
}

function formatDiff(diff: number): string {
  return diff > 0 ? `+${diff.toLocaleString()}` : diff < 0 ? diff.toLocaleString() : "0";
}

function formatPercent(percent: number): string {
  return percent > 0 ? `+${percent}%` : percent < 0 ? `${percent}%` : "0%";
}

function getChangeEmoji(diff: number, percent: number): string {
  if (diff === 0) return "➖";
  if (diff < 0) return "📉";
  if (percent > 50) return "🔴";
  if (percent > 20) return "🟠";
  return "📈";
}

function formatMarkdownReport(report: ComparisonReport): string {
  const lines: string[] = [];
  const s = report.summary;

  lines.push("## 📊 Token Change Report\n");
  lines.push(`Comparing \`${report.baseRef}\` → \`${report.headRef}\`\n`);

  const emoji = s.totalDiff > 0 ? "📈" : s.totalDiff < 0 ? "📉" : "➖";
  lines.push("### Summary\n");
  lines.push("| Metric | Value |", "|--------|-------|");
  lines.push(`| ${emoji} **Total Change** | **${formatDiff(s.totalDiff)} tokens (${formatPercent(s.percentChange)})** |`);
  lines.push(`| Before | ${s.totalBefore.toLocaleString()} tokens |`);
  lines.push(`| After | ${s.totalAfter.toLocaleString()} tokens |`);
  lines.push(`| Files Changed | ${s.filesModified + s.filesAdded + s.filesRemoved} |`);
  lines.push("");

  const changedFiles = report.files.filter(f => f.status !== "unchanged");
  if (changedFiles.length > 0) {
    lines.push("### Changed Files\n");
    lines.push("| File | Before | After | Change |", "|------|--------|-------|--------|");

    for (const file of changedFiles) {
      const before = file.before?.tokens.toLocaleString() ?? "-";
      const after = file.after?.tokens.toLocaleString() ?? "-";
      const change = file.status === "added" ? `+${file.after?.tokens}` :
        file.status === "removed" ? `-${file.before?.tokens}` :
          `${formatDiff(file.diff)} (${formatPercent(file.percentChange)})`;
      lines.push(`| \`${file.file}\` | ${before} | ${after} | ${change} |`);
    }
  }

  return lines.join("\n");
}

function formatConsoleReport(report: ComparisonReport): void {
  const s = report.summary;

  console.log("\n" + "═".repeat(60));
  console.log("📊 TOKEN CHANGE REPORT");
  console.log("═".repeat(60));
  console.log(`Comparing: ${report.baseRef} → ${report.headRef}`);
  console.log("─".repeat(60));

  const emoji = s.totalDiff > 0 ? "📈" : s.totalDiff < 0 ? "📉" : "➖";
  console.log(`\n${emoji} Total Change: ${formatDiff(s.totalDiff)} tokens (${formatPercent(s.percentChange)})`);
  console.log(`   Before: ${s.totalBefore.toLocaleString()} tokens`);
  console.log(`   After:  ${s.totalAfter.toLocaleString()} tokens`);
  console.log(`   Files:  ${s.filesModified} modified, ${s.filesAdded} added, ${s.filesRemoved} removed`);

  const changedFiles = report.files.filter(f => f.status !== "unchanged");
  if (changedFiles.length > 0) {
    console.log("\n" + "─".repeat(60));
    console.log("Changed Files:");

    for (const file of changedFiles.slice(0, 15)) {
      const emoji = getChangeEmoji(file.diff, file.percentChange);
      console.log(`${emoji} ${file.file}: ${file.before?.tokens ?? 0} → ${file.after?.tokens ?? 0} [${formatDiff(file.diff)}]`);
    }

    if (changedFiles.length > 15) {
      console.log(`   ... and ${changedFiles.length - 15} more files`);
    }
  }

  console.log("\n" + "═".repeat(60) + "\n");
}

export function compare(rootDir: string, args: string[]): void {
  const { values } = parseArgs({
    args,
    options: {
      base: { type: "string", default: "main" },
      head: { type: "string", default: "HEAD" },
      markdown: { type: "boolean", default: false },
      json: { type: "boolean", default: false },
      all: { type: "boolean", default: false }
    },
    strict: false,
    allowPositionals: true
  });

  const baseRef = (values.base ?? "main") as string;
  const headRef = (values.head ?? "HEAD") as string;
  const markdown = values.markdown ?? false;
  const json = values.json ?? false;
  const allFiles = values.all ?? false;

  const report = compareTokens(baseRef, headRef, rootDir, !allFiles);

  if (json) console.log(JSON.stringify(report, null, 2));
  else if (markdown) console.log(formatMarkdownReport(report));
  else formatConsoleReport(report);
}
