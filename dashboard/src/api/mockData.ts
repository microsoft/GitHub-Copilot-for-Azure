/**
 * Mock API responses for local development.
 * Based on real data from workflow run #22441459694.
 */

import type { TestSummary, TrendPoint, TestHistoryEntry, WorkflowRunInfo } from "./client";

const SKILLS = [
  "appinsights-instrumentation",
  "azure-ai",
  "azure-aigateway",
  "azure-compliance",
  "azure-cost-optimization",
  "azure-diagnostics",
  "azure-hosted-copilot-sdk",
  "azure-kusto",
  "azure-messaging",
  "azure-observability",
  "azure-prepare",
  "azure-rbac",
  "azure-resource-lookup",
  "azure-resource-visualizer",
  "azure-storage",
  "azure-validate",
  "entra-app-registration",
];

function randomStatus(): "passed" | "failed" {
  return Math.random() > 0.3 ? "passed" : "failed";
}

function generateTrend(baseRate: number): ("passed" | "failed")[] {
  return Array.from({ length: 7 }, () =>
    Math.random() < baseRate / 100 ? "passed" : "failed"
  );
}

const RUN_DATES = [
  "2026-02-20T12:00:00Z",
  "2026-02-21T12:00:00Z",
  "2026-02-22T12:00:00Z",
  "2026-02-23T05:00:00Z",
  "2026-02-23T12:00:00Z",
  "2026-02-24T05:00:00Z",
  "2026-02-24T12:00:00Z",
  "2026-02-25T05:00:00Z",
  "2026-02-25T08:00:00Z",
  "2026-02-25T12:00:00Z",
  "2026-02-26T05:00:00Z",
  "2026-02-26T08:00:00Z",
  "2026-02-26T12:00:00Z",
];

const TEST_NAMES: Record<string, { name: string; passRate: number }[]> = {
  "azure-rbac": [
    { name: "invokes azure-rbac skill for role recommendation prompt", passRate: 100 },
    { name: "invokes azure-rbac skill for least privilege role prompt", passRate: 85 },
    { name: "invokes azure-rbac skill for AcrPull prompt", passRate: 42 },
    { name: "recommends Storage Blob Data Reader for blob read access", passRate: 57 },
    { name: "recommends Key Vault Secrets User for secret access", passRate: 28 },
    { name: "generates CLI commands for role assignment", passRate: 42 },
    { name: "provides Bicep code for role assignment", passRate: 28 },
  ],
  "azure-ai": [
    { name: "invokes azure-ai skill for AI Search query prompt", passRate: 100 },
    { name: "invokes azure-ai skill for Azure Speech prompt", passRate: 85 },
  ],
  "azure-aigateway": [
    { name: "invokes azure-aigateway skill for API Management gateway prompt", passRate: 100 },
    { name: "invokes azure-aigateway skill for rate limiting prompt", passRate: 85 },
  ],
  "azure-prepare": [
    { name: "invokes azure-prepare skill for new web app prompt", passRate: 100 },
    { name: "invokes azure-prepare skill for add database prompt", passRate: 85 },
    { name: "generates azure.yaml for Python Flask app", passRate: 71 },
    { name: "generates Bicep for container app deployment", passRate: 57 },
    { name: "creates Dockerfile for Node.js app", passRate: 85 },
  ],
  "azure-validate": [
    { name: "invokes azure-validate skill for preflight check prompt", passRate: 100 },
    { name: "passes --environment on azd init", passRate: 71 },
    { name: "sets subscription before provision", passRate: 57 },
  ],
  "azure-deploy": [
    { name: "invokes azure-deploy skill for deployment prompt", passRate: 85 },
    { name: "runs azd up for basic web app", passRate: 42 },
  ],
  "azure-compliance": [
    { name: "invokes azure-compliance skill for security audit prompt", passRate: 100 },
    { name: "identifies non-compliant resources", passRate: 71 },
  ],
  "azure-cost-optimization": [
    { name: "invokes skill for cost optimization prompt", passRate: 100 },
    { name: "identifies orphaned resources", passRate: 85 },
    { name: "recommends rightsizing for VMs", passRate: 57 },
  ],
  "azure-diagnostics": [
    { name: "invokes azure-diagnostics for troubleshooting prompt", passRate: 85 },
    { name: "analyzes container app logs with KQL", passRate: 57 },
  ],
  "azure-observability": [
    { name: "invokes azure-observability for monitoring prompt", passRate: 100 },
    { name: "creates KQL query for error analysis", passRate: 71 },
  ],
};

// Fill in simple tests for remaining skills
for (const skill of SKILLS) {
  if (!TEST_NAMES[skill]) {
    TEST_NAMES[skill] = [
      { name: `invokes ${skill} skill for primary prompt`, passRate: 85 + Math.floor(Math.random() * 15) },
      { name: `invokes ${skill} skill for secondary prompt`, passRate: 57 + Math.floor(Math.random() * 30) },
    ];
  }
}

export function getMockSummary(): TestSummary[] {
  const results: TestSummary[] = [];
  for (const [skill, tests] of Object.entries(TEST_NAMES)) {
    for (const test of tests) {
      const trend = generateTrend(test.passRate);
      const totalRuns = 7;
      const passed = trend.filter((s) => s === "passed").length;
      results.push({
        skill,
        testName: test.name,
        prompt: null,
        testType: "integration",
        testCategory: null,
        totalRuns,
        passed,
        failed: totalRuns - passed,
        errors: 0,
        skipped: 0,
        passRate: (passed / totalRuns) * 100,
        avgDuration: 20 + Math.random() * 150,
        avgConfidence: null,
        lastStatus: trend[trend.length - 1],
        lastRunDate: RUN_DATES[RUN_DATES.length - 1],
        trend,
        assertions: [],
        expectedKeywords: [],
        expectedTools: [],
        sourceFile: null,
        model: "claude-sonnet-4.5",
        isSkillInvocationTest: test.name.startsWith("invokes "),
      });
    }
  }
  return results;
}

export function getMockTrends(): TrendPoint[] {
  const results: TrendPoint[] = [];
  for (const date of RUN_DATES) {
    for (const skill of SKILLS) {
      const tests = TEST_NAMES[skill] || [];
      const totalTests = tests.length;
      const passed = tests.filter(() => Math.random() > 0.3).length;
      results.push({
        runId: Math.floor(Math.random() * 1e10),
        runDate: date,
        skill,
        totalTests,
        passed,
        failed: totalTests - passed,
        errors: 0,
        passRate: totalTests > 0 ? (passed / totalTests) * 100 : 0,
        runUrl: `https://github.com/microsoft/GitHub-Copilot-for-Azure/actions/runs/${Math.floor(Math.random() * 1e10)}`,
      });
    }
  }
  return results;
}

export function getMockTestHistory(_testName: string): TestHistoryEntry[] {
  return RUN_DATES.map((date) => {
    const status = randomStatus();
    return {
      runId: Math.floor(Math.random() * 1e10),
      runDate: date,
      status,
      duration: 10 + Math.random() * 100,
      confidence: null,
      failureMessage:
        status === "failed"
          ? "Error: expect(received).toBe(expected) // Object.is equality\n\nExpected: true\nReceived: false"
          : null,
      runUrl: `https://github.com/microsoft/GitHub-Copilot-for-Azure/actions/runs/${Math.floor(Math.random() * 1e10)}`,
      jobUrl: `https://github.com/microsoft/GitHub-Copilot-for-Azure/actions/runs/${Math.floor(Math.random() * 1e10)}/job/${Math.floor(Math.random() * 1e10)}`,
    };
  }).reverse();
}

export function getMockRuns(): WorkflowRunInfo[] {
  return RUN_DATES.map((date, i) => {
    const totalTests = 80 + Math.floor(Math.random() * 10);
    const passed = Math.floor(totalTests * (0.55 + Math.random() * 0.3));
    return {
      id: 22400000000 + i * 40000000,
      runNumber: i + 5,
      triggerType: "schedule",
      branch: "main",
      conclusion: "success",
      startedAt: date,
      completedAt: new Date(new Date(date).getTime() + 3600000).toISOString(),
      htmlUrl: `https://github.com/microsoft/GitHub-Copilot-for-Azure/actions/runs/${22400000000 + i * 40000000}`,
      totalTests,
      passed,
      failed: totalTests - passed,
    };
  }).reverse();
}
