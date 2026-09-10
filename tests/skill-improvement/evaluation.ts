import fs from "node:fs";
import path from "node:path";
import type {
  EvaluationCondition,
  SkillImprovementRunSpec,
} from "./config.ts";
import {
  commandName,
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

type VallyRecord = {
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

function readJsonl(filePath: string): VallyRecord[] {
  return fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => JSON.parse(line) as VallyRecord);
}

export function findVallyRunDirectory(root: string): string {
  const candidates = fs.readdirSync(root, { withFileTypes: true })
    .filter(entry =>
      entry.isDirectory()
      && fs.existsSync(path.join(root, entry.name, "eval-results.md"))
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
  const evalPath = path.join(
    evalRepoRoot,
    "evals",
    spec.target.plugin,
    spec.target.skill,
    task.evalFile
  );
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

  await runProcess(commandName("npx"), [
    "-y",
    "@microsoft/vally-cli",
    "eval",
    "--eval-spec",
    evalPath,
    "--executor-plugin",
    path.join(testsDirectory, "vally", "vally-executor.ts"),
    "--grader-plugin",
    path.join(testsDirectory, "vally", "vally-graders.ts"),
    "--output-dir",
    taskDirectory,
    "--model",
    task.answerModel,
    "--runs",
    String(spec.experiment.repetitions),
    "--workers",
    "1",
    "--max-retries",
    "0",
    "--skip-grade",
    "--output",
    "jsonl",
  ], {
    cwd: testsDirectory,
    env,
    stdoutFile: answerFile,
    stderrFile,
    timeoutMs: Math.max(deadline - Date.now(), 1),
  });

  const runDirectory = findVallyRunDirectory(taskDirectory);
  const count = readJsonl(answerFile)
    .filter(record => record.type === "trial-result" || record.trajectory)
    .length;
  if (count === 0) {
    throw new Error(`No generated trajectories found in ${answerFile}.`);
  }
  return {
    ...task,
    answerFile,
    runDirectory,
    count,
  };
}

async function gradeAnswers(
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
  const evalPath = path.join(
    evalRepoRoot,
    "evals",
    spec.target.plugin,
    spec.target.skill,
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

  await runProcess(commandName("npx"), [
    "-y",
    "@microsoft/vally-cli",
    "grade",
    "--eval-spec",
    evalPath,
    "--grader-plugin",
    path.join(testsDirectory, "vally", "vally-graders.ts"),
    "--judge-model",
    judgeModel,
    "--run-dir",
    generated.runDirectory,
    "--output",
    "jsonl",
    "--verbose",
  ], {
    cwd: testsDirectory,
    stdinFile: generated.answerFile,
    stdoutFile: judgmentFile,
    stderrFile,
    timeoutMs: Math.max(deadline - Date.now(), 1),
  });

  return readJsonl(judgmentFile)
    .filter(record => record.type === "trial-result" && record.gradeResult)
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
