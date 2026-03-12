/**
 * API client for the Integration Test Dashboard.
 *
 * In production: fetches from Azure Functions API endpoints.
 * In development: reads pre-built static JSON files from /data/.
 * Run `npm run build-data` to collect real data from GitHub Actions.
 */

const API_BASE = "/api";
const DATA_BASE = "/data";
// Use static JSON files unless an API backend is configured
const USE_STATIC = !import.meta.env.VITE_USE_API;

export interface TestSummary {
  skill: string;
  testName: string;
  prompt: string | null;
  testType: "integration" | "trigger";
  testCategory: string | null;
  totalRuns: number;
  passed: number;
  failed: number;
  errors: number;
  skipped: number;
  passRate: number;
  avgDuration: number;
  avgConfidence: number | null;
  lastStatus: string;
  lastRunDate: string;
  trend: ("passed" | "failed" | "error" | "skipped")[];
  assertions: string[];
  expectedKeywords: string[];
  expectedTools: string[];
  sourceFile: string | null;
  model: string;
  isSkillInvocationTest: boolean;
}

export interface TrendPoint {
  runId: number;
  runDate: string;
  skill: string;
  totalTests: number;
  passed: number;
  failed: number;
  errors: number;
  passRate: number;
  runUrl: string;
}

export interface TestHistoryEntry {
  runId: number;
  runDate: string;
  status: string;
  duration: number;
  confidence: number | null;
  failureMessage: string | null;
  runUrl: string;
  jobUrl: string | null;
}

export interface WorkflowRunInfo {
  id: number;
  runNumber: number;
  triggerType: string;
  branch: string;
  conclusion: string;
  startedAt: string;
  completedAt: string;
  htmlUrl: string;
  totalTests: number;
  passed: number;
  failed: number;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

let _testHistoryCache: Record<string, TestHistoryEntry[]> | null = null;

let _summaryCache: TestSummary[] | null = null;

export async function getSummary(days = 7): Promise<TestSummary[]> {
  if (USE_STATIC) {
    if (!_summaryCache) {
      _summaryCache = await fetchJson<TestSummary[]>(`${DATA_BASE}/summary.json`);
    }
    return _summaryCache;
  }
  return fetchJson<TestSummary[]>(`${API_BASE}/summary?days=${days}`);
}

export async function getTestSummary(testName: string): Promise<TestSummary | null> {
  const all = await getSummary();
  return all.find((t) => t.testName === testName) || null;
}

export async function getTests(skill: string): Promise<TestSummary[]> {
  const all = await getSummary();
  return all.filter((t) => t.skill === skill);
}

export async function getTestHistory(
  testName: string,
  days = 7
): Promise<TestHistoryEntry[]> {
  if (USE_STATIC) {
    if (!_testHistoryCache) {
      _testHistoryCache = await fetchJson<Record<string, TestHistoryEntry[]>>(
        `${DATA_BASE}/test-history.json`
      );
    }
    return _testHistoryCache[testName] || [];
  }
  return fetchJson<TestHistoryEntry[]>(
    `${API_BASE}/test-history?test_name=${encodeURIComponent(testName)}&days=${days}`
  );
}

export async function getTrends(days = 7): Promise<TrendPoint[]> {
  if (USE_STATIC) return fetchJson<TrendPoint[]>(`${DATA_BASE}/trends.json`);
  return fetchJson<TrendPoint[]>(`${API_BASE}/trends?days=${days}`);
}

export async function getRuns(days = 7): Promise<WorkflowRunInfo[]> {
  if (USE_STATIC) return fetchJson<WorkflowRunInfo[]>(`${DATA_BASE}/runs.json`);
  return fetchJson<WorkflowRunInfo[]>(`${API_BASE}/runs?days=${days}`);
}
