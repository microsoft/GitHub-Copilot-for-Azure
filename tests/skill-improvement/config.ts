import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";

export type SkillState = "enabled" | "disabled";
export type McpState = "enabled" | "disabled";

export type EvaluationCondition = {
  name: string;
  skill: SkillState;
  mcp: McpState;
};

export type SkillImprovementRunSpec = {
  name: string;
  target: {
    plugin: string;
    skill: string;
    baselineRef: string;
    editablePaths?: string[];
  };
  evaluations: {
    development: string[];
    heldOut?: string[];
  };
  models: {
    answers: string[];
    judges: string[];
  };
  experiment: {
    repetitions: number;
    conditions: EvaluationCondition[];
  };
  improvementAgent: {
    enabled: boolean;
    model: string;
    maxAiCredits?: number;
  };
  acceptance: {
    minimumQualityImprovementPoints: number;
    maximumEvalRegressionPoints: number;
    maximumModelRegressionPoints: number;
    minimumSkillInvocationRate?: number;
    requireHeldOutImprovement?: boolean;
  };
  limits: {
    maxIterations: number;
    maxAnswerGenerations: number;
    maxJudgeCalls: number;
    maxDurationMinutes: number;
    maxConcurrentJobs: number;
    maxSkillTokenIncreasePercent: number;
  };
  output: {
    issue: "always" | "never";
    draftPullRequest: "accepted-candidate-only" | "never";
  };
};

export type RunPlan = {
  developmentPromptCount: number;
  heldOutPromptCount: number;
  baselineAnswerGenerations: number;
  candidateAnswerGenerationsPerIteration: number;
  heldOutAnswerGenerations: number;
  maximumAnswerGenerations: number;
  maximumJudgeCalls: number;
};

function requireNonEmptyString(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string.`);
  }
}

function requirePositiveInteger(value: unknown, field: string, allowZero = false): asserts value is number {
  if (!Number.isInteger(value) || (allowZero ? Number(value) < 0 : Number(value) < 1)) {
    throw new Error(`${field} must be ${allowZero ? "a non-negative" : "a positive"} integer.`);
  }
}

function requireNonNegativeNumber(value: unknown, field: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${field} must be a non-negative number.`);
  }
}

function validateStringArray(value: unknown, field: string, allowEmpty = false): asserts value is string[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    throw new Error(`${field} must be ${allowEmpty ? "an" : "a non-empty"} array.`);
  }
  for (const item of value) {
    requireNonEmptyString(item, `${field} item`);
  }
  if (new Set(value).size !== value.length) {
    throw new Error(`${field} must not contain duplicates.`);
  }
}

function validateEvalFiles(files: string[], field: string): void {
  for (const file of files) {
    if (path.basename(file) !== file || !file.endsWith(".yaml")) {
      throw new Error(`${field} contains an invalid eval filename: ${file}`);
    }
  }
}

export function validateRunSpec(value: unknown): SkillImprovementRunSpec {
  if (!value || typeof value !== "object") {
    throw new Error("Run specification must be a YAML object.");
  }
  const spec = value as SkillImprovementRunSpec;
  requireNonEmptyString(spec.name, "name");
  requireNonEmptyString(spec.target?.plugin, "target.plugin");
  requireNonEmptyString(spec.target?.skill, "target.skill");
  requireNonEmptyString(spec.target?.baselineRef, "target.baselineRef");
  if (spec.target.editablePaths) {
    validateStringArray(spec.target.editablePaths, "target.editablePaths");
  }

  validateStringArray(spec.evaluations?.development, "evaluations.development");
  validateEvalFiles(spec.evaluations.development, "evaluations.development");
  if (spec.evaluations.heldOut) {
    validateStringArray(spec.evaluations.heldOut, "evaluations.heldOut", true);
    validateEvalFiles(spec.evaluations.heldOut, "evaluations.heldOut");
    const overlap = spec.evaluations.heldOut.filter(file => spec.evaluations.development.includes(file));
    if (overlap.length > 0) {
      throw new Error(`Held-out eval files must not also be development files: ${overlap.join(", ")}`);
    }
    if (
      spec.acceptance?.requireHeldOutImprovement
      && (spec.evaluations.heldOut?.length ?? 0) === 0
    ) {
      throw new Error(
        "evaluations.heldOut must contain at least one file when requireHeldOutImprovement is true."
      );
    }
  }

  validateStringArray(spec.models?.answers, "models.answers");
  validateStringArray(spec.models?.judges, "models.judges");
  requirePositiveInteger(spec.experiment?.repetitions, "experiment.repetitions");
  if (!Array.isArray(spec.experiment?.conditions) || spec.experiment.conditions.length === 0) {
    throw new Error("experiment.conditions must be a non-empty array.");
  }
  const conditionNames = new Set<string>();
  for (const condition of spec.experiment.conditions) {
    requireNonEmptyString(condition.name, "experiment.conditions[].name");
    if (condition.skill !== "enabled" && condition.skill !== "disabled") {
      throw new Error(`Condition ${condition.name} has invalid skill state.`);
    }
    if (condition.mcp !== "enabled" && condition.mcp !== "disabled") {
      throw new Error(`Condition ${condition.name} has invalid MCP state.`);
    }
    if (conditionNames.has(condition.name)) {
      throw new Error(`Duplicate condition name: ${condition.name}`);
    }
    conditionNames.add(condition.name);
  }
  if (!spec.experiment.conditions.some(condition => condition.skill === "enabled")) {
    throw new Error("At least one condition must enable the target skill.");
  }
  if (!spec.experiment.conditions.some(condition => condition.skill === "disabled")) {
    throw new Error("At least one condition must disable the target skill for attribution.");
  }

  const targetSkillPrefix =
    `plugins/${spec.target.plugin}/skills/${spec.target.skill}/`;
  for (const editablePath of spec.target.editablePaths ?? [targetSkillPrefix]) {
    const normalized = editablePath.replaceAll("\\", "/").replace(/\/\*\*$/, "");
    const withSlash = normalized.endsWith("/") ? normalized : `${normalized}/`;
    if (!withSlash.startsWith(targetSkillPrefix)) {
      throw new Error(
        `target.editablePaths must remain inside ${targetSkillPrefix}: ${editablePath}`
      );
    }
  }

  if (typeof spec.improvementAgent?.enabled !== "boolean") {
    throw new Error("improvementAgent.enabled must be a boolean.");
  }
  requireNonEmptyString(spec.improvementAgent.model, "improvementAgent.model");
  if (spec.improvementAgent.maxAiCredits !== undefined) {
    requireNonNegativeNumber(spec.improvementAgent.maxAiCredits, "improvementAgent.maxAiCredits");
  }

  requireNonNegativeNumber(
    spec.acceptance?.minimumQualityImprovementPoints,
    "acceptance.minimumQualityImprovementPoints"
  );
  requireNonNegativeNumber(
    spec.acceptance?.maximumEvalRegressionPoints,
    "acceptance.maximumEvalRegressionPoints"
  );
  requireNonNegativeNumber(
    spec.acceptance?.maximumModelRegressionPoints,
    "acceptance.maximumModelRegressionPoints"
  );
  if (spec.acceptance.minimumSkillInvocationRate !== undefined) {
    const rate = spec.acceptance.minimumSkillInvocationRate;
    if (typeof rate !== "number" || rate < 0 || rate > 1) {
      throw new Error("acceptance.minimumSkillInvocationRate must be between 0 and 1.");
    }
    if (
      spec.acceptance.requireHeldOutImprovement !== undefined
      && typeof spec.acceptance.requireHeldOutImprovement !== "boolean"
    ) {
      throw new Error("acceptance.requireHeldOutImprovement must be a boolean.");
    }
  }

  requirePositiveInteger(spec.limits?.maxIterations, "limits.maxIterations", true);
  requirePositiveInteger(spec.limits?.maxAnswerGenerations, "limits.maxAnswerGenerations");
  requirePositiveInteger(spec.limits?.maxJudgeCalls, "limits.maxJudgeCalls");
  requirePositiveInteger(spec.limits?.maxDurationMinutes, "limits.maxDurationMinutes");
  requirePositiveInteger(spec.limits?.maxConcurrentJobs, "limits.maxConcurrentJobs");
  requireNonNegativeNumber(
    spec.limits?.maxSkillTokenIncreasePercent,
    "limits.maxSkillTokenIncreasePercent"
  );
  if (spec.output?.issue !== "always" && spec.output?.issue !== "never") {
    throw new Error("output.issue must be 'always' or 'never'.");
  }
  if (
    spec.output?.draftPullRequest !== "accepted-candidate-only"
    && spec.output?.draftPullRequest !== "never"
  ) {
    throw new Error(
      "output.draftPullRequest must be 'accepted-candidate-only' or 'never'."
    );
  }
  return spec;
}

export function loadRunSpec(filePath: string): SkillImprovementRunSpec {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Run specification not found: ${resolvedPath}`);
  }
  return validateRunSpec(parse(fs.readFileSync(resolvedPath, "utf8")));
}

function countStimuli(repoRoot: string, spec: SkillImprovementRunSpec, files: string[]): number {
  const evalDirectory = path.join(
    repoRoot,
    "evals",
    spec.target.plugin,
    spec.target.skill
  );
  return files.reduce((total, file) => {
    const evalPath = path.join(evalDirectory, file);
    if (!fs.existsSync(evalPath)) {
      throw new Error(`Eval file not found: ${evalPath}`);
    }
    const document = parse(fs.readFileSync(evalPath, "utf8")) as { stimuli?: unknown[] };
    if (!Array.isArray(document.stimuli) || document.stimuli.length === 0) {
      throw new Error(`Eval file contains no stimuli: ${evalPath}`);
    }
    return total + document.stimuli.length;
  }, 0);
}

export function createRunPlan(repoRoot: string, spec: SkillImprovementRunSpec): RunPlan {
  const developmentPromptCount = countStimuli(
    repoRoot,
    spec,
    spec.evaluations.development
  );
  const heldOutPromptCount = countStimuli(
    repoRoot,
    spec,
    spec.evaluations.heldOut ?? []
  );
  const answerModels = spec.models.answers.length;
  const repetitions = spec.experiment.repetitions;
  const baselineConditions = spec.experiment.conditions.length;
  const candidateConditions = spec.experiment.conditions.filter(
    condition => condition.skill === "enabled"
  ).length;
  const plannedIterations = spec.improvementAgent.enabled
    ? spec.limits.maxIterations
    : 0;
  const baselineAnswerGenerations =
    developmentPromptCount * answerModels * repetitions * baselineConditions;
  const candidateAnswerGenerationsPerIteration =
    developmentPromptCount * answerModels * repetitions * candidateConditions;
  const heldOutAnswerGenerations = (
    heldOutPromptCount === 0
    || !spec.acceptance.requireHeldOutImprovement
    || plannedIterations === 0
  )
    ? 0
    : heldOutPromptCount * answerModels * repetitions * candidateConditions * 2;
  const maximumAnswerGenerations =
    baselineAnswerGenerations
    + candidateAnswerGenerationsPerIteration * plannedIterations
    + heldOutAnswerGenerations;
  const maximumJudgeCalls = maximumAnswerGenerations * spec.models.judges.length;

  return {
    developmentPromptCount,
    heldOutPromptCount,
    baselineAnswerGenerations,
    candidateAnswerGenerationsPerIteration,
    heldOutAnswerGenerations,
    maximumAnswerGenerations,
    maximumJudgeCalls,
  };
}

export function enforceRunLimits(spec: SkillImprovementRunSpec, plan: RunPlan): void {
  if (plan.maximumAnswerGenerations > spec.limits.maxAnswerGenerations) {
    throw new Error(
      `Run requires up to ${plan.maximumAnswerGenerations} answer generations, `
      + `exceeding limits.maxAnswerGenerations=${spec.limits.maxAnswerGenerations}.`
    );
  }
  if (plan.maximumJudgeCalls > spec.limits.maxJudgeCalls) {
    throw new Error(
      `Run requires up to ${plan.maximumJudgeCalls} judge calls, `
      + `exceeding limits.maxJudgeCalls=${spec.limits.maxJudgeCalls}.`
    );
  }
}

export function editablePathPrefixes(spec: SkillImprovementRunSpec): string[] {
  const defaults = [
    `plugins/${spec.target.plugin}/skills/${spec.target.skill}/`,
  ];
  return (spec.target.editablePaths ?? defaults)
    .map(value => value.replaceAll("\\", "/").replace(/\/\*\*$/, ""))
    .map(value => value.endsWith("/") ? value : `${value}/`);
}
