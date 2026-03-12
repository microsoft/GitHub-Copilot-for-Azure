#!/usr/bin/env tsx

/**
 * Build Dashboard Data
 *
 * Collects real test data from GitHub Actions runs and produces
 * static JSON files for the dashboard frontend.
 *
 * Usage:
 *   npx tsx scripts/build-data.ts [--days 7]
 *
 * Output:
 *   public/data/summary.json
 *   public/data/trends.json
 *   public/data/runs.json
 *   public/data/test-history.json  (keyed by test name)
 *   public/data/raw-results.json   (full collected data)
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { fileURLToPath } from "url";
import { parseJunitXml } from "./parse-junit.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO = "microsoft/GitHub-Copilot-for-Azure";
const WORKFLOW_FILE = "test-all-integration.yml";
const ARTIFACT_PREFIX = "integration-report-";
const DATA_DIR = path.resolve(__dirname, "../public/data");
const TESTS_DIR = path.resolve(__dirname, "../../tests");

// --- GitHub CLI helpers ---

function gh(args: string): string {
  return execSync(`gh ${args}`, {
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
  }).trim();
}

// --- Types ---

interface RunMeta {
  databaseId: number;
  number: number;
  event: string;
  headBranch: string;
  headSha: string;
  status: string;
  conclusion: string;
  createdAt: string;
  updatedAt: string;
  url: string;
}

interface JobMeta {
  databaseId: number;
  name: string;
  conclusion: string;
  startedAt: string;
  completedAt: string;
  url: string;
}

interface CollectedTest {
  runId: number;
  runDate: string;
  runUrl: string;
  jobId: number | null;
  jobUrl: string | null;
  skill: string;
  suiteName: string;
  testName: string;
  classname: string;
  testType: string;
  status: string;
  durationSecs: number;
  failureMessage: string | null;
}

// --- Test source file parsing ---

interface TestMeta {
  prompt: string | null;
  testCategory: string | null; // e.g. "skill-invocation" or "azure-rbac"
  assertions: string[];        // e.g. ["isSkillInvoked", "AcrPull keyword", "CLI command"]
  expectedKeywords: string[];  // keywords from doesAssistantMessageIncludeKeyword
  expectedTools: string[];     // tools from areToolCallsSuccess
  sourceFile: string;          // relative path: tests/{skill}/integration.test.ts
}

/**
 * Parse integration test source files to extract prompt text and assertions
 * for each test name.
 */
function parseTestSources(): Map<string, TestMeta> {
  const metaMap = new Map<string, TestMeta>();

  if (!fs.existsSync(TESTS_DIR)) {
    console.warn(`  ⚠️  Tests directory not found: ${TESTS_DIR}`);
    return metaMap;
  }

  // Recursively find all integration.test.ts files
  function findTestFiles(dir: string): string[] {
    const results: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== "_template") {
        results.push(...findTestFiles(full));
      } else if (entry.name === "integration.test.ts") {
        results.push(full);
      }
    }
    return results;
  }

  const testFiles = findTestFiles(TESTS_DIR);

  for (const testFile of testFiles) {
    const source = fs.readFileSync(testFile, "utf-8");
    const relPath = path.relative(path.resolve(TESTS_DIR, ".."), testFile).replace(/\\/g, "/");

    // Track current describe block for test category
    let currentCategory: string | null = null;

    const lines = source.split("\n");
    let i = 0;

    while (i < lines.length) {
      // Track describe blocks for category
      const describeMatch = lines[i].match(/describe\(["'`]([^"'`]+)["'`]/);
      if (describeMatch) {
        const label = describeMatch[1];
        if (!label.includes("Integration Tests")) {
          currentCategory = label;
        }
      }

      // Match helper function calls like defineInvocationTest(agent, "label", "prompt")
      const helperMatch = lines[i].match(/defineInvocationTest\s*\(/);
      if (helperMatch) {
        // Collect the full call by reading until closing ");"
        let callText = "";
        for (let j = i; j < lines.length; j++) {
          callText += lines[j] + "\n";
          if (lines[j].includes(");")) break;
        }
        // Extract label (2nd string arg) and prompt (3rd string arg)
        const stringArgs = [...callText.matchAll(/["']([^"']+)["']/g)].map(m => m[1]);
        if (stringArgs.length >= 2) {
          const testLabel = stringArgs[0];
          const promptText = stringArgs[1];
          metaMap.set(testLabel, {
            prompt: promptText,
            testCategory: currentCategory,
            assertions: ["Skill invocation"],
            expectedKeywords: [],
            expectedTools: [],
            sourceFile: relPath,
          });
        }
      }

      // Match test/it declarations
      const testMatch = lines[i].match(/(?:test|it)\(["'`]([^"'`]+)["'`]/);
      if (testMatch) {
        const testName = testMatch[1];

        // Scan forward for prompt and assertions within this test block
        let prompt: string | null = null;
        const assertions: string[] = [];
        const expectedKeywords: string[] = [];
        const expectedTools: string[] = [];
        let braceDepth = 0;
        let j = i;

        // Find the opening brace of the test function
        while (j < lines.length && !lines[j].includes("{")) j++;

        // Scan the test body
        for (; j < lines.length; j++) {
          const line = lines[j];
          braceDepth += (line.match(/{/g) || []).length;
          braceDepth -= (line.match(/}/g) || []).length;

          // Extract prompt (first one only)
          if (!prompt) {
            // Match prompt: "..." (object property) or const prompt = "..." (variable)
            const promptMatch = line.match(/prompt[:\s=]+\s*["'`](.+?)["'`]/);
            if (promptMatch) {
              prompt = promptMatch[1];
            } else {
              // Handle multi-line: `const prompt =` on one line, string on next
              const assignMatch = line.match(/(?:const|let|var)\s+prompt\s*=\s*$/);
              if (assignMatch && j + 1 < lines.length) {
                const nextLine = lines[j + 1].trim();
                const strMatch = nextLine.match(/^["'`](.+?)["'`]/);
                if (strMatch) prompt = strMatch[1];
              }
            }
          }

          // Extract keyword assertions
          const kwMatch = line.match(/doesAssistantMessageIncludeKeyword\(\s*\w+,\s*["'`](.+?)["'`]/);
          if (kwMatch) expectedKeywords.push(kwMatch[1]);

          // Extract tool assertions
          const toolMatch = line.match(/areToolCallsSuccess\(\s*\w+,\s*["'`](.+?)["'`]/);
          if (toolMatch) expectedTools.push(toolMatch[1]);

          if (line.includes("isSkillInvoked")) assertions.push("Skill invocation");
          if (line.includes("doesWorkspaceFileIncludePattern")) assertions.push("Workspace file pattern");

          if (braceDepth <= 0 && j > i) break;
        }

        for (const kw of expectedKeywords) assertions.push(`Keyword: "${kw}"`);
        for (const tool of expectedTools) assertions.push(`Tool: ${tool}`);

        // Don't overwrite if helper already set this test name
        if (!metaMap.has(testName)) {
          metaMap.set(testName, {
            prompt,
            testCategory: currentCategory,
            assertions,
            expectedKeywords,
            expectedTools,
            sourceFile: relPath,
          });
        }
      }

      i++;
    }
  }

  return metaMap;
}

// --- Data collection ---

function listRuns(days: number): RunMeta[] {
  const raw = gh(
    `run list --repo ${REPO} --workflow ${WORKFLOW_FILE} --limit 50 ` +
      `--json databaseId,number,event,headBranch,headSha,status,conclusion,createdAt,updatedAt,url`
  );
  const all: RunMeta[] = JSON.parse(raw);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  return all.filter((r) => r.createdAt >= cutoff && r.status === "completed");
}

function getJobs(runId: number): JobMeta[] {
  const raw = gh(`run view ${runId} --repo ${REPO} --json jobs`);
  return (JSON.parse(raw) as { jobs: JobMeta[] }).jobs;
}

function extractSkillFromJobName(name: string): string | null {
  // "Integration – azure-rbac" or unicode-mangled variants
  const m = name.match(/Integration\s+.\s+(.+)$/) || name.match(/Integration\s+[–-]\s+(.+)$/);
  return m ? m[1].trim() : null;
}

function collectRun(run: RunMeta): CollectedTest[] {
  const results: CollectedTest[] = [];
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dash-"));

  try {
    // Get jobs
    const jobs = getJobs(run.databaseId);
    const jobsBySkill = new Map<string, JobMeta>();
    for (const j of jobs) {
      const skill = extractSkillFromJobName(j.name);
      if (skill) jobsBySkill.set(skill, j);
    }

    // Get artifacts list
    const raw = gh(`api repos/${REPO}/actions/runs/${run.databaseId}/artifacts`);
    const artifacts: { name: string; id: number }[] = JSON.parse(raw).artifacts;

    for (const artifact of artifacts) {
      if (!artifact.name.startsWith(ARTIFACT_PREFIX)) continue;

      const dir = path.join(tmpDir, artifact.name);
      try {
        execSync(
          `gh run download ${run.databaseId} --repo ${REPO} --name ${artifact.name} --dir "${dir}"`,
          { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 }
        );
      } catch {
        console.error(`    ⚠️  Failed to download ${artifact.name}`);
        continue;
      }

      const junitPath = path.join(dir, "junit.xml");
      if (!fs.existsSync(junitPath)) continue;

      const xml = fs.readFileSync(junitPath, "utf-8");
      const parsed = parseJunitXml(xml);

      for (const suite of parsed.suites) {
        for (const tc of suite.testcases) {
          const job = jobsBySkill.get(tc.skill);
          results.push({
            runId: run.databaseId,
            runDate: run.createdAt,
            runUrl: run.url,
            jobId: job?.databaseId ?? null,
            jobUrl: job?.url ?? null,
            skill: tc.skill,
            suiteName: tc.classname,
            testName: tc.name,
            classname: tc.classname,
            testType: tc.testType,
            status: tc.status,
            durationSecs: tc.time,
            failureMessage: tc.failure,
          });
        }
      }
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  return results;
}

// --- Aggregation ---

interface SummaryRow {
  skill: string;
  testName: string;
  prompt: string | null;
  testType: string;
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
  trend: string[];
  assertions: string[];
  expectedKeywords: string[];
  expectedTools: string[];
  sourceFile: string | null;
  model: string;
  isSkillInvocationTest: boolean;
}

function buildSummary(allTests: CollectedTest[], testMeta: Map<string, TestMeta>): SummaryRow[] {
  const groups = new Map<string, CollectedTest[]>();
  for (const t of allTests) {
    const key = `${t.skill}|||${t.testName}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }

  const rows: SummaryRow[] = [];
  for (const [, tests] of groups) {
    // Sort by runDate ascending
    tests.sort((a, b) => a.runDate.localeCompare(b.runDate));
    const latest = tests[tests.length - 1];
    const passed = tests.filter((t) => t.status === "passed").length;
    const failed = tests.filter((t) => t.status === "failed").length;
    const errors = tests.filter((t) => t.status === "error").length;
    const skipped = tests.filter((t) => t.status === "skipped").length;
    const avgDuration =
      tests.reduce((s, t) => s + t.durationSecs, 0) / tests.length;
    const meta = testMeta.get(latest.testName);

    const isSkillInvocationTest =
      meta?.testCategory === "skill-invocation" ||
      meta?.assertions?.includes("Skill invocation") ||
      latest.testName.includes("invokes ") && latest.testName.includes(" skill for ");

    rows.push({
      skill: latest.skill,
      testName: latest.testName,
      prompt: meta?.prompt ?? null,
      testType: latest.testType,
      testCategory: meta?.testCategory ?? null,
      totalRuns: tests.length,
      passed,
      failed,
      errors,
      skipped,
      passRate: tests.length > 0 ? (passed / tests.length) * 100 : 0,
      avgDuration: Math.round(avgDuration * 10) / 10,
      avgConfidence: null,
      lastStatus: latest.status,
      lastRunDate: latest.runDate,
      trend: tests.map((t) => t.status),
      assertions: meta?.assertions ?? [],
      expectedKeywords: meta?.expectedKeywords ?? [],
      expectedTools: meta?.expectedTools ?? [],
      sourceFile: meta?.sourceFile ?? null,
      model: "claude-sonnet-4.5",
      isSkillInvocationTest,
    });
  }

  return rows.sort((a, b) => a.skill.localeCompare(b.skill) || a.testName.localeCompare(b.testName));
}

interface TrendPoint {
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

function buildTrends(allTests: CollectedTest[]): TrendPoint[] {
  const groups = new Map<string, CollectedTest[]>();
  for (const t of allTests) {
    const key = `${t.runId}|||${t.skill}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }

  const points: TrendPoint[] = [];
  for (const [, tests] of groups) {
    const first = tests[0];
    const passed = tests.filter((t) => t.status === "passed").length;
    const failed = tests.filter((t) => t.status === "failed").length;
    const errors = tests.filter((t) => t.status === "error").length;
    points.push({
      runId: first.runId,
      runDate: first.runDate,
      skill: first.skill,
      totalTests: tests.length,
      passed,
      failed,
      errors,
      passRate: tests.length > 0 ? Math.round((passed / tests.length) * 1000) / 10 : 0,
      runUrl: first.runUrl,
    });
  }

  return points.sort((a, b) => a.runDate.localeCompare(b.runDate) || a.skill.localeCompare(b.skill));
}

interface RunInfo {
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

function buildRuns(allTests: CollectedTest[], runs: RunMeta[]): RunInfo[] {
  return runs.map((r) => {
    const tests = allTests.filter((t) => t.runId === r.databaseId);
    const passed = tests.filter((t) => t.status === "passed").length;
    const failed = tests.filter((t) => t.status === "failed").length;
    return {
      id: r.databaseId,
      runNumber: r.number,
      triggerType: r.event,
      branch: r.headBranch,
      conclusion: r.conclusion,
      startedAt: r.createdAt,
      completedAt: r.updatedAt,
      htmlUrl: r.url,
      totalTests: tests.length,
      passed,
      failed,
    };
  }).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

type TestHistoryMap = Record<string, {
  runId: number;
  runDate: string;
  status: string;
  duration: number;
  confidence: number | null;
  failureMessage: string | null;
  runUrl: string;
  jobUrl: string | null;
}[]>;

function buildTestHistory(allTests: CollectedTest[]): TestHistoryMap {
  const map: TestHistoryMap = {};
  for (const t of allTests) {
    if (!map[t.testName]) map[t.testName] = [];
    map[t.testName].push({
      runId: t.runId,
      runDate: t.runDate,
      status: t.status,
      duration: Math.round(t.durationSecs * 10) / 10,
      confidence: null,
      failureMessage: t.failureMessage,
      runUrl: t.runUrl,
      jobUrl: t.jobUrl,
    });
  }
  // Sort each test's history by date descending
  for (const key of Object.keys(map)) {
    map[key].sort((a, b) => b.runDate.localeCompare(a.runDate));
  }
  return map;
}

// --- Main ---

async function main() {
  const daysArg = process.argv.includes("--days")
    ? parseInt(process.argv[process.argv.indexOf("--days") + 1], 10)
    : 7;

  console.log(`\n📊 Building dashboard data (last ${daysArg} days)...\n`);

  // Ensure output directory exists
  fs.mkdirSync(DATA_DIR, { recursive: true });

  // List runs
  const runs = listRuns(daysArg);
  console.log(`Found ${runs.length} completed runs\n`);

  // Collect test results from each run
  const allTests: CollectedTest[] = [];
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    console.log(
      `[${i + 1}/${runs.length}] Run #${run.number} (${run.event}) – ${run.createdAt.split("T")[0]}...`
    );
    try {
      const tests = collectRun(run);
      allTests.push(...tests);
      console.log(`  ✅ ${tests.length} test results\n`);
    } catch (err) {
      console.error(`  ❌ Failed: ${err}\n`);
    }
  }

  console.log(`\nTotal: ${allTests.length} test results from ${runs.length} runs\n`);

  // Parse test source files for prompt text and assertions
  console.log("Parsing test source files...");
  const testMeta = parseTestSources();
  console.log(`  Found metadata for ${testMeta.size} tests\n`);

  // Build aggregated views
  console.log("Building summary...");
  const summary = buildSummary(allTests, testMeta);

  console.log("Building trends...");
  const trends = buildTrends(allTests);

  console.log("Building runs...");
  const runsData = buildRuns(allTests, runs);

  console.log("Building test history...");
  const testHistory = buildTestHistory(allTests);

  // Write to files
  const write = (name: string, data: unknown) => {
    const p = path.join(DATA_DIR, name);
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
    console.log(`  📁 ${name} (${(fs.statSync(p).size / 1024).toFixed(1)} KB)`);
  };

  console.log("\nWriting data files:");
  write("summary.json", summary);
  write("trends.json", trends);
  write("runs.json", runsData);
  write("test-history.json", testHistory);
  write("raw-results.json", allTests);

  console.log(`\n✅ Dashboard data ready! Run 'npm run dev' to view.\n`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
