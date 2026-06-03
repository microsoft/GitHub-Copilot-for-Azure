#!/usr/bin/env node

import fs from "fs";
import path from "path";

function parseArgs(argv) {
  const args = {
    resultsDir: "./results",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--results-dir") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("Missing value for --results-dir");
      }
      args.resultsDir = value;
      i += 1;
      continue;
    }
    if (arg.startsWith("--results-dir=")) {
      args.resultsDir = arg.slice("--results-dir=".length);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function findLatestResultDir(resultsRoot) {
  if (!fs.existsSync(resultsRoot)) {
    return undefined;
  }

  const resultDirs = fs.readdirSync(resultsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const latestDir = resultDirs.at(-1);
  return latestDir ? path.join(resultsRoot, latestDir) : undefined;
}

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  return fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function formatPassRate(passedCount, totalCount) {
  if (totalCount === 0) {
    return "0.0";
  }
  return ((passedCount / totalCount) * 100).toFixed(1);
}

function formatMillionTokens(tokenCount) {
  if (typeof tokenCount !== "number" || !Number.isFinite(tokenCount)) {
    return "-";
  }
  return (tokenCount / 1_000_000).toFixed(3);
}

function buildSummary(records) {
  const cases = records
    .filter((record) => record.status === "success" && record.trajectory?.stimulus)
    .map((record) => {
      const metrics = record.trajectory.metrics ?? {};
      const tokenUsage = metrics.tokenUsage ?? {};
      return {
        name: record.trajectory.stimulus.name,
        passed: record.gradeResult?.passed === true,
        wallTimeSeconds: typeof metrics.wallTimeMs === "number"
          ? (metrics.wallTimeMs / 1000).toFixed(1)
          : "-",
        inputTokens: formatMillionTokens(tokenUsage.inputTokens),
        outputTokens: formatMillionTokens(tokenUsage.outputTokens),
      };
    });

  const passedCount = cases.filter((testCase) => testCase.passed).length;
  const totalCount = cases.length;
  const passRate = formatPassRate(passedCount, totalCount);
  const lines = ["## Microsoft Foundry E2E Evaluation Summary", ""];

  lines.push(`Overall pass rate: ${passedCount}/${totalCount} (${passRate}%)`);
  lines.push("");
  lines.push("| Case | Result | Wall Time (s) | Input Tokens (million) | Output Tokens (million) |");
  lines.push("|---|---:|---:|---:|---:|");

  if (cases.length === 0) {
    lines.push("| No cases found | Failed | - | - | - |");
  } else {
    for (const testCase of cases) {
      const escapedName = testCase.name.replace(/\|/g, "\\|");
      lines.push([
        escapedName,
        testCase.passed ? "Passed" : "Failed",
        testCase.wallTimeSeconds,
        testCase.inputTokens,
        testCase.outputTokens,
      ].join(" | ").replace(/^/, "| ").replace(/$/, " |"));
    }
  }

  const runErrors = records.filter((record) => record.status === "error" && record.error);
  if (runErrors.length > 0) {
    lines.push("");
    lines.push("### Run Errors");
    for (const errorRecord of runErrors) {
      lines.push(`- ${String(errorRecord.error).replace(/\r?\n/g, " ")}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const resultsRoot = path.resolve(args.resultsDir);
  const latestResultDir = findLatestResultDir(resultsRoot);

  let summary;
  if (!latestResultDir) {
    summary = [
      "## Microsoft Foundry E2E Evaluation Summary",
      "",
      "No Vally result directory was found.",
      "",
    ].join("\n");
  } else {
    const records = readJsonl(path.join(latestResultDir, "results.jsonl"));
    summary = buildSummary(records);
    fs.writeFileSync(path.join(latestResultDir, "e2e-summary.md"), summary, "utf8");
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary, "utf8");
  } else {
    console.log(summary);
  }
}

main();
