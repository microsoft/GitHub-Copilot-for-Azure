import { spawn } from "node:child_process";
import { createHash, randomInt } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { loadEvalSpec, parseDuration, ProjectContext, resolveEnvironment, resolveExecutorConfig, resolveStimulus } from "@microsoft/vally";
import { comparisonSkills, comparisonStimulus } from "../vally/comparison-policy.ts";

const testsDir = path.resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);

export type ComparisonOptions = {
  evalSpec: string;
  copilotModel: string;
  claudeModel: string;
  judgeModel: string;
  runs: number;
  timeout: string;
  outputDir: string;
  skipJudge: boolean;
  failOnRegression: boolean;
};

export function parseComparisonArgs(args: string[]): ComparisonOptions | undefined {
  const { values } = parseArgs({
    args,
    options: {
      "eval-spec": { type: "string" },
      "copilot-model": { type: "string" },
      "claude-model": { type: "string" },
      "judge-model": { type: "string" },
      runs: { type: "string", default: "5" },
      timeout: { type: "string", default: "10m" },
      "output-dir": { type: "string", default: path.join(testsDir, "results-comparison") },
      "skip-judge": { type: "boolean", default: false },
      "fail-on-regression": { type: "boolean", default: false },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) return undefined;
  for (const key of ["eval-spec", "copilot-model", "claude-model", "judge-model"] as const) {
    if (!values[key]?.trim()) throw new Error(`--${key} is required.`);
  }
  const runs = Number(values.runs);
  if (!Number.isSafeInteger(runs) || runs < 1) throw new Error("--runs must be a positive integer.");
  if (parseDuration(values.timeout) <= 0) throw new Error("--timeout must be positive.");
  for (const key of ["copilot-model", "claude-model", "judge-model"] as const) {
    if (values[key]?.includes(",") || /^(sonnet|opus|haiku|default|latest)(\[.*\])?$/i.test(values[key]!)
      || /[-:]latest$/i.test(values[key]!)) {
      throw new Error(`--${key} requires one explicit model version, not a floating alias or list.`);
    }
  }
  if (values["skip-judge"] && values["fail-on-regression"]) {
    throw new Error("--fail-on-regression cannot be used with --skip-judge.");
  }
  return {
    evalSpec: path.resolve(values["eval-spec"]!), copilotModel: values["copilot-model"]!,
    claudeModel: values["claude-model"]!, judgeModel: values["judge-model"]!,
    runs, timeout: values.timeout, outputDir: path.resolve(values["output-dir"]),
    skipJudge: values["skip-judge"], failOnRegression: values["fail-on-regression"],
  };
}

type RunCommand = (args: string[], env: NodeJS.ProcessEnv) => Promise<number>;

async function runVally(args: string[], env: NodeJS.ProcessEnv): Promise<number> {
  const cli = require.resolve("@microsoft/vally-cli/dist/index.js");
  return new Promise((resolve, reject) => {
    const cwd = args[0] === "eval" ? path.dirname(args[args.indexOf("--eval-spec") + 1]) : testsDir;
    const child = spawn(process.execPath, [cli, ...args], { cwd, env, stdio: "inherit" });
    child.on("error", reject);
    child.on("close", code => resolve(code ?? 1));
  });
}

async function hashInputs(paths: string[]): Promise<string> {
  const hash = createHash("sha256");
  async function add(input: string): Promise<void> {
    const info = await stat(input);
    hash.update(input);
    if (info.isDirectory()) {
      for (const entry of (await readdir(input)).sort()) await add(path.join(input, entry));
    } else {
      hash.update(await readFile(input));
    }
  }
  for (const input of [...new Set(paths)].sort()) await add(input);
  return hash.digest("hex");
}

export async function findComparisonResult(outputDir: string): Promise<string> {
  const dirs = (await readdir(outputDir, { withFileTypes: true })).filter(entry => entry.isDirectory());
  if (dirs.length !== 1) throw new Error(`Expected exactly one run under ${outputDir}, found ${dirs.length}.`);
  const result = path.join(outputDir, dirs[0].name, "results.jsonl");
  await stat(result);
  return result;
}

async function assertTrialCounts(result: string, names: string[], runs: number): Promise<void> {
  const counts = new Map<string, number>();
  for (const line of (await readFile(result, "utf8")).split("\n").filter(line => line.trim())) {
    const row: unknown = JSON.parse(line);
    if (typeof row !== "object" || row === null || !("status" in row) || !("trajectory" in row)) continue;
    const trajectory = row.trajectory;
    if (typeof trajectory !== "object" || trajectory === null || !("stimulus" in trajectory)) continue;
    const stimulus = trajectory.stimulus;
    if (typeof stimulus !== "object" || stimulus === null || !("name" in stimulus) || typeof stimulus.name !== "string") continue;
    counts.set(stimulus.name, (counts.get(stimulus.name) ?? 0) + 1);
  }
  if (counts.size !== names.length || names.some(name => counts.get(name) !== runs)) {
    throw new Error(`Incomplete or mismatched trials in ${result}; expected ${runs} for each stimulus.`);
  }
}

export async function compareClients(options: ComparisonOptions, run: RunCommand = runVally): Promise<string> {
  if (process.env.MODEL_OVERRIDE?.trim() || process.env.NO_SKILLS === "true") {
    throw new Error("Unset MODEL_OVERRIDE and NO_SKILLS before comparing clients.");
  }
  const spec = await loadEvalSpec(options.evalSpec);
  const project = await ProjectContext.load(path.dirname(options.evalSpec));
  const environments = project.config.environments;
  const rootEnv = resolveEnvironment(spec.environment, environments);
  const stimuli = spec.stimuli.map(raw => resolveStimulus(raw, rootEnv, environments, spec.tags, path.dirname(options.evalSpec), spec.grading_environment));
  if (!stimuli.length) throw new Error("Comparison requires at least one stimulus.");
  const inputs = [options.evalSpec];
  if (project.dir) inputs.push(path.join(project.dir, ".vally.yaml"));
  for (const stimulus of stimuli) {
    const env = stimulus.environment;
    if (!options.skipJudge && !stimulus.rubric?.length) {
      throw new Error(`Add a comparison rubric to '${stimulus.name}', or use --skip-judge to collect trajectories only.`);
    }
    comparisonStimulus(stimulus, {
      workDir: testsDir, timeout: parseDuration(options.timeout), model: options.copilotModel,
      env: env?.env, mcpServers: env?.mcpServers, reasoningEffort: spec.defaults?.reasoning_effort,
      executorConfig: resolveExecutorConfig(spec.defaults?.executor),
      maxAgentDurationMs: stimulus.constraints?.max_agent_duration === undefined
        ? undefined : parseDuration(stimulus.constraints.max_agent_duration),
    });
    if (env?.skills?.length) throw new Error("Use requiredSkills rather than environment.skills for comparison.");
    await comparisonSkills(stimulus);
    for (const file of [...(env?.files ?? []), ...(stimulus.grading_environment?.files ?? [])]) {
      inputs.push(path.resolve(path.dirname(options.evalSpec), file.src));
    }
  }
  const inputHash = await hashInputs(inputs);
  await mkdir(options.outputDir, { recursive: true });
  const outputDir = await mkdtemp(path.join(options.outputDir, "comparison-"));
  const pluginRoot = path.join(outputDir, "plugins");
  await cp(process.env.VALLY_PLUGIN_OUTPUT_ROOT ?? path.resolve(testsDir, "..", "output"), pluginRoot, { recursive: true });
  const env = {
    ...process.env, VALLY_FAIR_COMPARISON: "true", VALLY_RUNNER_EXACT_SKILL: "true",
    VALLY_PLUGIN_OUTPUT_ROOT: pluginRoot,
    ...(process.env.VALLY_CLAUDE_EXECUTOR_MODULE
      ? { VALLY_CLAUDE_EXECUTOR_MODULE: path.resolve(process.env.VALLY_CLAUDE_EXECUTOR_MODULE) } : {}),
  };
  const clients = [
    { name: "copilot", executor: "integration-test-agent-runner", plugin: "vally-executor.ts", model: options.copilotModel },
    { name: "claude", executor: "claude-cli", plugin: "claude-executor.ts", model: options.claudeModel },
  ];
  if (randomInt(2)) clients.reverse();
  const manifest = {
    ...options, inputHash, policy: "fair-comparison-v1", order: clients.map(client => client.name),
    workers: 1, maxRetries: 0, exactSkills: true, earlyTerminate: false, explicitMcpOnly: true,
    status: "running", results: {} as Record<string, string>,
  };
  const save = () => writeFile(path.join(outputDir, "comparison-run.json"), JSON.stringify(manifest, null, 2));
  await save();
  try {
    for (const client of clients) {
      if (await hashInputs(inputs) !== inputHash) throw new Error("Eval inputs changed during comparison.");
      const clientDir = path.join(outputDir, client.name);
      const code = await run([
        "eval", "--eval-spec", options.evalSpec, "--executor", client.executor,
        "--executor-plugin", path.join(testsDir, "vally", client.plugin),
        "--grader-plugin", path.join(testsDir, "vally", "vally-graders.ts"),
        "--model", client.model, "--judge-model", options.judgeModel,
        "--runs", String(options.runs), "--workers", "1", "--max-retries", "0",
        "--timeout", options.timeout, "--output-dir", clientDir, "--junit",
      ], env);
      if (code !== 0) throw new Error(`${client.name} evaluation failed (exit ${code}). See ${outputDir}.`);
      const result = await findComparisonResult(clientDir);
      await assertTrialCounts(result, stimuli.map(stimulus => stimulus.name), options.runs);
      manifest.results[client.name] = result;
      await save();
    }
    if (await hashInputs(inputs) !== inputHash) throw new Error("Eval inputs changed during comparison.");
    if (!options.skipJudge) {
      const code = await run([
        "compare", "--baseline", manifest.results.copilot, "--treatment", manifest.results.claude,
        "--judge-model", options.judgeModel, "--output", path.join(outputDir, "comparison.jsonl"),
        ...(options.failOnRegression ? ["--fail-on-regression"] : []),
      ], env);
      if (code !== 0) throw new Error(`Comparison failed or regressed (exit ${code}). See ${outputDir}.`);
    }
    manifest.status = options.skipJudge ? "collected" : "completed";
    await save();
    return outputDir;
  } catch (error) {
    manifest.status = "failed";
    await save();
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseComparisonArgs(process.argv.slice(2));
    if (options) console.log(`Comparison artifacts: ${await compareClients(options)}`);
    else console.log("Usage: npm run compare:clients -- --eval-spec <yaml> --copilot-model <id> --claude-model <id> --judge-model <id> [--runs 5] [--timeout 10m] [--output-dir <dir>] [--skip-judge | --fail-on-regression]");
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
