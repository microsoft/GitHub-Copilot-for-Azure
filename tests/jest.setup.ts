/**
 * Jest Setup File
 * 
 * This file runs before each test file and provides:
 * - Global test utilities
 * - Custom matchers
 * - Shared mock configurations
 */

import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { TriggerMatcher, TriggerResult } from "./utils/trigger-matcher";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Make utils available globally for convenience
global.SKILLS_PATH = path.resolve(__dirname, "../plugin/skills");
global.TESTS_PATH = __dirname;

// Custom matcher: check if a skill should trigger on a prompt
expect.extend({
  toTriggerSkill(prompt: string, skillName: string, triggerMatcher: TriggerMatcher) {
    const result: TriggerResult = triggerMatcher.shouldTrigger(prompt);
    return {
      pass: result.triggered,
      message: () =>
        result.triggered
          ? `Expected prompt "${prompt}" NOT to trigger skill "${skillName}"`
          : `Expected prompt "${prompt}" to trigger skill "${skillName}". ` +
          `Confidence: ${result.confidence}. Reason: ${result.reason}`
    };
  },

  toNotTriggerSkill(prompt: string, skillName: string, triggerMatcher: TriggerMatcher) {
    const result: TriggerResult = triggerMatcher.shouldTrigger(prompt);
    return {
      pass: !result.triggered,
      message: () =>
        !result.triggered
          ? `Expected prompt "${prompt}" to trigger skill "${skillName}"`
          : `Expected prompt "${prompt}" NOT to trigger skill "${skillName}", ` +
          `but it matched with confidence ${result.confidence}`
    };
  }
});

// Suppress console output during tests unless DEBUG is set
if (!process.env.DEBUG) {
  global.console = {
    ...console,
    // Keep warn and error for test debugging
    warn: console.warn,
    error: console.error
  };
}

// Helper to get skill path
global.getSkillPath = (skillName: string): string => {
  return path.join(global.SKILLS_PATH, skillName);
};

// Helper to get test fixtures path
global.getFixturesPath = (skillName: string): string => {
  return path.join(global.TESTS_PATH, skillName, "fixtures");
};

// ── Global test results collection ──────────────────────────────
// Each worker accumulates results in-memory, then flushes to a
// per-worker JSON file in afterAll so globalTeardown can merge them.
const testResults: Record<string, { isPass: boolean; message?: string; skillInvocationRate?: number }> = {};

global.addTestResult = (data) => {
  try {
    const state = expect.getState();
    const testName = state.currentTestName ?? "unknown";
    testResults[testName] = data;
  } catch {
    // Ignore — called outside a test context
  }
};

afterAll(() => {
  if (Object.keys(testResults).length === 0) {
    return;
  }
  const reportsDir = path.join(__dirname, "reports");
  fs.mkdirSync(reportsDir, { recursive: true });
  const outFile = path.join(reportsDir, `results-${process.pid}.json`);
  fs.writeFileSync(outFile, JSON.stringify(testResults, null, 2));
});
