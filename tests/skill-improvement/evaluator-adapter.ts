import fs from "node:fs";
import path from "node:path";
import type {
  EvaluationCondition,
  EvaluatorCommand,
  EvaluatorPlaceholder,
  SkillImprovementRunSpec,
} from "./config.ts";
import { commandName } from "./process.ts";

type PlaceholderValues = Record<EvaluatorPlaceholder, string>;

export type EvaluatorLaunch = {
  command: string;
  args: string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
};

export type GenerationAdapterContext = {
  worktree: string;
  evalRepoRoot: string;
  testsDirectory: string;
  evalPath: string;
  evalFile: string;
  answerModel: string;
  generationDirectory: string;
  answerFile: string;
  condition: EvaluationCondition;
  conditionEnvironment: NodeJS.ProcessEnv;
};

export type GradingAdapterContext = {
  worktree: string;
  evalRepoRoot: string;
  testsDirectory: string;
  evalPath: string;
  evalFile: string;
  answerModel: string;
  judgeModel: string;
  generationDirectory: string;
  answerFile: string;
  runDirectory: string;
  judgmentDirectory: string;
  condition: EvaluationCondition;
};

function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === ""
    || (
      relative !== ".."
      && !relative.startsWith(`..${path.sep}`)
      && !path.isAbsolute(relative)
    );
}

export function resolveEvaluatorWorkingDirectory(
  evalRepoRoot: string,
  configuredDirectory: string | undefined,
): string {
  const relativeDirectory = configuredDirectory ?? "tests";
  const segments = relativeDirectory === "."
    ? []
    : relativeDirectory.replaceAll("\\", "/").split("/");
  const candidate = path.resolve(evalRepoRoot, ...segments);
  if (!isWithin(evalRepoRoot, candidate)) {
    throw new Error(
      `Evaluator working directory resolves outside the repository: ${configuredDirectory}.`
    );
  }
  if (!fs.existsSync(candidate) || !fs.statSync(candidate).isDirectory()) {
    throw new Error(`Evaluator working directory not found: ${candidate}.`);
  }
  const realRoot = fs.realpathSync(evalRepoRoot);
  const realCandidate = fs.realpathSync(candidate);
  if (!isWithin(realRoot, realCandidate)) {
    throw new Error(
      `Evaluator working directory resolves outside the repository: ${configuredDirectory}.`
    );
  }
  return candidate;
}

function expandValue(value: string, placeholders: PlaceholderValues): string {
  if (!value.includes("{") && !value.includes("}")) {
    return value;
  }
  const expanded = placeholders[value as EvaluatorPlaceholder];
  if (expanded === undefined) {
    throw new Error(`Unsupported evaluator placeholder: ${value}.`);
  }
  return expanded;
}

function expandEnvironment(
  configuredEnvironment: Record<string, string> | undefined,
  placeholders: PlaceholderValues,
  baseEnvironment?: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv | undefined {
  if (!configuredEnvironment && !baseEnvironment) {
    return undefined;
  }
  const expanded: NodeJS.ProcessEnv = { ...baseEnvironment };
  for (const [name, value] of Object.entries(configuredEnvironment ?? {})) {
    expanded[name] = expandValue(value, placeholders);
  }
  return expanded;
}

function customLaunch(
  command: EvaluatorCommand,
  evalRepoRoot: string,
  placeholders: PlaceholderValues,
  baseEnvironment?: NodeJS.ProcessEnv,
): EvaluatorLaunch {
  const expandedArgs = command.args.map(value => expandValue(value, placeholders));
  return {
    command: commandName(command.executable),
    args: ["run", "--silent", ...expandedArgs.slice(1)],
    cwd: resolveEvaluatorWorkingDirectory(
      evalRepoRoot,
      command.workingDirectory
    ),
    env: expandEnvironment(command.environment, placeholders, baseEnvironment),
  };
}

function placeholders(
  spec: SkillImprovementRunSpec,
  context: GenerationAdapterContext | GradingAdapterContext,
): PlaceholderValues {
  const grading = "judgeModel" in context;
  return {
    "{evalPath}": context.evalPath,
    "{evalFile}": context.evalFile,
    "{answerModel}": context.answerModel,
    "{judgeModel}": grading ? context.judgeModel : "",
    "{repetitions}": String(spec.experiment.repetitions),
    "{generationDirectory}": context.generationDirectory,
    "{answerFile}": context.answerFile,
    "{runDirectory}": grading ? context.runDirectory : "",
    "{judgmentDirectory}": grading ? context.judgmentDirectory : "",
    "{targetPlugin}": spec.target.plugin,
    "{targetSkill}": spec.target.skill,
    "{conditionName}": context.condition.name,
    "{pluginOutputRoot}": path.join(context.worktree, "output"),
  };
}

export function createGenerationLaunch(
  spec: SkillImprovementRunSpec,
  context: GenerationAdapterContext,
): EvaluatorLaunch {
  if (spec.evaluator) {
    return customLaunch(
      spec.evaluator.generate,
      context.evalRepoRoot,
      placeholders(spec, context),
      context.conditionEnvironment
    );
  }
  return {
    command: commandName("npx"),
    args: [
      "-y",
      "@microsoft/vally-cli",
      "eval",
      "--eval-spec",
      context.evalPath,
      "--executor-plugin",
      path.join(context.testsDirectory, "vally", "vally-executor.ts"),
      "--grader-plugin",
      path.join(context.testsDirectory, "vally", "vally-graders.ts"),
      "--output-dir",
      context.generationDirectory,
      "--model",
      context.answerModel,
      "--runs",
      String(spec.experiment.repetitions),
      "--workers",
      "1",
      "--max-retries",
      "0",
      "--skip-grade",
      "--output",
      "jsonl",
    ],
    cwd: context.testsDirectory,
    env: context.conditionEnvironment,
  };
}

export function createGradingLaunch(
  spec: SkillImprovementRunSpec,
  context: GradingAdapterContext,
): EvaluatorLaunch {
  if (spec.evaluator) {
    return customLaunch(
      spec.evaluator.grade,
      context.evalRepoRoot,
      placeholders(spec, context)
    );
  }
  return {
    command: commandName("npx"),
    args: [
      "-y",
      "@microsoft/vally-cli",
      "grade",
      "--eval-spec",
      context.evalPath,
      "--grader-plugin",
      path.join(context.testsDirectory, "vally", "vally-graders.ts"),
      "--judge-model",
      context.judgeModel,
      "--run-dir",
      context.runDirectory,
      "--output",
      "jsonl",
      "--verbose",
    ],
    cwd: context.testsDirectory,
  };
}
