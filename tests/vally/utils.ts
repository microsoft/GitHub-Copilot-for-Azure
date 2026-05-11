export function normalizeTestName(skillName: string, testName: string) {
  testName = testName.replace(/\s+/g, "_");
  if (!testName.startsWith(`${skillName}_`)) {
    testName = `${skillName}_${testName}`;
  }
  return testName;
}