#!/usr/bin/env tsx

/**
 * Test Reports Generator
 * 
 * Reads all markdown files of test results for a skill and generates:
 * 1. ONE consolidated report per subdirectory
 * 2. ONE per-skill report aggregating all test results for the specified skill
 * 
 * Usage:
 *   npm run report -- --skill <skill-name> # Process most recent test run for a skill
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { useAgentRunner, type TestConfig } from "../utils/agent-runner";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPORTS_PATH = path.resolve(__dirname, "../reports");
const TEMPLATE_PATH = path.resolve(__dirname, "report-template.md");
const AGGREGATED_TEMPLATE_PATH = path.resolve(__dirname, "aggregated-template-per-skill.md");

// Constants
const TEST_RUN_PREFIX = "test-run-";
const REPORT_SUFFIX = "-report.md";
const CONSOLIDATED_REPORT_SUFFIX = "-consolidated-report.md";
const SKILL_REPORT_SUFFIX = "-SKILL-REPORT.md";
const agent = useAgentRunner();

/**
 * Parse command-line arguments.
 * Supports: --skill <skill-name> (required)
 */
function parseArgs(argv: string[]): { skill: string } {
  const args = argv.slice(2);
  let skill: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--skill" && i + 1 < args.length) {
      skill = args[++i];
    }
  }

  if (!skill) {
    console.error("Error: --skill <skill-name> is required");
    console.error("Usage: npm run report -- --skill <skill-name>");
    process.exit(1);
  }

  return { skill };
}

/**
 * Extract the skill name from a subdirectory name.
 * Subdirectory names follow the pattern: {skill-name}-{TestSuite}_{test-details}
 * e.g., "azure-deploy-Integration_Tests_static-web-apps-deploy_creates_portfolio"
 * The skill name is the portion before the first occurrence of a known test suite marker.
 */
function extractSkillName(subdirName: string): string | undefined {
  // Match everything before -Integration_Tests, -Unit_Tests, -Triggers_Tests, etc.
  const match = subdirName.match(/^(.+?)-(Integration_Tests|Unit_Tests|Triggers_Tests|E2E_Tests)/);
  return match ? match[1] : undefined;
}

/**
 * Filter subdirectories belonging to a specific skill.
 */
function filterSubdirectoriesBySkill(subdirectories: string[], skill: string): string[] {
  return subdirectories.filter(subdir => {
    const subdirName = path.basename(subdir);
    const skillName = extractSkillName(subdirName);
    return skillName === skill;
  });
}

/**
 * Get the most recent test run directory
 */
function getMostRecentTestRun(): string | undefined {
  const entries = fs.readdirSync(REPORTS_PATH, { withFileTypes: true });

  const testRuns = entries
    .filter(entry => entry.isDirectory() && entry.name.startsWith(TEST_RUN_PREFIX))
    .map(entry => entry.name)
    .sort()
    .reverse();

  return testRuns.length > 0 ? testRuns[0] : undefined;
}

/**
 * Process a single subdirectory - generate ONE consolidated report for all .md files in it
 */
async function processSubdirectory(subdirPath: string, reportTemplate: string): Promise<string | null> {
  const subdirName = path.basename(subdirPath);

  // Find all markdown files in this subdirectory (non-recursive)
  const markdownFiles: string[] = [];
  const entries = fs.readdirSync(subdirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".md") && !entry.name.endsWith(REPORT_SUFFIX)) {
      markdownFiles.push(path.join(subdirPath, entry.name));
    }
  }

  if (markdownFiles.length === 0) {
    console.log(`  ⚠️  No markdown files found in ${subdirName}, skipping...`);
    return null;
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

  console.log("    Generating report...");

  // Use agent runner to generate consolidated report for this subdirectory
  const config: TestConfig = {
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

  const agentMetadata = await agent.run(config);

  // Extract assistant messages from events
  const assistantMessages: string[] = [];
  for (const event of agentMetadata.events) {
    if (event.type === "assistant.message" && event.data.content) {
      assistantMessages.push(event.data.content as string);
    }
  }

  // Save the consolidated report in the subdirectory
  const outputPath = path.join(subdirPath, `${subdirName}${CONSOLIDATED_REPORT_SUFFIX}`);
  const reportContent = assistantMessages.join("\n\n");
  fs.writeFileSync(outputPath, reportContent, "utf-8");

  console.log(`    ✅ Generated: ${subdirName}${CONSOLIDATED_REPORT_SUFFIX}`);

  return outputPath;
}

function getSkillReportFileName(runName: string, skill: string) {
  return `${runName}-${skill}${SKILL_REPORT_SUFFIX}`;
}

/**
 * Generate a per-skill aggregated report from subdirectory reports belonging to that skill.
 */
async function generateSkillReport(reportPaths: string[], runPath: string, runName: string, skill: string): Promise<void> {
  console.log(`\n\n📊 Generating per-skill report for "${skill}" from ${reportPaths.length} test report(s)...\n`);

  // Read all generated reports for this skill
  let allReportsContent = "";
  for (const reportPath of reportPaths) {
    const subdirName = path.basename(path.dirname(reportPath));
    const content = fs.readFileSync(reportPath, "utf-8");

    console.log(`  Reading: ${subdirName} report...`);

    allReportsContent += `\n# ${subdirName}\n\n${content}\n\n---\n\n`;
  }

  console.log("\n  Generating skill report...");

  // Load the per-skill aggregated report template
  const aggregatedTemplate = fs.readFileSync(AGGREGATED_TEMPLATE_PATH, "utf-8");

  const config: TestConfig = {
    prompt: `You are a per-skill test report generator. You will receive multiple individual test reports that all belong to the skill "${skill}", and you must combine them into one comprehensive per-skill summary.

CRITICAL: Output ONLY the markdown report itself. Do NOT include any preamble, explanations, or meta-commentary about what you're doing.

## Your Task

Create a per-skill report for the skill "${skill}" that aggregates all the individual test reports below. The report MUST follow the exact structure and formatting of the template below.

## Report Template

${aggregatedTemplate}

---

## Individual Test Reports for Skill "${skill}"

${allReportsContent}

---

OUTPUT THE SKILL REPORT NOW (starting with the # heading):`,
    systemPrompt: {
      mode: "append",
      content: "**Important**: Skills and MCP tools are different. When summarizing statistics related to skills, don't count MCP tool invocations. Skills are explicitly called out as skills in the context. MCP servers appear to be regular tool calls except that they are from an MCP server."
    }
  };

  const agentMetadata = await agent.run(config);

  // Extract assistant messages from events
  const assistantMessages: string[] = [];
  for (const event of agentMetadata.events) {
    if (event.type === "assistant.message" && event.data.content) {
      assistantMessages.push(event.data.content as string);
    }
  }

  // Save the skill report at the root of the test run
  const outputPath = path.join(runPath, getSkillReportFileName(runName, skill));
  const reportContent = assistantMessages.join("\n\n");
  fs.writeFileSync(outputPath, reportContent, "utf-8");

  console.log(`\n  ✅ Generated skill report: ${getSkillReportFileName(runName, skill)}`);
}

/**
 * Process a test run directory - generate ONE consolidated report per subdirectory,
 * then generate a per-skill report for the specified skill.
 */
async function processTestRun(runPath: string, skill: string): Promise<void> {
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

  // Validate template exists
  if (!fs.existsSync(TEMPLATE_PATH)) {
    console.error(`Error: Template not found at ${TEMPLATE_PATH}`);
    process.exit(1);
  }

  // Load the report template once
  const reportTemplate = fs.readFileSync(TEMPLATE_PATH, "utf-8");

  // Find all subdirectories in the test run
  const entries = fs.readdirSync(runPath, { withFileTypes: true });
  let subdirectories = entries
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(runPath, entry.name));

  // Filter subdirectories by skill
  subdirectories = filterSubdirectoriesBySkill(subdirectories, skill);
  if (subdirectories.length === 0) {
    console.error(`Error: No test results found for skill "${skill}" in: ${runPath}`);
    process.exit(1);
  }
  console.log(`Found ${subdirectories.length} test(s) for skill "${skill}"\n`);

  // Process each subdirectory and collect report paths
  const generatedReports: string[] = [];
  for (const subdir of subdirectories) {
    const reportPath = await processSubdirectory(subdir, reportTemplate);
    if (reportPath) {
      generatedReports.push(reportPath);
    }
  }

  console.log(`\n✅ Processed ${generatedReports.length} subdirectories`);

  // Generate a per-skill report
  if (generatedReports.length > 0) {
    await generateSkillReport(generatedReports, runPath, runName, skill);
    console.log(`\n✅ Skill report for "${skill}" generated!`);
  }

  console.log("\nReport generation complete.");
}

// Main execution
async function main() {
  const { skill } = parseArgs(process.argv);

  // Use the most recent test run
  const mostRecent = getMostRecentTestRun();
  if (!mostRecent) {
    console.error("Error: No test run directories found");
    process.exit(1);
  }
  console.log(`Using most recent test run: ${mostRecent}`);

  const targetPath = path.join(REPORTS_PATH, mostRecent);
  console.log(`Generating report for skill: ${skill}`);

  await processTestRun(targetPath, skill);
}

main().catch(error => {
  console.error("Error:", error);
  process.exit(1);
});
