#!/usr/bin/env tsx

/**
 * Test Reports Generator
 * 
 * Reads all markdown files in each subdirectory and generates ONE consolidated report per subdirectory.
 * 
 * Usage:
 *   npm run reports              # Process most recent test run
 *   npm run reports <path>       # Process specific test run
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { run } from "../utils/agent-runner";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPORTS_PATH = path.resolve(__dirname, "../reports");
const TEMPLATE_PATH = path.resolve(__dirname, "report-template.md");

/**
 * Get the most recent test run directory
 */
function getMostRecentTestRun(): string | undefined {
  const entries = fs.readdirSync(REPORTS_PATH, { withFileTypes: true });

  const testRuns = entries
    .filter(entry => entry.isDirectory() && entry.name.startsWith("test-run-"))
    .map(entry => entry.name)
    .sort()
    .reverse();

  return testRuns.length > 0 ? testRuns[0] : undefined;
}

/**
 * Process a single subdirectory - generate ONE consolidated report for all .md files in it
 */
async function processSubdirectory(subdirPath: string, reportTemplate: string): Promise<void> {
  const subdirName = path.basename(subdirPath);
  
  // Find all markdown files in this subdirectory (non-recursive)
  const markdownFiles: string[] = [];
  const entries = fs.readdirSync(subdirPath, { withFileTypes: true });
  
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".md") && !entry.name.endsWith("-report.md")) {
      markdownFiles.push(path.join(subdirPath, entry.name));
    }
  }

  if (markdownFiles.length === 0) {
    console.log(`  ⚠️  No markdown files found in ${subdirName}, skipping...`);
    return;
  }

  console.log(`\n  Processing: ${subdirName} (${markdownFiles.length} file(s))`);

  // Consolidate all markdown content from this subdirectory
  let consolidatedContent = "";
  for (const mdFile of markdownFiles) {
    const fileName = path.basename(mdFile, ".md");
    const content = fs.readFileSync(mdFile, "utf-8");
    
    console.log(`    Reading: ${fileName}...`);
    
    consolidatedContent += `\n## ${fileName}\n\n${content}\n`;
  }

  console.log(`    Generating report...`);

  // Use agent runner to generate consolidated report for this subdirectory
  const config = {
    prompt: `You are a test report generator. Your job is to read test data and output a formatted markdown report.

CRITICAL: Output ONLY the markdown report itself. Do NOT include any preamble, explanations, or meta-commentary about what you're doing.

Here is the template to follow:

${reportTemplate}

---

## Test Results Data

${consolidatedContent}

---

OUTPUT THE REPORT NOW (starting with the # heading):`
  };

  const agentMetadata = await run(config);

  // Extract assistant messages from events
  const assistantMessages: string[] = [];
  for (const event of agentMetadata.events) {
    if (event.type === "assistant.message" && event.data.content) {
      assistantMessages.push(event.data.content as string);
    }
  }

  // Save the consolidated report in the subdirectory
  const outputPath = path.join(subdirPath, `${subdirName}-consolidated-report.md`);
  const reportContent = assistantMessages.join("\n\n");
  fs.writeFileSync(outputPath, reportContent, "utf-8");
  
  console.log(`    ✅ Generated: ${subdirName}-consolidated-report.md`);
}

/**
 * Process a test run directory - generate ONE consolidated report per subdirectory
 */
async function processTestRun(runPath: string): Promise<void> {
  if (!fs.existsSync(runPath)) {
    console.error(`Error: Path not found: ${runPath}`);
    process.exit(1);
  }

  if (!fs.statSync(runPath).isDirectory()) {
    console.error("Error: Path must be a directory");
    process.exit(1);
  }

  const runName = path.basename(runPath);
  console.log(`\nProcessing test run: ${runName}\n`);

  // Load the report template once
  const reportTemplate = fs.readFileSync(TEMPLATE_PATH, "utf-8");

  // Find all subdirectories in the test run
  const entries = fs.readdirSync(runPath, { withFileTypes: true });
  const subdirectories = entries
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(runPath, entry.name));

  if (subdirectories.length === 0) {
    console.error(`Error: No subdirectories found in: ${runPath}`);
    process.exit(1);
  }

  console.log(`Found ${subdirectories.length} subdirectorie(s)\n`);

  // Process each subdirectory
  let reportCount = 0;
  for (const subdir of subdirectories) {
    await processSubdirectory(subdir, reportTemplate);
    reportCount++;
  }

  console.log(`\n✅ Processed ${reportCount} subdirectorie(s)`);
  console.log("\nReport generation complete.");
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  let targetPath: string;

  if (args.length === 0) {
    // No args - use most recent run
    const mostRecent = getMostRecentTestRun();
    if (!mostRecent) {
      console.error("Error: No test run directories found");
      process.exit(1);
    }
    targetPath = path.join(REPORTS_PATH, mostRecent);
    console.log(`Using most recent test run: ${mostRecent}`);
  } else {
    // Use provided argument
    targetPath = path.isAbsolute(args[0]) ? args[0] : path.join(REPORTS_PATH, args[0]);
  }

  await processTestRun(targetPath);
}

main().catch(error => {
  console.error("Error:", error);
  process.exit(1);
});
