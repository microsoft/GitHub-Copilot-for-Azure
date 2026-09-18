import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import type {
  EvaluationCondition,
  SkillImprovementRunSpec,
} from "./config.ts";
import { resolveEvaluationPath } from "./config.ts";
import {
  createGenerationLaunch,
  createGradingLaunch,
} from "./evaluator-adapter.ts";
import {
  runProcess,
  runWithConcurrency,
} from "./process.ts";

type GradeDetail = {
  name?: string;
  passed?: boolean;
  score?: number;
  evidence?: string;
  details?: GradeDetail[];
};

export type VallyRecord = {
  type?: string;
  itemId?: string;
  evalName?: string;
  stimulus?: string;
  model?: string;
  status?: string;
  gradeResult?: {
    passed?: boolean;
    score?: number;
    evidence?: string;
    details?: GradeDetail[];
  };
  trajectory?: {
    output?: string;
    stimulus?: {
      name?: string;
      tags?: {
        area?: string;
      };
    };
    metrics?: {
      tokenUsage?: {
        totalTokens?: number;
      };
      toolCallBreakdown?: Record<string, number>;
      skillActivationBreakdown?: Record<string, number>;
    };
  };
};

export function isGradedVallyRecord(record: VallyRecord): boolean {
  return record.gradeResult !== undefined;
}

export function requireCompleteGrading(
  records: VallyRecord[],
  expectedCount: number,
): VallyRecord[] {
  const trialRecords = records.filter(record =>
    record.type === "trial-result"
    || record.trajectory !== undefined
    || record.gradeResult !== undefined
  );
  const ungraded = trialRecords.filter(record => !isGradedVallyRecord(record));
  if (trialRecords.length !== expectedCount || ungraded.length > 0) {
    throw new Error(
      "Incomplete judge output: "
      + `expected ${expectedCount} graded trajectories, received ${trialRecords.length}, `
      + `${ungraded.length} without grades.`
    );
  }
  return trialRecords;
}

export function requireCompleteGeneration(
  records: VallyRecord[],
  expectedCount: number,
): VallyRecord[] {
  const trialRecords = records.filter(record =>
    record.type === "trial-result" || record.trajectory !== undefined
  );
  if (trialRecords.length !== expectedCount) {
    throw new Error(
      "Incomplete generation output: "
      + `expected ${expectedCount} trajectories, received ${trialRecords.length}.`
    );
  }
  return trialRecords;
}

export type JudgedTrial = {
  phase: string;
  iteration?: number;
  condition: EvaluationCondition;
  answerModel: string;
  judgeModel: string;
  evalFile: string;
  itemId: string;
  stimulus: string;
  area: string;
  passed: boolean;
  score: number;
  evidence: string;
  details: GradeDetail[];
  output: string;
  targetSkillInvoked: boolean;
  kustoToolCalls: number;
  totalTokens: number;
};

export type EvaluationBatch = {
  trials: JudgedTrial[];
  answerGenerations: number;
  judgeCalls: number;
};

type GenerationTask = {
  condition: EvaluationCondition;
  answerModel: string;
  evalFile: string;
};

type GeneratedAnswers = GenerationTask & {
  answerFile: string;
  runDirectory: string;
  count: number;
};

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9.-]+/g, "-").replace(/^-|-$/g, "");
}

export function readVallyJsonl(filePath: string): VallyRecord[] {
  return fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(({ line }) => line.length > 0)
    .map(({ line, lineNumber }) => {
      try {
        return JSON.parse(line) as VallyRecord;
      } catch (error: unknown) {
        throw new Error(
          `Invalid Vally JSONL in ${filePath} at line ${lineNumber}: `
          + `${error instanceof Error ? error.message : String(error)}`,
          { cause: error }
        );
      }
    });
}

export function findVallyRunDirectory(
  root: string,
  markerFile = "eval-results.md",
): string {
  const candidates = fs.readdirSync(root, { withFileTypes: true })
    .filter(entry =>
      entry.isDirectory()
      && fs.existsSync(path.join(root, entry.name, markerFile))
    )
    .map(entry => path.join(root, entry.name));
  if (candidates.length !== 1) {
    throw new Error(
      `Expected one Vally run directory under ${root}, found ${candidates.length}.`
    );
  }
  return candidates[0];
}

function canonicalItemId(record: VallyRecord): string {
  if (record.itemId?.includes("::")) {
    return record.itemId.slice(record.itemId.indexOf("::") + 2);
  }
  return record.itemId
    ?? `${record.evalName ?? "unknown"}::${record.trajectory?.stimulus?.name ?? record.stimulus ?? "unknown"}`;
}

function countKustoToolCalls(record: VallyRecord): number {
  return Object.entries(record.trajectory?.metrics?.toolCallBreakdown ?? {})
    .filter(([name]) => name.toLowerCase().includes("kusto"))
    .reduce((total, [, count]) => total + count, 0);
}

function flattenEvidence(details: GradeDetail[] | undefined): string[] {
  const evidence: string[] = [];
  for (const detail of details ?? []) {
    if (detail.evidence) {
      evidence.push(detail.evidence);
    }
    evidence.push(...flattenEvidence(detail.details));
  }
  return evidence;
}

function assertBeforeDeadline(deadline: number): void {
  if (Date.now() >= deadline) {
    throw new Error("Skill improvement run exceeded limits.maxDurationMinutes.");
  }
}

async function generateAnswers(
  worktree: string,
  evalRepoRoot: string,
  outputRoot: string,
  spec: SkillImprovementRunSpec,
  task: GenerationTask,
  deadline: number,
): Promise<GeneratedAnswers> {
  assertBeforeDeadline(deadline);
  const testsDirectory = path.join(evalRepoRoot, "tests");
  const evalPath = resolveEvaluationPath(evalRepoRoot, spec, task.evalFile);
  const taskDirectory = path.join(
    outputRoot,
    "generation",
    slug(task.condition.name),
    slug(task.answerModel),
    slug(task.evalFile)
  );
  fs.mkdirSync(taskDirectory, { recursive: true });
  const answerFile = path.join(taskDirectory, "answers.jsonl");
  const stderrFile = path.join(taskDirectory, "vally.stderr.log");
  const env: NodeJS.ProcessEnv = {
    MODEL_OVERRIDE: "",
    NO_SKILLS: task.condition.skill === "disabled" ? "true" : "",
    VALLY_RUNNER_DISABLE_AZURE_MCP: task.condition.mcp === "disabled" ? "true" : "",
    VALLY_RUNNER_EXACT_SKILL: task.condition.skill === "enabled" ? "true" : "",
    VALLY_PLUGIN_OUTPUT_ROOT: path.join(worktree, "output"),
    TEST_RUN_ID:
      `skill-improvement-${slug(task.condition.name)}-${slug(task.answerModel)}-${slug(task.evalFile)}`,
  };

  const launch = createGenerationLaunch(spec, {
    worktree,
    evalRepoRoot,
    testsDirectory,
    evalPath,
    evalFile: task.evalFile,
    answerModel: task.answerModel,
    generationDirectory: taskDirectory,
    answerFile,
    condition: task.condition,
    conditionEnvironment: env,
  });
  await runProcess(launch.command, launch.args, {
    cwd: launch.cwd,
    env: launch.env,
    stdoutFile: answerFile,
    stderrFile,
    timeoutMs: Math.max(deadline - Date.now(), 1),
  });

  const runDirectory = findVallyRunDirectory(
    taskDirectory,
    spec.evaluator?.output.runDirectoryMarker
  );
  const evalDocument = parse(fs.readFileSync(evalPath, "utf8")) as {
    stimuli?: unknown[];
  };
  if (!Array.isArray(evalDocument.stimuli) || evalDocument.stimuli.length === 0) {
    throw new Error(`Eval file contains no stimuli: ${evalPath}`);
  }
  const expectedCount = evalDocument.stimuli.length * spec.experiment.repetitions;
  const count = requireCompleteGeneration(
    readVallyJsonl(answerFile),
    expectedCount
  ).length;
  return {
    ...task,
    answerFile,
    runDirectory,
    count,
  };
}

async function gradeAnswers(
  worktree: string,
  evalRepoRoot: string,
  outputRoot: string,
  spec: SkillImprovementRunSpec,
  phase: string,
  iteration: number | undefined,
  generated: GeneratedAnswers,
  judgeModel: string,
  deadline: number,
): Promise<JudgedTrial[]> {
  assertBeforeDeadline(deadline);
  const testsDirectory = path.join(evalRepoRoot, "tests");
  const evalPath = resolveEvaluationPath(
    evalRepoRoot,
    spec,
    generated.evalFile
  );
  const judgeDirectory = path.join(
    outputRoot,
    "judgments",
    slug(generated.condition.name),
    slug(generated.answerModel),
    slug(generated.evalFile)
  );
  fs.mkdirSync(judgeDirectory, { recursive: true });
  const judgmentFile = path.join(judgeDirectory, `${slug(judgeModel)}.jsonl`);
  const stderrFile = path.join(judgeDirectory, `${slug(judgeModel)}.stderr.log`);

  const launch = createGradingLaunch(spec, {
    worktree,
    evalRepoRoot,
    testsDirectory,
    evalPath,
    evalFile: generated.evalFile,
    answerModel: generated.answerModel,
    judgeModel,
    generationDirectory: path.dirname(generated.answerFile),
    answerFile: generated.answerFile,
    runDirectory: generated.runDirectory,
    judgmentDirectory: judgeDirectory,
    condition: generated.condition,
  });
  await runProcess(launch.command, launch.args, {
    cwd: launch.cwd,
    env: launch.env,
    stdinFile: generated.answerFile,
    stdoutFile: judgmentFile,
    stderrFile,
    timeoutMs: Math.max(deadline - Date.now(), 1),
  });

  return requireCompleteGrading(readVallyJsonl(judgmentFile), generated.count)
    .map(record => ({
      phase,
      iteration,
      condition: generated.condition,
      answerModel: generated.answerModel,
      judgeModel,
      evalFile: generated.evalFile,
      itemId: canonicalItemId(record),
      stimulus: record.trajectory?.stimulus?.name ?? record.stimulus ?? "unknown",
      area: record.trajectory?.stimulus?.tags?.area ?? "unknown",
      passed: record.gradeResult?.passed === true,
      score: record.gradeResult?.score ?? 0,
      evidence: [
        record.gradeResult?.evidence,
        ...flattenEvidence(record.gradeResult?.details),
      ].filter((value): value is string => Boolean(value)).join("\n"),
      details: record.gradeResult?.details ?? [],
      output: record.trajectory?.output ?? "",
      targetSkillInvoked:
        (record.trajectory?.metrics?.skillActivationBreakdown?.[spec.target.skill] ?? 0) > 0,
      kustoToolCalls: countKustoToolCalls(record),
      totalTokens: record.trajectory?.metrics?.tokenUsage?.totalTokens ?? 0,
    }));
}

export async function runEvaluationBatch(
  worktree: string,
  evalRepoRoot: string,
  outputRoot: string,
  spec: SkillImprovementRunSpec,
  phase: string,
  evalFiles: string[],
  conditions: EvaluationCondition[],
  deadline: number,
  iteration?: number,
): Promise<EvaluationBatch> {
  const tasks: GenerationTask[] = conditions.flatMap(condition =>
    spec.models.answers.flatMap(answerModel =>
      evalFiles.map(evalFile => ({ condition, answerModel, evalFile }))
    )
  );
  const generated: GeneratedAnswers[] = new Array(tasks.length);
  await runWithConcurrency(
    tasks,
    spec.limits.maxConcurrentJobs,
    async (task, index) => {
      generated[index] = await generateAnswers(
        worktree,
        evalRepoRoot,
        outputRoot,
        spec,
        task,
        deadline
      );
    }
  );

  const gradingTasks = generated.flatMap(item =>
    spec.models.judges.map(judgeModel => ({ item, judgeModel }))
  );
  const judged: JudgedTrial[][] = new Array(gradingTasks.length);
  await runWithConcurrency(
    gradingTasks,
    spec.limits.maxConcurrentJobs,
    async ({ item, judgeModel }, index) => {
      judged[index] = await gradeAnswers(
        worktree,
        evalRepoRoot,
        outputRoot,
        spec,
        phase,
        iteration,
        item,
        judgeModel,
        deadline
      );
    }
  );

  return {
    trials: judged.flat(),
    answerGenerations: generated.reduce((total, item) => total + item.count, 0),
    judgeCalls: judged.flat().length,
  };
}
