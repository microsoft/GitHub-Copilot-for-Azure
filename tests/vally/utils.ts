export function normalizeTestName(skillName: string, testName: string) {
  // Downstream data processing uses the test name as an Azure Storage blob name.
  // Replace unsupported characters with supported ones.
  const sanitizedTestName = sanitizeTestName(testName);
  let normalizedTestName = sanitizedTestName;
  if (!normalizedTestName.startsWith(`${skillName}_`)) {
    normalizedTestName = `${skillName}_${sanitizedTestName}`;
  }
  return normalizedTestName;
}

/**
 * Sanitize a string for use as the filename from a given test name
 */
export function sanitizeTestName(testName: string): string {
  return testName
    .replace(/[<>:"/\\|?*]/g, "-") // Replace invalid chars
    .replace(/\s+/g, "_")           // Replace spaces with underscores
    .replace(/-+/g, "-")            // Collapse multiple dashes
    .replace(/_+/g, "_")            // Collapse multiple underscores
    .substring(0, 200);             // Limit length
}