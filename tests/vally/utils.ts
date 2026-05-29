export function normalizeTestName(skillName: string, testName: string) {
  // Downstream data processing uses the test name as an Azure Storage blob name.
  // Replace unsupported characters with supported ones.
  testName = testName.replace(/\s+/g, "_").replace(/[:<>|*?]/g, "_");
  if (!testName.startsWith(`${skillName}_`)) {
    testName = `${skillName}_${testName}`;
  }
  return testName;
}