/**
 * CLI wrapper for running vally tests.
 *
 * Example:
 * npm run test:vally -- --skill azure-ai --use-custom-executor [...vally eval arguments]
 */

import * as path from "node:path";
import * as fs from "fs/promises";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { normalizeTestName } from "./vally/utils";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type ResultJsonlEntry = {
  type: string | undefined;
  status: string | undefined;
  trajectory?: {
    stimulus: {
      name: string;
      prompt: string;
      tags?: {
        type: string;
        skill: string;
        tier: string;
        cost: string;
        earlyTerminate?: string;
        followUp?: string[];
        systemPrompt?: string;
        takeScreenshot?: string;
      }
    }
  };
  gradeResult?: {
    name: string;
    passed: boolean;
    score: number;
    evidence: string;
    details: {
      name: string;
      passed: boolean;
      score: number;
      evidence: string;
    }[];
  }
};

/**
 * Transform the vally test results file to integration test compatible.
 */
async function convertAllTestResult(): Promise<void> {
  const resultsDir = path.resolve(__dirname, "results");
  const entries = await fs.readdir(resultsDir, { withFileTypes: true });
  const dirs = entries
    .filter(e => e.isDirectory())
    .map(e => e.name)
    .sort()
    .reverse();
  const topDir = dirs[0];
  if (topDir) {
    // Note: this file is not written when shutdown executes, so we cannot read this file yet.
    // const evalResultsPath = path.join(resultsDir, topDir, "eval-results.md");
    const resultsJsonlPath = path.join(resultsDir, topDir, "results.jsonl");
    const reportsDir = path.resolve(__dirname, "reports");
    const reportsEntries = await fs.readdir(reportsDir, { withFileTypes: true });
    const reportsDirs = reportsEntries
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .sort()
      .reverse();
    const reportsTopDir = reportsDirs[0];
    if (reportsTopDir) {
      // Copy the results.jsonl file so it can be published with other artifacts.
      const destDir = path.join(reportsDir, reportsTopDir);
      await fs.cp(resultsJsonlPath, path.join(destDir, "results.jsonl"));
      await convertTestResults(resultsJsonlPath, destDir);
    }
  }
}

/**
 * Convert vally results to the integration dashboard recognizable test results.
 * @param vallyResultsPath Path to vally's results.jsonl file.
 * @param testCaseDirPath Path to the directory containing the test run artifacts.
 */
async function convertTestResults(vallyResultsPath: string, testCaseDirPath: string): Promise<void> {
  // Parse results.jsonl and trim it for dashboard consumption.
  // The raw results.jsonl file contains the full trajectory, which is too verbose for the dashboard app.
  // We trim the trajectory from it so the dashboard app can only look at the high level test results.
  const content = await fs.readFile(vallyResultsPath, "utf-8");
  const lines = content.trim().split("\n");
  const records: ResultJsonlEntry[] = [];
  for (const line of lines) {
    if (!line) {
      continue;
    }
    const entry: ResultJsonlEntry = JSON.parse(line);
    records.push(entry);
  }
  const testResults: Record<string, {
    isPass: boolean;
    message?: string;
    expectsScreenshot?: boolean;
  }> = {};
  for (const record of records) {
    // Entry is for a stimulus.
    if (record.status && record.trajectory && record.trajectory) {
      const skillName = record.trajectory.stimulus.tags?.skill ?? "unknown";
      const expectsScreenshot = !!record.trajectory?.stimulus?.tags?.takeScreenshot;
      const normalizedTestName = normalizeTestName(skillName, record.trajectory.stimulus.name);
      const gradeResult = record.gradeResult;
      const isPass = gradeResult?.passed ?? false;

      // Build error message from all levels of details from the failed stimulus.
      let message = gradeResult?.evidence ?? "Missing grader evidence";
      gradeResult?.details?.forEach(detail => {
        if (!detail.passed) {
          message += `\n${detail.evidence}`;
        }
      });

      testResults[normalizedTestName] = {
        isPass,
        message,
        expectsScreenshot
      };
    }
  }

  await fs.writeFile(
    path.join(testCaseDirPath, "testResults.json"),
    JSON.stringify(testResults, null, 2),
    "utf-8"
  );
}

type CliOptions = {
  skill?: string;
  useCustomExecutor: boolean;
  forwardedArgs: string[];
};

function parseCliOptions(argv: string[]): CliOptions {
  const forwardedArgs: string[] = [];
  let skill: string | undefined;
  let useCustomExecutor = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--skill") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("Missing value for --skill");
      }
      skill = value;
      i += 1;
      continue;
    }

    if (arg.startsWith("--skill=")) {
      const value = arg.slice("--skill=".length);
      if (!value) {
        throw new Error("Missing value for --skill");
      }
      skill = value;
      continue;
    }

    if (arg === "--use-custom-executor") {
      useCustomExecutor = true;
      continue;
    }

    if (arg === "--output-dir") {
      console.warn("Ignoring user-provided --output-dir; this wrapper manages output directory.");
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        i += 1;
      }
      continue;
    }

    if (arg.startsWith("--output-dir=")) {
      console.warn("Ignoring user-provided --output-dir; this wrapper manages output directory.");
      continue;
    }

    forwardedArgs.push(arg);
  }

  return {
    skill,
    useCustomExecutor,
    forwardedArgs,
  };
}

function printUsage(): void {
  console.log([
    "Usage: tsx tests/run-vally-test.ts [options] [-- <vally args>]",
    "",
    "Options:",
    "  --skill <name>            Skill name used by this wrapper",
    "  --use-custom-executor     Enable custom executor behavior in this wrapper",
    "  --help                    Show this help",
    "",
    "All unknown options are forwarded to the underlying vally command.",
  ].join("\n"));
}

async function runVallyCommand(args: string[]): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const child = spawn("npx", ["@microsoft/vally-cli", "eval", ...args], {
      stdio: ["inherit", "pipe", "pipe"],
    });

    child.stdout.on("data", (chunk: Buffer) => {
      process.stdout.write(chunk);
    });

    // Forward child stderr to parent stdout as requested.
    child.stderr.on("data", (chunk: Buffer) => {
      process.stdout.write(chunk);
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      resolve(code ?? 1);
    });
  });
}

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);

  if (rawArgs.includes("--help") || rawArgs.includes("-h") || rawArgs.length === 0) {
    printUsage();
    return;
  }

  const options = parseCliOptions(rawArgs);

  // Wrapper-specific args are parsed above; all other args are preserved here.
  const forwardedArgs = [...options.forwardedArgs];

  // default options
  forwardedArgs.splice(0, 0, "--output-dir", "./results");

  if (options.skill) {
    forwardedArgs.splice(0, 0, "--eval-spec", `../evals/${options.skill}/eval.yaml`);
  }

  if (options.useCustomExecutor) {
    forwardedArgs.splice(0, 0, "--executor-plugin", "../../tests/vally/vally-executor.ts");
  }

  const exitCode = await runVallyCommand(forwardedArgs);
  await convertAllTestResult();

  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});