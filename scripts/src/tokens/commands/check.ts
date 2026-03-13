/**
 * Check command - Token limit validation
 */

import { parseArgs } from "node:util";
import { readFileSync, existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import type { 
  ValidationResult, 
  ValidationReport
} from "./types.js";
import { 
  estimateTokens,
  normalizePath,
  DEFAULT_SCAN_DIRS,
  getErrorMessage
} from "./types.js";
import { loadConfig, getLimitForFile, findMarkdownFiles } from "./utils.js";

function validateFiles(rootDir: string, filesToCheck?: string[]): ValidationReport {
  const config = loadConfig(rootDir);
  const files = filesToCheck ?? findMarkdownFiles(rootDir);
  const results: ValidationResult[] = [];
  const skipped: string[] = [];
  
  for (const file of files) {
    if (!existsSync(file)) {
      skipped.push(file);
      continue;
    }
    
    try {
      const relativePath = normalizePath(relative(rootDir, file));
      const content = readFileSync(file, "utf-8");
      const tokens = estimateTokens(content);
      const { limit, pattern } = getLimitForFile(relativePath, config, rootDir);
      
      results.push({
        file: relativePath,
        tokens,
        limit,
        exceeded: tokens > limit,
        pattern
      });
    } catch (error) {
      console.error(`⚠️  Failed to process ${file}: ${getErrorMessage(error)}`);
      skipped.push(file);
    }
  }
  
  if (skipped.length > 0 && process.env.DEBUG) {
    console.error(`⚠️  Skipped ${skipped.length} file(s): ${skipped.join(", ")}`);
  } else if (skipped.length > 0) {
    console.error(`⚠️  Skipped ${skipped.length} file(s)`);
  }
  
  return {
    timestamp: new Date().toISOString(),
    totalFiles: results.length,
    exceededCount: results.filter(r => r.exceeded).length,
    results
  };
}

function formatMarkdownReport(report: ValidationReport): string {
  const lines: string[] = [
    "## 📊 Token Limit Check Report\n",
    `**Checked:** ${report.totalFiles} files`,
    `**Exceeded:** ${report.exceededCount} files\n`
  ];
  
  if (report.exceededCount > 0) {
    lines.push(
      "### ⚠️ Files Exceeding Token Limits\n",
      "| File | Tokens | Limit | Over By |",
      "|------|--------|-------|---------|"
    );
    
    for (const result of report.results.filter(r => r.exceeded)) {
      const overBy = result.tokens - result.limit;
      lines.push(`| \`${result.file}\` | ${result.tokens} | ${result.limit} | +${overBy} |`);
    }
    
    lines.push("\n> Consider moving content to `references/` subdirectories.");
  } else {
    lines.push("### ✅ All files within token limits");
  }
  
  return lines.join("\n");
}

function printConsoleReport(report: ValidationReport): void {
  console.log("\n📊 Token Limit Check");
  console.log("═".repeat(60));
  console.log(`Files Checked: ${report.totalFiles}`);
  console.log(`Files Exceeded: ${report.exceededCount}`);
  console.log("");
  
  if (report.exceededCount > 0) {
    console.log("⚠️  Files exceeding limits:");
    console.log("─".repeat(60));
    
    for (const result of report.results.filter(r => r.exceeded)) {
      const overBy = result.tokens - result.limit;
      console.log(`  ❌ ${result.file}`);
      console.log(`     ${result.tokens} tokens (limit: ${result.limit}, over by ${overBy})`);
    }
    
    console.log("\n💡 Tip: Move detailed content to references/ subdirectories");
  } else {
    console.log("✅ All files within token limits!");
  }
  
  console.log("");
}

function getStagedMarkdownFiles(rootDir: string): string[] {
  try {
    const output = execFileSync("git", [
      "-C",
      rootDir,
      "diff",
      "--cached",
      "--name-only",
      "--diff-filter=ACMRTUXB"
    ], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"]
    });

    return output
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .filter(file => file.toLowerCase().endsWith(".md"))
      .map(file => resolve(rootDir, file));
  } catch {
    return [];
  }
}

export function check(rootDir: string, args: string[]): void {
  const { values, positionals } = parseArgs({
    args,
    options: {
      markdown: { type: "boolean", default: false },
      json: { type: "boolean", default: false },
      staged: { type: "boolean", default: false }
    },
    strict: false,
    allowPositionals: true
  });

  const markdownOutput = values.markdown ?? false;
  const jsonOutput = values.json ?? false;
  const stagedOnly = values.staged ?? false;
  
  let filesToCheck: string[] | undefined;
  if (positionals.length > 0) {
    filesToCheck = positionals.map(f => resolve(rootDir, f));
  } else if (stagedOnly) {
    filesToCheck = getStagedMarkdownFiles(rootDir);
  } else {
    // Default: scan only skill/agent directories
    const allFiles: string[] = [];
    for (const dir of DEFAULT_SCAN_DIRS) {
      const fullPath = join(rootDir, dir);
      try {
        allFiles.push(...findMarkdownFiles(fullPath));
      } catch {
        // Skip if directory doesn't exist
      }
    }
    filesToCheck = allFiles.length > 0 ? allFiles : undefined;
  }
  
  const report = validateFiles(rootDir, filesToCheck);
  
  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
  } else if (markdownOutput) {
    console.log(formatMarkdownReport(report));
  } else {
    printConsoleReport(report);
  }

  if (report.exceededCount > 0) {
    process.exitCode = 1;
  }
}
