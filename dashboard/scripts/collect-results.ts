#!/usr/bin/env tsx

/**
 * Test Results Collector
 *
 * Downloads JUnit XML artifacts from a GitHub Actions workflow run,
 * parses them, and inserts the results into Azure PostgreSQL.
 *
 * Usage:
 *   # Collect from a specific run (used by CI workflow):
 *   npx tsx scripts/collect-results.ts --run-id 22441459694
 *
 *   # Backfill last N days:
 *   npx tsx scripts/collect-results.ts --backfill --days 7
 *
 * Environment variables:
 *   DATABASE_URL - PostgreSQL connection string
 *   GITHUB_TOKEN - GitHub token with actions:read scope (optional, uses gh CLI by default)
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { parseJunitXml, type TestCaseResult } from "./parse-junit.js";

const REPO = "microsoft/GitHub-Copilot-for-Azure";
const WORKFLOW_FILE = "test-all-integration.yml";
const ARTIFACT_PREFIX = "integration-report-";

// --- Types ---

interface WorkflowRun {
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

interface WorkflowJob {
  databaseId: number;
  name: string;
  conclusion: string;
  startedAt: string;
  completedAt: string;
  url: string;
}

interface CollectedResult {
  run: WorkflowRun;
  jobs: WorkflowJob[];
  testResults: (TestCaseResult & { runId: number; jobId: number | null })[];
}

// --- GitHub CLI helpers ---

function gh(args: string): string {
  return execSync(`gh ${args}`, { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 }).trim();
}

function ghJson<T>(args: string): T {
  const output = gh(args);
  return JSON.parse(output) as T;
}

function getWorkflowRun(runId: number): WorkflowRun {
  return ghJson<WorkflowRun>(
    `run view ${runId} --repo ${REPO} --json databaseId,number,event,headBranch,headSha,status,conclusion,createdAt,updatedAt,url`
  );
}

function getWorkflowJobs(runId: number): WorkflowJob[] {
  const result = ghJson<{ jobs: WorkflowJob[] }>(
    `run view ${runId} --repo ${REPO} --json jobs`
  );
  return result.jobs;
}

function listRecentRuns(days: number): WorkflowRun[] {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  return ghJson<WorkflowRun[]>(
    `run list --repo ${REPO} --workflow ${WORKFLOW_FILE} --limit 100 --json databaseId,number,event,headBranch,headSha,status,conclusion,createdAt,updatedAt,url`
  ).filter((r) => r.createdAt >= since);
}

function downloadArtifacts(runId: number, targetDir: string): string[] {
  // List artifacts for this run (parse JSON in Node to avoid shell quoting issues)
  const rawJson = gh(`api repos/${REPO}/actions/runs/${runId}/artifacts`);
  const response = JSON.parse(rawJson) as { artifacts: { name: string; id: number }[] };

  const downloaded: string[] = [];
  for (const artifact of response.artifacts) {
    if (!artifact.name.startsWith(ARTIFACT_PREFIX)) continue;

    const artifactDir = path.join(targetDir, artifact.name);
    try {
      gh(`run download ${runId} --repo ${REPO} --name ${artifact.name} --dir ${artifactDir}`);
      downloaded.push(artifactDir);
    } catch (err) {
      console.warn(`  ⚠️  Failed to download ${artifact.name}: ${err}`);
    }
  }

  return downloaded;
}

// --- Skill extraction from job name ---

function extractSkillFromJobName(jobName: string): string | null {
  // Job names are like "Integration – azure-rbac" or "Integration ΓÇô azure-rbac"
  const match = jobName.match(/Integration\s+[–\u2013-]\s+(.+)$/);
  if (match) return match[1].trim();

  // Also try the unicode-mangled version
  const match2 = jobName.match(/Integration\s+..\s+(.+)$/);
  if (match2) return match2[1].trim();

  return null;
}

// --- Processing ---

function processRunArtifacts(
  run: WorkflowRun,
  jobs: WorkflowJob[],
  artifactDirs: string[]
): CollectedResult {
  const jobsBySkill = new Map<string, WorkflowJob>();
  for (const job of jobs) {
    const skill = extractSkillFromJobName(job.name);
    if (skill) jobsBySkill.set(skill, job);
  }

  const allTestResults: CollectedResult["testResults"] = [];

  for (const dir of artifactDirs) {
    const junitPath = path.join(dir, "junit.xml");
    if (!fs.existsSync(junitPath)) {
      console.warn(`  ⚠️  No junit.xml in ${path.basename(dir)}`);
      continue;
    }

    const xml = fs.readFileSync(junitPath, "utf-8");
    const parsed = parseJunitXml(xml);

    for (const suite of parsed.suites) {
      for (const tc of suite.testcases) {
        const job = jobsBySkill.get(tc.skill);
        allTestResults.push({
          ...tc,
          runId: run.databaseId,
          jobId: job?.databaseId ?? null,
        });
      }
    }
  }

  return { run, jobs, testResults: allTestResults };
}

// --- SQL generation (for output) ---

function generateInsertSQL(result: CollectedResult): string {
  const lines: string[] = [];
  const { run, jobs, testResults } = result;

  // Workflow run
  lines.push(`-- Workflow run ${run.databaseId}`);
  lines.push(
    `INSERT INTO workflow_runs (id, run_number, trigger_type, branch, commit_sha, status, conclusion, started_at, completed_at, html_url)` +
      ` VALUES (${run.databaseId}, ${run.number}, '${run.event}', '${run.headBranch}', '${run.headSha}', '${run.status}', '${run.conclusion}', '${run.createdAt}', '${run.updatedAt}', '${run.url}')` +
      ` ON CONFLICT (id) DO NOTHING;`
  );

  // Jobs
  for (const job of jobs) {
    const skill = extractSkillFromJobName(job.name);
    if (!skill) continue;
    lines.push(
      `INSERT INTO job_results (id, run_id, skill, status, conclusion, started_at, completed_at, html_url)` +
        ` VALUES (${job.databaseId}, ${run.databaseId}, '${skill}', 'completed', '${job.conclusion}', '${job.startedAt}', '${job.completedAt}', '${job.url}')` +
        ` ON CONFLICT (id) DO NOTHING;`
    );
  }

  // Test results
  for (const tr of testResults) {
    const escapedName = tr.name.replace(/'/g, "''");
    const escapedSuite = (tr.classname || "").replace(/'/g, "''");
    const escapedClassname = (tr.classname || "").replace(/'/g, "''");
    const escapedFailure = tr.failure ? `'${tr.failure.replace(/'/g, "''").substring(0, 5000)}'` : "NULL";
    const confidence = "NULL"; // Confidence is populated from trigger tests when available

    lines.push(
      `INSERT INTO test_results (run_id, job_id, skill, suite_name, test_name, classname, test_type, status, duration_secs, failure_message, confidence)` +
        ` VALUES (${tr.runId}, ${tr.jobId ?? "NULL"}, '${tr.skill}', '${escapedSuite}', '${escapedName}', '${escapedClassname}', '${tr.testType}', '${tr.status}', ${tr.time}, ${escapedFailure}, ${confidence});`
    );
  }

  return lines.join("\n");
}

// --- JSON output (for programmatic use) ---

function generateJSON(result: CollectedResult): string {
  return JSON.stringify(result, null, 2);
}

// --- Main ---

interface Args {
  mode: "single" | "backfill";
  runId?: number;
  days?: number;
  format: "sql" | "json";
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const result: Args = { mode: "single", format: "sql" };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--run-id" && args[i + 1]) {
      result.runId = parseInt(args[i + 1], 10);
      result.mode = "single";
      i++;
    } else if (args[i] === "--backfill") {
      result.mode = "backfill";
    } else if (args[i] === "--days" && args[i + 1]) {
      result.days = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--format" && args[i + 1]) {
      result.format = args[i + 1] as "sql" | "json";
      i++;
    }
  }

  if (result.mode === "backfill" && !result.days) {
    result.days = 7;
  }

  return result;
}

async function collectRun(runId: number, format: "sql" | "json"): Promise<string> {
  console.error(`📦 Collecting run ${runId}...`);

  const run = getWorkflowRun(runId);
  console.error(`  Run #${run.number} (${run.event}) - ${run.conclusion}`);

  const jobs = getWorkflowJobs(runId);
  console.error(`  ${jobs.length} jobs found`);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "test-results-"));
  try {
    const artifactDirs = downloadArtifacts(runId, tmpDir);
    console.error(`  ${artifactDirs.length} artifacts downloaded`);

    const result = processRunArtifacts(run, jobs, artifactDirs);
    console.error(`  ${result.testResults.length} test results parsed`);

    return format === "sql" ? generateInsertSQL(result) : generateJSON(result);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function main() {
  const args = parseArgs();

  if (args.mode === "single") {
    if (!args.runId) {
      console.error("Error: --run-id is required for single run collection");
      process.exit(1);
    }
    const output = await collectRun(args.runId, args.format);
    console.log(output);
  } else {
    // Backfill mode
    const days = args.days || 7;
    console.error(`🔄 Backfilling last ${days} days...`);

    const runs = listRecentRuns(days);
    console.error(`  Found ${runs.length} runs`);

    const allOutputs: string[] = [];
    for (const run of runs) {
      try {
        const output = await collectRun(run.databaseId, args.format);
        allOutputs.push(output);
      } catch (err) {
        console.error(`  ❌ Failed to collect run ${run.databaseId}: ${err}`);
      }
    }

    console.log(allOutputs.join("\n\n"));
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
