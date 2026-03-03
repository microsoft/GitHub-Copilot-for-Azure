#!/usr/bin/env node

/**
 * Test Results Table Generator
 * 
 * Parses JUnit XML output and displays a readable pass/fail table in the console.
 * 
 * Run with: npm run results
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { decode } from "html-entities";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPORTS_PATH = path.resolve(__dirname, "../reports/junit.xml");

// ANSI color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
};

/**
 * Parse JUnit XML (simple regex-based parser for our use case)
 */
function parseJunitXml(xmlContent) {
  const result = {
    name: "",
    totalTests: 0,
    failures: 0,
    errors: 0,
    time: 0,
    suites: []
  };

  // Parse testsuites attributes
  const testsuitesMatch = xmlContent.match(/<testsuites[^>]*>/);
  if (testsuitesMatch) {
    const attrs = testsuitesMatch[0];
    result.name = extractAttr(attrs, "name") || "Test Results";
    result.totalTests = parseInt(extractAttr(attrs, "tests") || "0", 10);
    result.failures = parseInt(extractAttr(attrs, "failures") || "0", 10);
    result.errors = parseInt(extractAttr(attrs, "errors") || "0", 10);
    result.time = parseFloat(extractAttr(attrs, "time") || "0");
  }

  // Parse each testsuite (use negative lookahead to avoid matching <testsuites>)
  const suiteRegex = /<testsuite(?!s)[^>]*>[\s\S]*?<\/testsuite>/g;
  let suiteMatch;

  while ((suiteMatch = suiteRegex.exec(xmlContent)) !== null) {
    const suiteXml = suiteMatch[0];
    const suiteAttrsMatch = suiteXml.match(/<testsuite[^>]*>/);
    if (!suiteAttrsMatch) continue;

    const suiteAttrs = suiteAttrsMatch[0];
    const suite = {
      name: extractAttr(suiteAttrs, "name") || "Unknown Suite",
      tests: parseInt(extractAttr(suiteAttrs, "tests") || "0", 10),
      failures: parseInt(extractAttr(suiteAttrs, "failures") || "0", 10),
      errors: parseInt(extractAttr(suiteAttrs, "errors") || "0", 10),
      skipped: parseInt(extractAttr(suiteAttrs, "skipped") || "0", 10),
      time: parseFloat(extractAttr(suiteAttrs, "time") || "0"),
      testcases: []
    };

    // Parse testcases within this suite
    const testcaseRegex = /<testcase[^>]*>[\s\S]*?<\/testcase>|<testcase[^/]*\/>/g;
    let testMatch;

    while ((testMatch = testcaseRegex.exec(suiteXml)) !== null) {
      const testXml = testMatch[0];
      const testAttrsMatch = testXml.match(/<testcase[^>]*>/);
      if (!testAttrsMatch) continue;

      const testAttrs = testAttrsMatch[0];
      const testcase = {
        classname: extractAttr(testAttrs, "classname") || "",
        name: decode(extractAttr(testAttrs, "name") || "Unknown Test"),
        time: parseFloat(extractAttr(testAttrs, "time") || "0"),
        status: "passed",
        failure: null
      };

      // Check for failure
      const failureMatch = testXml.match(/<failure[^>]*>([\s\S]*?)<\/failure>/);
      if (failureMatch) {
        testcase.status = "failed";
        testcase.failure = decode(failureMatch[1].trim());
      }

      // Check for error
      const errorMatch = testXml.match(/<error[^>]*>([\s\S]*?)<\/error>/);
      if (errorMatch) {
        testcase.status = "error";
        testcase.failure = decode(errorMatch[1].trim());
      }

      // Check for skipped
      if (testXml.includes("<skipped")) {
        testcase.status = "skipped";
      }

      suite.testcases.push(testcase);
    }

    result.suites.push(suite);
  }

  return result;
}

/**
 * Extract an attribute value from an XML tag string
 * Uses word boundary to avoid matching 'classname' when looking for 'name'
 */
function extractAttr(tagString, attrName) {
  const regex = new RegExp(`\\b${attrName}="([^"]*)"`, "i");
  const match = tagString.match(regex);
  return match ? match[1] : null;
}

/**
 * Format duration in human-readable format
 */
function formatDuration(seconds) {
  if (!seconds || seconds < 0 || !isFinite(seconds)) {
    return "0ms";
  }
  if (seconds < 1) {
    return `${Math.round(seconds * 1000)}ms`;
  } else if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  } else {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  }
}

/**
 * Get status icon and color
 */
function getStatusDisplay(status) {
  switch (status) {
    case "passed":
      return { icon: "✓", color: colors.green };
    case "failed":
      return { icon: "✗", color: colors.red };
    case "error":
      return { icon: "!", color: colors.red };
    case "skipped":
      return { icon: "○", color: colors.yellow };
    default:
      return { icon: "?", color: colors.dim };
  }
}

/**
 * Truncate string to max length
 */
function truncate(str, maxLen) {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 3) + "...";
}

/**
 * Pad string to length
 */
function pad(str, len, align = "left") {
  if (str.length >= len) return str;
  const padding = " ".repeat(len - str.length);
  return align === "left" ? str + padding : padding + str;
}

/**
 * Print the results table
 */
function printResultsTable(results) {
  const { green, red, yellow, cyan, bright, reset, dim, bgGreen, bgRed } = colors;

  console.log("\n");
  console.log(`${bright}╔══════════════════════════════════════════════════════════════════════════════╗${reset}`);
  console.log(`${bright}║                           TEST RESULTS SUMMARY                               ║${reset}`);
  console.log(`${bright}╚══════════════════════════════════════════════════════════════════════════════╝${reset}`);
  console.log("");

  // Summary stats
  const passed = results.totalTests - results.failures - results.errors;
  const passRate = results.totalTests > 0
    ? ((passed / results.totalTests) * 100).toFixed(1)
    : "0.0";
  const statusBg = results.failures > 0 || results.errors > 0 ? bgRed : bgGreen;
  const statusText = results.failures > 0 || results.errors > 0 ? " FAIL " : " PASS ";

  console.log(`  ${statusBg}${bright}${statusText}${reset}  ${dim}Total:${reset} ${results.totalTests}  ${green}Passed:${reset} ${passed}  ${red}Failed:${reset} ${results.failures}  ${yellow}Errors:${reset} ${results.errors}  ${dim}(${passRate}% pass rate)${reset}`);
  console.log(`  ${dim}Duration: ${formatDuration(results.time)}${reset}`);
  console.log("");

  // Table header
  const colWidths = { status: 6, test: 55, time: 10 };
  const totalWidth = colWidths.status + colWidths.test + colWidths.time + 6;

  console.log(`  ${dim}${"─".repeat(totalWidth)}${reset}`);
  console.log(`  ${bright}${pad("Status", colWidths.status)}${reset} │ ${bright}${pad("Test", colWidths.test)}${reset} │ ${bright}${pad("Time", colWidths.time, "right")}${reset}`);
  console.log(`  ${dim}${"─".repeat(totalWidth)}${reset}`);

  // Test results by suite
  for (const suite of results.suites) {
    // Suite header
    const suiteName = suite.name.replace(/\.test\.ts$/, "").replace(/\//g, " › ");
    console.log(`  ${cyan}${bright}${suiteName}${reset}`);

    for (const test of suite.testcases) {
      const { icon, color } = getStatusDisplay(test.status);
      const statusStr = `  ${color}${icon}${reset}   `;
      const testName = truncate(test.name, colWidths.test);
      const timeStr = formatDuration(test.time);

      console.log(`  ${statusStr} │ ${pad(testName, colWidths.test)} │ ${pad(timeStr, colWidths.time, "right")}`);
    }
    console.log(`  ${dim}${"─".repeat(totalWidth)}${reset}`);
  }

  // Failed tests details
  const failedTests = results.suites.flatMap(s =>
    s.testcases.filter(t => t.status === "failed" || t.status === "error")
  );

  if (failedTests.length > 0) {
    console.log("");
    console.log(`${red}${bright}FAILED TESTS:${reset}`);
    console.log("");

    for (const test of failedTests) {
      console.log(`  ${red}✗${reset} ${test.name}`);
      if (test.failure) {
        // Show first few lines of failure message
        const lines = test.failure.split("\n").slice(0, 4);
        for (const line of lines) {
          console.log(`    ${dim}${line.substring(0, 80)}${reset}`);
        }
      }
      console.log("");
    }
  }

  console.log("");
}

/**
 * Main execution
 */
function main() {
  // Check if JUnit XML exists
  if (!fs.existsSync(REPORTS_PATH)) {
    console.error(`${colors.red}Error: No test results found at ${REPORTS_PATH}${colors.reset}`);
    console.error(`${colors.dim}Run tests first with: npm run test:integration${colors.reset}`);
    process.exit(1);
  }

  const xmlContent = fs.readFileSync(REPORTS_PATH, "utf-8");
  const results = parseJunitXml(xmlContent);

  printResultsTable(results);

  // Exit with appropriate code
  process.exit(results.failures > 0 || results.errors > 0 ? 1 : 0);
}

// Run main when executed directly (ESM equivalent of require.main === module)
if (process.argv[1] === __filename) {
  main();
}

export { parseJunitXml, printResultsTable };
