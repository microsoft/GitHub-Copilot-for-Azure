#!/usr/bin/env tsx

/**
 * Test Reports Generator
 * 
 * Reads agent runner test results and uses Copilot to summarize them.
 * 
 * Usage:
 *   npm run reports              # Process most recent test run
 *   npm run reports <folder>     # Process specific test run folder
 *   npm run reports <path>       # Process test run at absolute path
 */

import * as fs from 'fs';
import * as path from 'path';
import { run } from '../utils/agent-runner';

const REPORTS_PATH = path.resolve(__dirname, '../reports');

const REPORT_TEMPLATE = `# Test Run Report Template

## Instructions for Report Generation

Generate a consolidated test run summary report following this template format.

**Your Task:**
- Combine all test results into one comprehensive report
- Calculate totals across all tests (total tests, pass/fail counts, total duration, token usage)
- Aggregate warnings and categorize them
- List all deployed URLs from all tests
- Include all skills and tools used across all tests
- Generate recommendations based on all results
- Create individual test result sections for each test
- Use proper emojis and formatting as shown in the template below
- Generate the report timestamp at the end
- Omit optional sections if no data is available

---

# Run Summary: [RUN_NAME]

**Date:** [RUN_DATE]
**Duration:** [DURATION]
**Status:** [STATUS_EMOJI] [STATUS_TEXT]
**Confidence:** [CONFIDENCE_EMOJI] [CONFIDENCE_LEVEL]

## 📝 Test Prompt
[Optional section - include if multiple test prompts]

## 📊 Result Summary

| Metric | Value |
|--------|-------|
| Total Tests | [NUMBER] |
| Passed | [NUMBER] |
| Failed | [NUMBER] |
| Pass Rate | [PERCENTAGE] |
| Total Retries | [NUMBER] |
| Total Duration | [MS]ms ([SECONDS]s) |

## 🎯 Confidence Level

**Overall Confidence:** [EMOJI] [LEVEL] ([PERCENTAGE]%)

| Factor | Impact |
|--------|--------|
| [FACTOR] | [+/- NUMBER] |

**Confidence Indicators:**
- [INDICATOR]

## ⚠️ Warnings (Non-Blocking)

> These issues were detected during execution but **did not prevent the task from completing**.
> They are documented for awareness and potential optimization.

### Warning Summary

| Category | Count | Why It Didn't Matter |
|----------|-------|---------------------|
| [CATEGORY] | [NUMBER] | [EXPLANATION] |

### Warning Details

#### [CATEGORY NAME]

**Why it didn't block success:** [EXPLANATION]

- \`[ERROR MESSAGE]\`
- *...and [NUMBER] more*

## 🎯 Success Artifacts

### 🌐 Deployed URLs

| URL | Type | Skill | Status |
|-----|------|-------|--------|
| [[URL]]([URL]) | [TYPE] | [SKILL] | ✅ |

### 📄 Generated Files & Reports
[Optional section]

| Path | Type | Skill |
|------|------|-------|
| \`[PATH]\` | [TYPE] | [SKILL] |

### 🔌 Endpoints & Connection Info
[Optional section]

| Endpoint | Type | Skill |
|----------|------|-------|
| \`[ENDPOINT]\` | [TYPE] | [SKILL] |

### 🎯 Skills Invoked

| Skill | Type | Category |
|-------|------|----------|
| \`[SKILL]\` | [TYPE] | [CATEGORY] |

### 🔧 Tools Invoked

| Tool | Count | Actions |
|------|-------|---------|
| \`[TOOL]\` | [NUMBER]x | [ACTIONS] |

### 🔌 Azure MCP Tools Used
[Optional section]

| Tool | Type | Category |
|------|------|----------|
| \`[TOOL]\` | [TYPE] | [CATEGORY] |

## 📈 Token Usage

| Metric | Value |
|--------|-------|
| Input Tokens | [NUMBER] |
| Output Tokens | [NUMBER] |
| Total Tokens | [NUMBER] |
| Avg per Test | [NUMBER] |

## 📋 Results by Skill

| Skill | Passed | Failed | Retries | Status |
|-------|--------|--------|---------|--------|
| [SKILL] | [NUMBER] | [NUMBER] | [NUMBER] | [EMOJI] |

## 📋 Individual Test Results
[Optional section for multi-test runs]

| # | Prompt | Status | Duration | Tokens | Retries |
|---|--------|--------|----------|--------|---------|
| [NUMBER] | [PROMPT_TRUNCATED] | [EMOJI] | [SECONDS]s | [NUMBER] | [NUMBER] |

### Detailed Results

<details>
<summary><b>Test [NUMBER]:</b> [PROMPT_TRUNCATED] [EMOJI]</summary>

**Prompt:** [FULL_PROMPT]

| Attribute | Value |
|-----------|-------|
| Skill | \`[SKILL]\` |
| Task Type | \`[TYPE]\` |
| Status | [EMOJI] [STATUS] |
| Outcome | [OUTCOME] |
| Duration | [MS]ms ([SECONDS]s) |
| Retries | [NUMBER] |
| Input Tokens | [NUMBER] |
| Output Tokens | [NUMBER] |
| Total Tokens | [NUMBER] |

**Deployed URLs:**
- [[TYPE]] [URL]

**Skills Invoked:**
- \`[SKILL]\` ([CATEGORY])

**Warnings:** [NUMBER] non-blocking issues detected

</details>

## 🔐 Azure Authentication

- **Azure CLI:** [STATUS]

> **Note:** [AUTH_NOTES]

## 🚀 Further Optimization

### Recommended Actions

| Priority | Action | Benefit | Effort |
|----------|--------|---------|--------|
| [EMOJI] [PRIORITY] | [ACTION] | [BENEFIT] | [EFFORT] |

### Details

1. **[ACTION_TITLE]**
   - [DETAIL]

## 📚 Learnings

### What Worked
- [ITEM]

### Areas for Improvement
- [ITEM]

### [SECTION_TITLE]
[Optional section for special notes like "Auth Notes"]

> [NOTE_CONTENT]

---
*Generated at [TIMESTAMP]*
`;

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
 * Process a test run directory
 */
async function processTestRun(runNameOrPath: string): Promise<void> {
  // Check if it's already a full path
  let runPath: string;
  if (path.isAbsolute(runNameOrPath)) {
    runPath = runNameOrPath;
  } else {
    runPath = path.join(REPORTS_PATH, runNameOrPath);
  }
  
  if (!fs.existsSync(runPath)) {
    console.error(`Error: Test run directory not found: ${runNameOrPath}`);
    process.exit(1);
  }
  
  const runName = path.basename(runPath);
  const entries = fs.readdirSync(runPath, { withFileTypes: true });
  const testDirs = entries.filter(e => e.isDirectory());
  
  // Collect all markdown content from test results
  let allContent = '';
  
  testDirs.forEach(dir => {
    const testPath = path.join(runPath, dir.name);
    const markdownFiles = fs.readdirSync(testPath).filter(f => f.endsWith('.md'));
    
    markdownFiles.forEach(mdFile => {
      const content = fs.readFileSync(path.join(testPath, mdFile), 'utf-8');
      allContent += `\n## Test: ${dir.name} (${mdFile})\n\n${content}\n\n---\n`;
    });
  });
  
  console.log(`Running agent to generate consolidated report for ${runName}...\n`);
  
  // Use agent runner to generate report
  const config = {
    prompt: `${REPORT_TEMPLATE}

---

## Test Results Data

Use the following test results data to populate the template:

${allContent}`
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
  const reportPath = path.join(runPath, 'summary.md');
  const reportContent = assistantMessages.join('\n\n');
  fs.writeFileSync(reportPath, reportContent, 'utf-8');
  console.log(`\n✅ Report generated: ${reportPath}`);
  
  console.log('\nAgent report generation complete.');
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  let targetRun: string | null;
  
  if (args.length === 0) {
    // No args - use most recent run
    targetRun = getMostRecentTestRun();
    if (!targetRun) {
      console.error('Error: No test run directories found');
      process.exit(1);
    }
  } else {
    // Use provided argument (can be full path or folder name)
    targetRun = args[0];
  }
  
  await processTestRun(targetRun);
}

if (require.main === module) {
  main().catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
}
