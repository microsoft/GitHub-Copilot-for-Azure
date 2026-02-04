#!/usr/bin/env tsx

/**
 * Test Reports Generator
 * 
 * Reads agent runner test results and uses Copilot to summarize them.
 * 
 * Usage:
 *   npm run reports              # Process most recent test run
 *   npm run reports <path>       # Process specific test run
 */

import * as fs from 'fs';
import * as path from 'path';
import { run } from '../utils/agent-runner';

const REPORTS_PATH = path.resolve(__dirname, '../reports');
const TEMPLATE_PATH = path.resolve(__dirname, 'report-template.md');

/**
 * Get the most recent test run directory
 */
function getMostRecentTestRun(): string | null {
  const entries = fs.readdirSync(REPORTS_PATH, { withFileTypes: true });
  
  const testRuns = entries
    .filter(entry => entry.isDirectory() && entry.name.startsWith('test-run-'))
    .map(entry => entry.name)
    .sort()
    .reverse();
  
  return testRuns.length > 0 ? testRuns[0] : null;
}

/**
 * Process a single markdown file and generate a report
 */
async function processMarkdownFile(mdPath: string, reportTemplate: string): Promise<void> {
  const content = fs.readFileSync(mdPath, 'utf-8');
  const fileName = path.basename(mdPath, '.md');
  
  console.log(`  Processing: ${fileName}...`);
  
  // Use agent runner to generate report
  const config = {
    prompt: `You are a test report generator. Your job is to read test data and output a formatted markdown report.

CRITICAL: Output ONLY the markdown report itself. Do NOT include any preamble, explanations, or meta-commentary about what you're doing.

Here is the template to follow:

${reportTemplate}

---

## Test Results Data

${content}

---

OUTPUT THE REPORT NOW (starting with the # heading):`
  };
  
  const agentMetadata = await run(config);
  
  // Extract assistant messages from events
  const assistantMessages: string[] = [];
  for (const event of agentMetadata.events) {
    if (event.type === 'assistant.message' && event.data.content) {
      assistantMessages.push(event.data.content as string);
    }
  }
  
  // Save the generated report
  const outputPath = mdPath.replace('.md', '-report.md');
  const reportContent = assistantMessages.join('\n\n');
  fs.writeFileSync(outputPath, reportContent, 'utf-8');
  console.log(`    ✅ Generated: ${path.basename(outputPath)}`);
}

/**
 * Process a test run directory - generate reports for all .md files
 */
async function processTestRun(runPath: string): Promise<void> {
  if (!fs.existsSync(runPath)) {
    console.error(`Error: Path not found: ${runPath}`);
    process.exit(1);
  }
  
  if (!fs.statSync(runPath).isDirectory()) {
    console.error(`Error: Path must be a directory`);
    process.exit(1);
  }
  
  const runName = path.basename(runPath);
  console.log(`\nProcessing test run: ${runName}\n`);
  
  // Load the report template once
  const reportTemplate = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
  
  // Find all markdown files recursively
  const markdownFiles: string[] = [];
  
  function findMarkdownFiles(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        findMarkdownFiles(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md') && !entry.name.endsWith('-report.md')) {
        markdownFiles.push(fullPath);
      }
    }
  }
  
  findMarkdownFiles(runPath);
  
  if (markdownFiles.length === 0) {
    console.error(`Error: No markdown files found in directory: ${runPath}`);
    process.exit(1);
  }
  
  console.log(`Found ${markdownFiles.length} markdown file(s)\n`);
  
  // Process each markdown file
  for (const mdFile of markdownFiles) {
    await processMarkdownFile(mdFile, reportTemplate);
  }
  
  console.log(`\n✅ Generated ${markdownFiles.length} report(s)`);
  console.log('\nReport generation complete.');
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  let targetPath: string;
  
  if (args.length === 0) {
    // No args - use most recent run
    const mostRecent = getMostRecentTestRun();
    if (!mostRecent) {
      console.error('Error: No test run directories found');
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

if (require.main === module) {
  main().catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
}
