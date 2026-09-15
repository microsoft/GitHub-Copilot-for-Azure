import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectArtifacts } from "./collect-artifacts";
import { writeComparisonReport } from "./generate-report";
import {
  readCompareInput,
  runComparison,
  writeComparisonOutput,
  type CompareInput,
  type CompareRunOutput,
} from "./run-compare";

type ExperimentInput = CompareInput & {
  name?: string;
  pollIntervalSeconds?: number;
  timeoutMinutes?: number;
};

type WorkflowState = {
  status: string;
  conclusion: string | null;
  url: string;
  updatedAt: string;
};

const REPO = "microsoft/GitHub-Copilot-for-Azure";
const DEFAULT_POLL_INTERVAL_SECONDS = 30;
const DEFAULT_TIMEOUT_MINUTES = 360;

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function extractRunId(runUrl: string): string {
  const runId = runUrl.split("/").pop();
  if (!runId) {
    throw new Error(`Could not extract run id from URL: ${runUrl}`);
  }
  return runId;
}

function getRuns(manifest: CompareRunOutput): string[] {
  return manifest.results.flatMap(result => result.runs.map(run => extractRunId(run.run)));
}

function getWorkflowState(runId: string): WorkflowState {
  const output = execFileSync("gh", [
    "run",
    "view",
    runId,
    "--repo",
    REPO,
    "--json",
    "status,conclusion,url,updatedAt",
  ], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return JSON.parse(output) as WorkflowState;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function waitForRuns(
  manifest: CompareRunOutput,
  pollIntervalSeconds: number,
  timeoutMinutes: number,
): Promise<Record<string, WorkflowState>> {
  const runIds = getRuns(manifest);
  const deadline = Date.now() + timeoutMinutes * 60_000;
  const states: Record<string, WorkflowState> = {};

  while (Date.now() < deadline) {
    let completed = 0;
    for (const runId of runIds) {
      if (states[runId]?.status === "completed") {
        completed += 1;
        continue;
      }
      try {
        const state = getWorkflowState(runId);
        states[runId] = state;
        if (state.status === "completed") {
          completed += 1;
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`Could not read workflow run ${runId}; retrying on the next poll: ${message}`);
      }
    }
    console.log(`Completed ${completed}/${runIds.length} workflow runs.`);
    if (completed === runIds.length) {
      return states;
    }
    await sleep(pollIntervalSeconds * 1_000);
  }

  throw new Error(`Timed out after ${timeoutMinutes} minutes waiting for comparison runs.`);
}

function applyWorkflowStates(
  manifest: CompareRunOutput,
  states: Record<string, WorkflowState>,
): void {
  for (const branchResult of manifest.results) {
    for (const run of branchResult.runs) {
      const runId = extractRunId(run.run);
      const state = states[runId];
      if (!state) {
        throw new Error(`Missing workflow state for run ${runId}.`);
      }
      run.status = state.status;
      run.conclusion = state.conclusion;
      run.artifactDate = state.updatedAt.slice(0, 10);
    }
  }
}

function assertCollectableConclusions(states: Record<string, WorkflowState>): void {
  const uncollectable = Object.entries(states).filter(([, state]) =>
    state.conclusion !== "success" && state.conclusion !== "failure"
  );
  if (uncollectable.length === 0) {
    return;
  }

  const details = uncollectable
    .map(([runId, state]) => `${runId}: ${state.conclusion ?? "no conclusion"}`)
    .join(", ");
  throw new Error(`Workflow runs did not produce collectable results: ${details}`);
}

async function collectWithRetry(manifestPath: string, artifactRoot: string): Promise<void> {
  const attempts = 5;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const exitCode = collectArtifacts(manifestPath, artifactRoot);
    if (exitCode === 0) {
      return;
    }
    if (attempt < attempts) {
      console.warn(`Artifact collection attempt ${attempt}/${attempts} failed; retrying in 30 seconds.`);
      await sleep(30_000);
    }
  }
  throw new Error("Artifact collection failed after all retries.");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const resume = args[0] === "--resume";
  const sourcePath = resume ? args[1] : args[0];
  if (!sourcePath || args.length !== (resume ? 2 : 1)) {
    throw new Error(
      "Usage: npm run experiment:run -- <experiment.json>\n"
      + "   or: npm run experiment:run -- --resume <comparison-runs.json>"
    );
  }

  const resolvedSourcePath = path.resolve(sourcePath);
  let outputDirectory: string;
  let input: ExperimentInput;
  let manifest: CompareRunOutput;
  let manifestPath: string;

  if (resume) {
    outputDirectory = path.dirname(resolvedSourcePath);
    manifestPath = resolvedSourcePath;
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as CompareRunOutput;
    input = readCompareInput(path.join(outputDirectory, "experiment.json")) as ExperimentInput;
    console.log(`Resuming experiment from ${manifestPath}`);
  } else {
    input = readCompareInput(resolvedSourcePath) as ExperimentInput;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const experimentName = slug(input.name ?? input.skill.name);
    outputDirectory = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
      "comparison-experiments",
      `${experimentName}-${timestamp}`
    );
    fs.mkdirSync(outputDirectory, { recursive: true });
    fs.copyFileSync(resolvedSourcePath, path.join(outputDirectory, "experiment.json"));

    console.log("Queueing comparison runs...");
    manifest = await runComparison(input);
    manifestPath = writeComparisonOutput(manifest, outputDirectory);
  }
  const artifactRoot = path.join(outputDirectory, "artifacts");

  console.log("Waiting for GitHub Actions...");
  const states = await waitForRuns(
    manifest,
    input.pollIntervalSeconds ?? DEFAULT_POLL_INTERVAL_SECONDS,
    input.timeoutMinutes ?? DEFAULT_TIMEOUT_MINUTES
  );
  fs.writeFileSync(
    path.join(outputDirectory, "workflow-status.json"),
    JSON.stringify(states, null, 2),
    "utf8"
  );
  applyWorkflowStates(manifest, states);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  assertCollectableConclusions(states);

  console.log("Collecting artifacts...");
  await collectWithRetry(manifestPath, artifactRoot);

  console.log("Generating deterministic reports...");
  writeComparisonReport(manifestPath, artifactRoot, outputDirectory);
  console.log(`Experiment completed: ${outputDirectory}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main();
}
