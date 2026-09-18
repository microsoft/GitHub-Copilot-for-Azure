import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadRunSpec, createRunPlan, enforceRunLimits } from "./config.ts";
import { executeSkillImprovement } from "./engine.ts";
import { runProcess } from "./process.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

type ParsedArgs = {
  command?: string;
  config?: string;
  executor: "local" | "github";
  baselineRef?: string;
  workflowRef?: string;
  prBase?: string;
  output?: string;
  createDraftPr: boolean;
};

function usage(): string {
  return [
    "Usage:",
    "  npm run skill-improvement -- validate --config <run-spec.yaml>",
    "  npm run skill-improvement -- run --config <run-spec.yaml> [--executor local|github]",
    "  npm run skill-improvement -- execute --config <run-spec.yaml> --output <directory>",
    "",
    "Options:",
    "  --baseline-ref <ref>       Override target.baselineRef",
    "  --workflow-ref <ref>       Workflow ref used by the GitHub executor",
    "  --pr-base <branch>          Base branch for an optional draft PR",
    "  --create-draft-pr          Request a draft PR for an accepted candidate",
  ].join("\n");
}

function parseArgs(args: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    command: args[0],
    executor: "local",
    createDraftPr: false,
  };
  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--create-draft-pr") {
      parsed.createDraftPr = true;
      continue;
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${arg}`);
    }
    if (arg === "--config") {
      parsed.config = value;
    } else if (arg === "--executor") {
      if (value !== "local" && value !== "github") {
        throw new Error("--executor must be local or github.");
      }
      parsed.executor = value;
    } else if (arg === "--baseline-ref") {
      parsed.baselineRef = value;
    } else if (arg === "--workflow-ref") {
      parsed.workflowRef = value;
    } else if (arg === "--pr-base") {
      parsed.prBase = value;
    } else if (arg === "--output") {
      parsed.output = value;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
    index += 1;
  }
  return parsed;
}

function resolveConfig(config: string): string {
  const resolved = path.resolve(process.cwd(), config);
  const relative = path.relative(repoRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Run specification must be inside the repository.");
  }
  return resolved;
}

function validate(configPath: string): void {
  const spec = loadRunSpec(configPath);
  const plan = createRunPlan(repoRoot, spec);
  enforceRunLimits(spec, plan);
  console.log(JSON.stringify({ spec, plan }, null, 2));
}

async function dispatchGitHub(
  configPath: string,
  baselineRef: string,
  workflowRef: string,
  createDraftPr: boolean,
  prBase: string,
): Promise<void> {
  const relativeConfig = path.relative(repoRoot, configPath).replaceAll("\\", "/");
  const args = [
    "workflow",
    "run",
    "skill-improvement.yml",
    "--repo",
    "microsoft/GitHub-Copilot-for-Azure",
    "--ref",
    workflowRef,
    "--field",
    `run-spec=${relativeConfig}`,
    "--field",
    `baseline-ref=${baselineRef}`,
    "--field",
    `create-draft-pr=${createDraftPr ? "true" : "false"}`,
    "--field",
    `pr-base=${prBase}`,
  ];
  const result = await runProcess("gh", args, { cwd: repoRoot });
  if (result.stdout.trim()) {
    console.log(result.stdout.trim());
  }
}

function currentBranch(): string {
  const branch = execFileSync("git", ["branch", "--show-current"], {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();
  if (!branch) {
    throw new Error("Specify --workflow-ref when the local checkout is detached.");
  }
  return branch;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.command || !args.config) {
    console.log(usage());
    process.exitCode = args.command ? 2 : 0;
    return;
  }
  const configPath = resolveConfig(args.config);
  const spec = loadRunSpec(configPath);
  if (args.command === "validate") {
    validate(configPath);
    return;
  }
  if (args.command === "run" && args.executor === "github") {
    await dispatchGitHub(
      configPath,
      args.baselineRef ?? spec.target.baselineRef,
      args.workflowRef ?? currentBranch(),
      args.createDraftPr,
      args.prBase ?? "main"
    );
    return;
  }
  if (args.command !== "run" && args.command !== "execute") {
    throw new Error(`Unknown command: ${args.command}\n${usage()}`);
  }
  const outputDirectory = args.output
    ? path.resolve(args.output)
    : path.join(
      repoRoot,
      "tests",
      "skill-improvement-runs",
      `${spec.name}-${new Date().toISOString().replace(/[:.]/g, "-")}`
    );
  fs.mkdirSync(outputDirectory, { recursive: true });
  fs.copyFileSync(configPath, path.join(outputDirectory, "run-spec.yaml"));
  const report = await executeSkillImprovement(spec, {
    repoRoot,
    outputDirectory,
    baselineRef: args.baselineRef,
  });
  console.log(`Skill improvement report: ${path.join(outputDirectory, "report.md")}`);
  if (args.command === "execute" && !report.finalAccepted) {
    console.log("No candidate satisfied the configured acceptance rules.");
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  void main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
