export function normalizeTestName(skillName: string, testName: string) {
  // Downstream data processing use the test name as Azure Storage blob names
  // We need to replace unsupported patterns withs supported patterns. 
  testName = testName.replace(/\s+/g, "_").replace(/[:<>|*?]/g, "_");
  if (!testName.startsWith(`${skillName}_`)) {
    testName = `${skillName}_${testName}`;
  }
  return testName;
}