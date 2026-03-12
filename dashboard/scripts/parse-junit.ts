/**
 * JUnit XML Parser
 *
 * Parses JUnit XML output from Jest into structured test result objects.
 * Adapted from tests/scripts/show-test-results.js for database ingestion.
 */

export interface TestSuiteResult {
  name: string;
  tests: number;
  failures: number;
  errors: number;
  skipped: number;
  time: number;
  testcases: TestCaseResult[];
}

export interface TestCaseResult {
  classname: string;
  name: string;
  time: number;
  status: "passed" | "failed" | "error" | "skipped";
  failure: string | null;
  skill: string;
  testType: "integration" | "trigger";
}

export interface JUnitResult {
  name: string;
  totalTests: number;
  failures: number;
  errors: number;
  time: number;
  suites: TestSuiteResult[];
}

/**
 * Extract an XML attribute value. Uses word boundary to avoid
 * matching 'classname' when looking for 'name'.
 */
function extractAttr(tagString: string, attrName: string): string | null {
  const regex = new RegExp(`\\b${attrName}="([^"]*)"`, "i");
  const match = tagString.match(regex);
  return match ? match[1] : null;
}

/** Decode basic HTML entities */
function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

/**
 * Extract the skill name from a test suite or classname.
 * Convention: skill name appears before the first underscore in the suite/classname.
 * e.g., "azure-rbac_ - Integration Tests › skill-invocation" → "azure-rbac"
 */
export function extractSkillName(suiteName: string, classname: string): string {
  // Try classname first (more specific)
  const classParts = classname.split("_");
  if (classParts.length > 1 && classParts[0].length > 0) {
    return classParts[0];
  }

  // Try suite name (filepath like "azure-rbac/integration.test.ts")
  const suiteMatch = suiteName.match(/^([^/]+)\//);
  if (suiteMatch) {
    return suiteMatch[1];
  }

  return "unknown";
}

/**
 * Determine test type from suite/classname.
 * Integration tests have "integration" in the filepath.
 * Trigger tests have "triggers" in the filepath.
 */
export function detectTestType(suiteName: string): "integration" | "trigger" {
  if (suiteName.includes("triggers")) return "trigger";
  return "integration";
}

/**
 * Parse JUnit XML content into structured results.
 */
export function parseJunitXml(xmlContent: string): JUnitResult {
  const result: JUnitResult = {
    name: "",
    totalTests: 0,
    failures: 0,
    errors: 0,
    time: 0,
    suites: [],
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

  // Parse each testsuite
  const suiteRegex = /<testsuite(?!s)[^>]*>[\s\S]*?<\/testsuite>/g;
  let suiteMatch;

  while ((suiteMatch = suiteRegex.exec(xmlContent)) !== null) {
    const suiteXml = suiteMatch[0];
    const suiteAttrsMatch = suiteXml.match(/<testsuite[^>]*>/);
    if (!suiteAttrsMatch) continue;

    const suiteAttrs = suiteAttrsMatch[0];
    const suiteName = extractAttr(suiteAttrs, "name") || "Unknown Suite";
    const testType = detectTestType(suiteName);

    const suite: TestSuiteResult = {
      name: suiteName,
      tests: parseInt(extractAttr(suiteAttrs, "tests") || "0", 10),
      failures: parseInt(extractAttr(suiteAttrs, "failures") || "0", 10),
      errors: parseInt(extractAttr(suiteAttrs, "errors") || "0", 10),
      skipped: parseInt(extractAttr(suiteAttrs, "skipped") || "0", 10),
      time: parseFloat(extractAttr(suiteAttrs, "time") || "0"),
      testcases: [],
    };

    // Parse testcases within this suite
    const testcaseRegex =
      /<testcase[^>]*>[\s\S]*?<\/testcase>|<testcase[^/]*\/>/g;
    let testMatch;

    while ((testMatch = testcaseRegex.exec(suiteXml)) !== null) {
      const testXml = testMatch[0];
      const testAttrsMatch = testXml.match(/<testcase[^>]*>/);
      if (!testAttrsMatch) continue;

      const testAttrs = testAttrsMatch[0];
      const classname = decodeEntities(
        extractAttr(testAttrs, "classname") || ""
      );
      const testName = decodeEntities(
        extractAttr(testAttrs, "name") || "Unknown Test"
      );

      const testcase: TestCaseResult = {
        classname,
        name: testName,
        time: parseFloat(extractAttr(testAttrs, "time") || "0"),
        status: "passed",
        failure: null,
        skill: extractSkillName(suiteName, classname),
        testType,
      };

      // Check for failure
      const failureMatch = testXml.match(
        /<failure[^>]*>([\s\S]*?)<\/failure>/
      );
      if (failureMatch) {
        testcase.status = "failed";
        testcase.failure = decodeEntities(failureMatch[1].trim());
      }

      // Check for error
      const errorMatch = testXml.match(/<error[^>]*>([\s\S]*?)<\/error>/);
      if (errorMatch) {
        testcase.status = "error";
        testcase.failure = decodeEntities(errorMatch[1].trim());
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
