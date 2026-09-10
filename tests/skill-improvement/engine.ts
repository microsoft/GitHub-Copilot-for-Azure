import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  createRunPlan,
  editablePathPrefixes,
  enforceRunLimits,
  type RunPlan,
  type SkillImprovementRunSpec,
} from "./config.ts";
import { runEvaluationBatch, type EvaluationBatch } from "./evaluation.ts";
import { commandName, runProcess } from "./process.ts";
import {
  aggregateJudgments,
  buildFailurePacket,
  decideAcceptance,
  summarizeTrials,
  writeReport,
  type AcceptanceDecision,
  type AggregatedTrial,
  type IterationReport,
  type SkillImprovementReport,
} from "./report.ts";

export type ExecuteOptions = {
  repoRoot: string;
  outputDirectory: string;
  baselineRef?: string;
};

type Usage = {
  answerGenerations: number;
  judgeCalls: number;
};

function git(repoRoot: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function sanitizeRunId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
}

function ensureDependencyLink(source: string, destination: string): void {
  if (!fs.existsSync(source) || fs.existsSync(destination)) {
    return;
  }
  fs.symlinkSync(source, destination, process.platform === "win32" ? "junction" : "dir");
}

function linkDependencies(repoRoot: string, worktree: string): void {
  ensureDependencyLink(
    path.join(repoRoot, "node_modules"),
    path.join(worktree, "node_modules")
  );
  ensureDependencyLink(
    path.join(repoRoot, "tests", "node_modules"),
    path.join(worktree, "tests", "node_modules")
  );
  ensureDependencyLink(
    path.join(repoRoot, "scripts", "node_modules"),
    path.join(worktree, "scripts", "node_modules")
  );
}

async function createWorktree(
  repoRoot: string,
  worktree: string,
  gitRef: string,
): Promise<void> {
  fs.mkdirSync(path.dirname(worktree), { recursive: true });
  await runProcess("git", ["worktree", "add", "--detach", worktree, gitRef], {
    cwd: repoRoot,
  });
  linkDependencies(repoRoot, worktree);
}

async function removeWorktree(repoRoot: string, worktree: string): Promise<void> {
  if (!fs.existsSync(worktree)) {
    return;
  }
  await runProcess("git", ["worktree", "remove", "--force", worktree], {
    cwd: repoRoot,
    allowFailure: true,
  });
}

async function buildWorktree(worktree: string, deadline: number): Promise<void> {
  await runProcess(commandName("npm"), ["run", "build"], {
    cwd: worktree,
    timeoutMs: Math.max(deadline - Date.now(), 1),
  });
}

function listMarkdownFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) {
    return [];
  }
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return listMarkdownFiles(fullPath);
    }
    return entry.name.endsWith(".md") ? [fullPath] : [];
  });
}

function estimateSkillTokens(worktree: string, spec: SkillImprovementRunSpec): number {
  const skillDirectory = path.join(
    worktree,
    "plugins",
    spec.target.plugin,
    "skills",
    spec.target.skill
  );
  const characters = listMarkdownFiles(skillDirectory)
    .reduce((total, file) => total + fs.readFileSync(file, "utf8").length, 0);
  return Math.ceil(characters / 4);
}

function changedFiles(worktree: string): string[] {
  const output = execFileSync("git", ["status", "--porcelain"], {
    cwd: worktree,
    encoding: "utf8",
  });
  return output.split(/\r?\n/)
    .filter(Boolean)
    .map(line => line.slice(3))
    .map(file => file.includes(" -> ") ? file.split(" -> ").at(-1)! : file)
    .map(file => file.replaceAll("\\", "/"));
}

function validateChangedPaths(
  files: string[],
  spec: SkillImprovementRunSpec,
): string[] {
  const prefixes = editablePathPrefixes(spec);
  return files
    .filter(file => !prefixes.some(prefix => file.startsWith(prefix)))
    .map(file => `Change outside allowed paths: ${file}`);
}

async function runCandidateValidation(
  worktree: string,
  deadline: number,
): Promise<string[]> {
  const validations = [
    { cwd: worktree, args: ["run", "build"], name: "build" },
    {
      cwd: path.join(worktree, "scripts"),
      args: ["run", "frontmatter"],
      name: "frontmatter validation",
    },
    {
      cwd: path.join(worktree, "scripts"),
      args: ["run", "references"],
      name: "reference validation",
    },
  ];
  const errors: string[] = [];
  for (const validation of validations) {
    try {
      await runProcess(commandName("npm"), validation.args, {
        cwd: validation.cwd,
        timeoutMs: Math.max(deadline - Date.now(), 1),
      });
    } catch (error: unknown) {
      errors.push(
        `${validation.name} failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  return errors;
}

async function runImprovementAgent(
  worktree: string,
  outputDirectory: string,
  spec: SkillImprovementRunSpec,
  failurePacket: string,
  iteration: number,
  deadline: number,
): Promise<void> {
  const skillDirectory = path.join(
    worktree,
    "plugins",
    spec.target.plugin,
    "skills",
    spec.target.skill
  );
  const prompt = [
    `Improve the ${spec.target.skill} skill using the development evaluation evidence below.`,
    "You may edit files only inside the current skill directory.",
    "Do not edit evaluations, graders, workflows, tests, or other skills.",
    "Do not use network tools, do not push commits, and do not create branches.",
    "Make a general improvement that addresses the failure pattern instead of copying prompt wording.",
    "Keep the skill concise and preserve its existing structure and conventions.",
    "",
    failurePacket,
  ].join("\n");
  const args = [
    "-p",
    prompt,
    "--model",
    spec.improvementAgent.model,
    "--mode",
    "autopilot",
    "--allow-tool",
    "write",
    "--disable-builtin-mcps",
    "--no-remote",
    "--no-remote-export",
    "--no-ask-user",
    "--output-format",
    "json",
    "--usage-output-file",
    path.join(outputDirectory, `iteration-${iteration}-agent-usage.json`),
    "-C",
    skillDirectory,
  ];
  if (spec.improvementAgent.maxAiCredits !== undefined) {
    args.push("--max-ai-credits", String(spec.improvementAgent.maxAiCredits));
  }
  await runProcess("copilot", args, {
    cwd: skillDirectory,
    stdoutFile: path.join(outputDirectory, `iteration-${iteration}-agent.jsonl`),
    stderrFile: path.join(outputDirectory, `iteration-${iteration}-agent.stderr.log`),
    timeoutMs: Math.max(deadline - Date.now(), 1),
  });
}

function commitCandidate(worktree: string, iteration: number): string {
  execFileSync("git", ["add", "--all"], { cwd: worktree, stdio: "ignore" });
  execFileSync("git", [
    "-c",
    "user.name=Skill Improvement",
    "-c",
    "user.email=skill-improvement@users.noreply.github.com",
    "commit",
    "-m",
    `skill improvement iteration ${iteration}`,
  ], {
    cwd: worktree,
    stdio: "ignore",
  });
  return execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: worktree,
    encoding: "utf8",
  }).trim();
}

function writeCandidatePatch(worktree: string, iterationDirectory: string): string {
  execFileSync("git", ["add", "--all"], { cwd: worktree, stdio: "ignore" });
  const patchPath = path.join(iterationDirectory, "candidate.patch");
  fs.writeFileSync(
    patchPath,
    execFileSync("git", ["diff", "--cached", "--binary", "HEAD"], {
      cwd: worktree,
      encoding: "utf8",
    }),
    "utf8"
  );
  return patchPath;
}

function copyCandidateSkill(
  worktree: string,
  iterationDirectory: string,
  spec: SkillImprovementRunSpec,
): string {
  const source = path.join(
    worktree,
    "plugins",
    spec.target.plugin,
    "skills",
    spec.target.skill
  );
  const destination = path.join(iterationDirectory, "candidate-skill");
  fs.cpSync(source, destination, { recursive: true });
  return destination;
}

function filterComparableTrials(trials: AggregatedTrial[]): AggregatedTrial[] {
  return trials.filter(trial => trial.condition.skill === "enabled");
}

function addUsage(usage: Usage, batch: EvaluationBatch): void {
  usage.answerGenerations += batch.answerGenerations;
  usage.judgeCalls += batch.judgeCalls;
}

function enforceActualUsage(spec: SkillImprovementRunSpec, usage: Usage): void {
  if (usage.answerGenerations > spec.limits.maxAnswerGenerations) {
    throw new Error("Actual answer generations exceeded limits.maxAnswerGenerations.");
  }
  if (usage.judgeCalls > spec.limits.maxJudgeCalls) {
    throw new Error("Actual judge calls exceeded limits.maxJudgeCalls.");
  }
}

function writeFailurePacket(
  outputDirectory: string,
  iteration: number,
  contents: string,
): void {
  fs.writeFileSync(
    path.join(outputDirectory, `iteration-${iteration}-failure-packet.md`),
    contents,
    "utf8"
  );
}

export async function executeSkillImprovement(
  spec: SkillImprovementRunSpec,
  options: ExecuteOptions,
): Promise<SkillImprovementReport> {
  const startedAt = Date.now();
  const deadline = startedAt + spec.limits.maxDurationMinutes * 60_000;
  const runId = sanitizeRunId(
    `${spec.name}-${new Date().toISOString().replace(/[:.]/g, "-")}`
  );
  const outputDirectory = path.resolve(options.outputDirectory);
  fs.mkdirSync(outputDirectory, { recursive: true });
  const baselineRef = options.baselineRef ?? spec.target.baselineRef;
  const baselineCommit = git(options.repoRoot, ["rev-parse", baselineRef]);
  const plan: RunPlan = createRunPlan(options.repoRoot, spec);
  enforceRunLimits(spec, plan);
  const worktreeRoot = path.join(os.tmpdir(), runId);
  const baselineWorktree = path.join(worktreeRoot, "baseline");
  const usage: Usage = { answerGenerations: 0, judgeCalls: 0 };
  const iterations: IterationReport[] = [];
  let baselineSkillTokens = 0;
  let baselineTrials: AggregatedTrial[] = [];
  let bestTrials: AggregatedTrial[];
  let bestCommit = baselineCommit;
  let bestCandidateCommit: string | undefined;
  let previousDecision: AcceptanceDecision | undefined;
  let finalPatchPath: string | undefined;
  let heldOut: SkillImprovementReport["heldOut"];
  let report: SkillImprovementReport;

  try {
    console.log(`Preparing baseline ${baselineCommit}...`);
    await createWorktree(options.repoRoot, baselineWorktree, baselineCommit);
    await buildWorktree(baselineWorktree, deadline);
    baselineSkillTokens = estimateSkillTokens(baselineWorktree, spec);

    console.log("Running baseline and control conditions...");
    const baselineBatch = await runEvaluationBatch(
      baselineWorktree,
      options.repoRoot,
      path.join(outputDirectory, "baseline"),
      spec,
      "baseline",
      spec.evaluations.development,
      spec.experiment.conditions,
      deadline
    );
    addUsage(usage, baselineBatch);
    enforceActualUsage(spec, usage);
    baselineTrials = aggregateJudgments(baselineBatch.trials);
    bestTrials = filterComparableTrials(baselineTrials);

    if (spec.improvementAgent.enabled) {
      for (let iteration = 1; iteration <= spec.limits.maxIterations; iteration += 1) {
        const iterationDirectory = path.join(outputDirectory, `iteration-${iteration}`);
        fs.mkdirSync(iterationDirectory, { recursive: true });
        const worktree = path.join(worktreeRoot, `iteration-${iteration}`);
        const iterationReport: IterationReport = {
          iteration,
          changedFiles: [],
          validationErrors: [],
        };
        iterations.push(iterationReport);
        try {
          await createWorktree(options.repoRoot, worktree, bestCommit);
          const failurePacket = buildFailurePacket(spec, bestTrials, previousDecision);
          writeFailurePacket(outputDirectory, iteration, failurePacket);
          console.log(`Running improvement agent for iteration ${iteration}...`);
          await runImprovementAgent(
            worktree,
            outputDirectory,
            spec,
            failurePacket,
            iteration,
            deadline
          );
          iterationReport.changedFiles = changedFiles(worktree);
          iterationReport.validationErrors.push(
            ...validateChangedPaths(iterationReport.changedFiles, spec)
          );
          if (iterationReport.changedFiles.length === 0) {
            iterationReport.validationErrors.push("Improvement agent made no file changes.");
          } else {
            iterationReport.candidatePatchPath = writeCandidatePatch(
              worktree,
              iterationDirectory
            );
            iterationReport.candidateSkillPath = copyCandidateSkill(
              worktree,
              iterationDirectory,
              spec
            );
          }
          if (iterationReport.validationErrors.length === 0) {
            iterationReport.validationErrors.push(
              ...await runCandidateValidation(worktree, deadline)
            );
          }
          if (iterationReport.validationErrors.length > 0) {
            previousDecision = undefined;
            continue;
          }

          const candidateCommit = commitCandidate(worktree, iteration);
          iterationReport.candidateCommit = candidateCommit;
          const candidateConditions = spec.experiment.conditions.filter(
            condition => condition.skill === "enabled"
          );
          console.log(`Evaluating candidate iteration ${iteration}...`);
          const candidateBatch = await runEvaluationBatch(
            worktree,
            options.repoRoot,
            iterationDirectory,
            spec,
            "candidate",
            spec.evaluations.development,
            candidateConditions,
            deadline,
            iteration
          );
          addUsage(usage, candidateBatch);
          enforceActualUsage(spec, usage);
          const candidateTrials = aggregateJudgments(candidateBatch.trials);
          iterationReport.trials = candidateTrials;
          const candidateSkillTokens = estimateSkillTokens(worktree, spec);
          const decision = decideAcceptance(
            spec,
            bestTrials,
            candidateTrials,
            baselineSkillTokens,
            candidateSkillTokens
          );
          iterationReport.decision = decision;
          previousDecision = decision;
          if (decision.accepted) {
            bestCommit = candidateCommit;
            bestCandidateCommit = candidateCommit;
            bestTrials = candidateTrials;
          }
        } finally {
          await removeWorktree(options.repoRoot, worktree);
        }
      }
    }

    let finalAccepted = Boolean(bestCandidateCommit);
    if (
      finalAccepted
      && spec.acceptance.requireHeldOutImprovement
      && (spec.evaluations.heldOut?.length ?? 0) > 0
    ) {
      const finalWorktree = path.join(worktreeRoot, "final-candidate");
      try {
        await createWorktree(options.repoRoot, finalWorktree, bestCommit);
        await buildWorktree(finalWorktree, deadline);
        const conditions = spec.experiment.conditions.filter(
          condition => condition.skill === "enabled"
        );
        const baselineHeldOut = await runEvaluationBatch(
          baselineWorktree,
          options.repoRoot,
          path.join(outputDirectory, "held-out", "baseline"),
          spec,
          "held-out-baseline",
          spec.evaluations.heldOut!,
          conditions,
          deadline
        );
        const candidateHeldOut = await runEvaluationBatch(
          finalWorktree,
          options.repoRoot,
          path.join(outputDirectory, "held-out", "candidate"),
          spec,
          "held-out-candidate",
          spec.evaluations.heldOut!,
          conditions,
          deadline
        );
        addUsage(usage, baselineHeldOut);
        addUsage(usage, candidateHeldOut);
        enforceActualUsage(spec, usage);
        const heldOutDecision = decideAcceptance(
          spec,
          aggregateJudgments(baselineHeldOut.trials),
          aggregateJudgments(candidateHeldOut.trials),
          baselineSkillTokens,
          estimateSkillTokens(finalWorktree, spec)
        );
        heldOut = {
          decision: heldOutDecision,
          baselineTrials: aggregateJudgments(baselineHeldOut.trials),
          candidateTrials: aggregateJudgments(candidateHeldOut.trials),
        };
        if (!heldOutDecision.accepted) {
          finalAccepted = false;
          iterations.push({
            iteration: iterations.length + 1,
            changedFiles: [],
            validationErrors: ["Final held-out acceptance failed."],
            decision: heldOutDecision,
          });
        }
      } finally {
        await removeWorktree(options.repoRoot, finalWorktree);
      }
    }

    if (finalAccepted && bestCandidateCommit) {
      finalPatchPath = path.join(outputDirectory, "final-candidate.patch");
      fs.writeFileSync(
        finalPatchPath,
        git(options.repoRoot, ["diff", "--binary", baselineCommit, bestCandidateCommit]),
        "utf8"
      );
    }

    report = {
      runId,
      generatedAt: new Date().toISOString(),
      status: "completed",
      spec,
      plan,
      baselineCommit,
      baselineSkillTokens,
      baselineTrials,
      baselineSummary: summarizeTrials(baselineTrials),
      iterations,
      heldOut,
      bestCandidateCommit,
      finalAccepted,
      finalPatchPath,
      usage: {
        ...usage,
        durationMinutes: (Date.now() - startedAt) / 60_000,
      },
    };
    writeReport(outputDirectory, report);
    return report;
  } catch (error: unknown) {
    report = {
      runId,
      generatedAt: new Date().toISOString(),
      status: "failed",
      failure: error instanceof Error ? error.stack ?? error.message : String(error),
      spec,
      plan,
      baselineCommit,
      baselineSkillTokens,
      baselineTrials,
      baselineSummary: summarizeTrials(baselineTrials),
      iterations,
      heldOut,
      bestCandidateCommit,
      finalAccepted: false,
      usage: {
        ...usage,
        durationMinutes: (Date.now() - startedAt) / 60_000,
      },
    };
    writeReport(outputDirectory, report);
    throw error;
  } finally {
    await removeWorktree(options.repoRoot, baselineWorktree);
    fs.rmSync(worktreeRoot, { recursive: true, force: true });
  }
}
