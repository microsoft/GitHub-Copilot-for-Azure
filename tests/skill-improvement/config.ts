import fs from "node:fs";
import path from "node:path";
import { parse, stringify } from "yaml";

export type SkillState = "enabled" | "disabled";
export type McpState = "enabled" | "disabled";

export type EvaluationCondition = {
  name: string;
  skill: SkillState;
  mcp: McpState;
  developmentEvaluations?: string[];
  heldOutEvaluations?: string[];
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
    root: string;
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
  refinement: {
    minimumScoreImprovementPoints: number;
    maximumQualityRegressionPoints: number;
  };
  resources?: {
    kusto?: {
      subscriptionId: string;
      resourceGroup: string;
      clusterName: string;
      databaseName: string;
      startBeforeRun: boolean;
      stopAfterRun: boolean;
      startupTimeoutMinutes: number;
    };
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

const ENVIRONMENT_VARIABLE_PATTERN = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;
const ALLOWED_ENVIRONMENT_VARIABLES = new Set([
  "AZURE_EVALS_RESOURCE_GROUP",
  "AZURE_EVALS_SUBSCRIPTION_ID",
]);

export function expandEnvironmentVariables<T>(
  value: T,
  source: string,
  environment: NodeJS.ProcessEnv = process.env,
): T {
  const missing = new Set<string>();
  const unsupported = new Set<string>();
  const expand = (current: unknown): unknown => {
    if (typeof current === "string") {
      return current.replace(
        ENVIRONMENT_VARIABLE_PATTERN,
        (placeholder, name: string) => {
          if (!ALLOWED_ENVIRONMENT_VARIABLES.has(name)) {
            unsupported.add(name);
            return placeholder;
          }
          const environmentValue = environment[name];
          if (environmentValue === undefined || environmentValue.length === 0) {
            missing.add(name);
            return placeholder;
          }
          return environmentValue;
        }
      );
    }
    if (Array.isArray(current)) {
      return current.map(expand);
    }
    if (current && typeof current === "object") {
      return Object.fromEntries(
        Object.entries(current).map(([key, child]) => [key, expand(child)])
      );
    }
    return current;
  };
  const expanded = expand(value) as T;
  if (unsupported.size > 0) {
    throw new Error(
      `Unsupported environment variables referenced by ${source}: `
      + Array.from(unsupported).sort().join(", ")
    );
  }
  if (missing.size > 0) {
    throw new Error(
      `Missing environment variables referenced by ${source}: `
      + Array.from(missing).sort().join(", ")
    );
  }
  return expanded;
}

function readExpandedYaml<T>(
  filePath: string,
  environment: NodeJS.ProcessEnv = process.env,
): T {
  return expandEnvironmentVariables(
    parse(fs.readFileSync(filePath, "utf8")) as T,
    filePath,
    environment
  );
}

function evaluationFileSources(document: unknown): string[] {
  if (!document || typeof document !== "object") {
    return [];
  }
  const stimuli = (document as { stimuli?: unknown }).stimuli;
  if (!Array.isArray(stimuli)) {
    return [];
  }
  const sources = new Set<string>();
  for (const stimulus of stimuli) {
    if (!stimulus || typeof stimulus !== "object") {
      continue;
    }
    for (const environmentField of ["environment", "agent_environment"] as const) {
      const environment = (stimulus as Record<string, unknown>)[environmentField];
      if (!environment || typeof environment !== "object") {
        continue;
      }
      const files = (environment as { files?: unknown }).files;
      if (!Array.isArray(files)) {
        continue;
      }
      for (const file of files) {
        if (!file || typeof file !== "object") {
          continue;
        }
        const source = (file as { src?: unknown }).src;
        if (typeof source === "string" && source.length > 0) {
          sources.add(source);
        }
      }
    }
  }
  return Array.from(sources);
}

export function materializeEvaluationFile(
  sourcePath: string,
  destinationPath: string,
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const document = readExpandedYaml<unknown>(sourcePath, environment);
  const sourceDirectory = path.dirname(sourcePath);
  const destinationDirectory = path.dirname(destinationPath);
  fs.mkdirSync(destinationDirectory, { recursive: true });
  for (const relativeSource of evaluationFileSources(document)) {
    if (path.isAbsolute(relativeSource)) {
      throw new Error(
        `Evaluation fixture source must be relative to ${sourcePath}: ${relativeSource}`
      );
    }
    const resolvedSource = path.resolve(sourceDirectory, relativeSource);
    const resolvedDestination = path.resolve(destinationDirectory, relativeSource);
    const sourcePrefix = `${path.resolve(sourceDirectory)}${path.sep}`;
    const destinationPrefix = `${path.resolve(destinationDirectory)}${path.sep}`;
    if (
      !resolvedSource.startsWith(sourcePrefix)
      || !resolvedDestination.startsWith(destinationPrefix)
    ) {
      throw new Error(
        `Evaluation fixture source must stay within its eval directory: ${relativeSource}`
      );
    }
    if (!fs.existsSync(resolvedSource)) {
      throw new Error(`Evaluation fixture source does not exist: ${resolvedSource}`);
    }
    fs.mkdirSync(path.dirname(resolvedDestination), { recursive: true });
    fs.cpSync(resolvedSource, resolvedDestination, { recursive: true });
  }
  fs.writeFileSync(destinationPath, stringify(document), "utf8");
  return destinationPath;
}

function requireNonEmptyString(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string.`);
  }
}

function requireRepositoryDirectoryName(
  value: unknown,
  field: string,
): asserts value is string {
  requireNonEmptyString(value, field);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new Error(
      `${field} must be a repository-safe lowercase hyphenated directory name.`
    );
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
    if (
      path.posix.isAbsolute(file)
      || path.win32.isAbsolute(file)
      || file.includes("/")
      || file.includes("\\")
      || file.includes("\0")
      || !file.endsWith(".yaml")
    ) {
      throw new Error(`${field} contains an invalid eval filename: ${file}`);
    }
  }
}

const EVALUATION_ROOT_PREFIXES = [
  "tests/skill-improvement/evals",
  "evals",
] as const;
const EVALUATION_ROOT_REQUIREMENT =
  "tests/skill-improvement/evals or evals";

function findEvaluationRootPrefix(value: string): string | undefined {
  return EVALUATION_ROOT_PREFIXES.find(prefix =>
    value === prefix || value.startsWith(`${prefix}/`)
  );
}

function validateEvaluationRoot(value: unknown): asserts value is string {
  requireNonEmptyString(value, "evaluations.root");
  if (
    path.posix.isAbsolute(value)
    || path.win32.isAbsolute(value)
    || value.includes("\\")
    || value.includes("\0")
  ) {
    throw new Error(
      `evaluations.root must be a repository-relative directory inside ${EVALUATION_ROOT_REQUIREMENT}.`
    );
  }
  const segments = value.split("/");
  const rootPrefix = findEvaluationRootPrefix(value);
  const rootSegments = rootPrefix?.split("/") ?? [];
  if (
    rootPrefix === undefined ||
    segments.some(segment => segment.length === 0 || segment === "." || segment === "..")
    || segments.slice(rootSegments.length).some(
      segment => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(segment)
    )
  ) {
    throw new Error(
      `evaluations.root must be a repository-relative directory inside ${EVALUATION_ROOT_REQUIREMENT}.`
    );
  }
}

export function validateRunSpec(value: unknown): SkillImprovementRunSpec {
  if (!value || typeof value !== "object") {
    throw new Error("Run specification must be a YAML object.");
  }
  const spec = value as SkillImprovementRunSpec;
  requireNonEmptyString(spec.name, "name");
  requireRepositoryDirectoryName(spec.target?.plugin, "target.plugin");
  requireRepositoryDirectoryName(spec.target?.skill, "target.skill");
  requireNonEmptyString(spec.target?.baselineRef, "target.baselineRef");
  if (spec.target.editablePaths) {
    validateStringArray(spec.target.editablePaths, "target.editablePaths");
  }

  validateEvaluationRoot(spec.evaluations?.root);
  validateStringArray(spec.evaluations?.development, "evaluations.development");
  validateEvalFiles(spec.evaluations.development, "evaluations.development");
  if (spec.evaluations.heldOut) {
    validateStringArray(spec.evaluations.heldOut, "evaluations.heldOut", true);
    validateEvalFiles(spec.evaluations.heldOut, "evaluations.heldOut");
    const overlap = spec.evaluations.heldOut.filter(file => spec.evaluations.development.includes(file));
    if (overlap.length > 0) {
      throw new Error(`Held-out eval files must not also be development files: ${overlap.join(", ")}`);
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
    for (const field of [
      "developmentEvaluations",
      "heldOutEvaluations",
    ] as const) {
      const files = condition[field];
      if (files === undefined) {
        continue;
      }
      validateStringArray(
        files,
        `experiment.conditions[].${field}`,
        true
      );
      validateEvalFiles(files, `experiment.conditions[].${field}`);
      const commonFiles = field === "developmentEvaluations"
        ? spec.evaluations.development
        : spec.evaluations.heldOut ?? [];
      const overlap = files.filter(file => commonFiles.includes(file));
      if (overlap.length > 0) {
        throw new Error(
          `${condition.name} ${field} duplicates common evaluation files: ${overlap.join(", ")}`
        );
      }
    }
    conditionNames.add(condition.name);
  }
  if (!spec.experiment.conditions.some(condition => condition.skill === "enabled")) {
    throw new Error("At least one condition must enable the target skill.");
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
  }
  if (
    spec.acceptance.requireHeldOutImprovement !== undefined
    && typeof spec.acceptance.requireHeldOutImprovement !== "boolean"
  ) {
    throw new Error("acceptance.requireHeldOutImprovement must be a boolean.");
  }
  if (
    spec.acceptance.requireHeldOutImprovement
    && !hasHeldOutEvaluations(spec)
  ) {
    throw new Error(
      "At least one common or condition-specific held-out evaluation is required "
      + "when requireHeldOutImprovement is true."
    );
  }

  requireNonNegativeNumber(
    spec.refinement?.minimumScoreImprovementPoints,
    "refinement.minimumScoreImprovementPoints"
  );
  requireNonNegativeNumber(
    spec.refinement?.maximumQualityRegressionPoints,
    "refinement.maximumQualityRegressionPoints"
  );

  const kusto = spec.resources?.kusto;
  if (kusto) {
    requireNonEmptyString(kusto.subscriptionId, "resources.kusto.subscriptionId");
    requireNonEmptyString(kusto.resourceGroup, "resources.kusto.resourceGroup");
    requireNonEmptyString(kusto.clusterName, "resources.kusto.clusterName");
    requireNonEmptyString(kusto.databaseName, "resources.kusto.databaseName");
    if (typeof kusto.startBeforeRun !== "boolean") {
      throw new Error("resources.kusto.startBeforeRun must be a boolean.");
    }
    if (typeof kusto.stopAfterRun !== "boolean") {
      throw new Error("resources.kusto.stopAfterRun must be a boolean.");
    }
    requirePositiveInteger(
      kusto.startupTimeoutMinutes,
      "resources.kusto.startupTimeoutMinutes"
    );
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
  if (
    spec.acceptance.requireHeldOutImprovement
    && (!spec.improvementAgent.enabled || spec.limits.maxIterations === 0)
  ) {
    throw new Error(
      "requireHeldOutImprovement requires at least one candidate iteration."
    );
  }
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

export function loadRunSpec(
  filePath: string,
  environment: NodeJS.ProcessEnv = process.env,
): SkillImprovementRunSpec {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Run specification not found: ${resolvedPath}`);
  }
  return validateRunSpec(
    readExpandedYaml<SkillImprovementRunSpec>(resolvedPath, environment)
  );
}

export type RunSpecMetadata = {
  target: {
    baselineRef: string;
  };
};

export function loadRunSpecMetadata(filePath: string): RunSpecMetadata {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Run specification not found: ${resolvedPath}`);
  }
  const metadata = parse(fs.readFileSync(resolvedPath, "utf8")) as RunSpecMetadata;
  requireNonEmptyString(metadata?.target?.baselineRef, "target.baselineRef");
  return {
    target: {
      baselineRef: metadata.target.baselineRef,
    },
  };
}

function isInsideDirectory(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative === "" || (
    relative !== ".."
    && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative)
  );
}

export function resolveEvaluationPath(
  repoRoot: string,
  spec: SkillImprovementRunSpec,
  file: string,
): string {
  validateEvalFiles([file], "evaluation file");
  const resolvedRepoRoot = fs.realpathSync(repoRoot);
  const evaluationRootPrefix = findEvaluationRootPrefix(spec.evaluations.root);
  if (evaluationRootPrefix === undefined) {
    throw new Error(
      `Evaluation root must be inside ${EVALUATION_ROOT_REQUIREMENT}: ${spec.evaluations.root}`
    );
  }
  const allowedRoot = path.join(
    resolvedRepoRoot,
    ...evaluationRootPrefix.split("/")
  );
  const configuredRoot = path.join(
    resolvedRepoRoot,
    ...spec.evaluations.root.split("/")
  );
  if (!isInsideDirectory(allowedRoot, configuredRoot)) {
    throw new Error(
      `Evaluation root escapes ${evaluationRootPrefix}: ${spec.evaluations.root}`
    );
  }
  if (!fs.existsSync(configuredRoot)) {
    throw new Error(`Evaluation root not found: ${configuredRoot}`);
  }
  if (!fs.statSync(configuredRoot).isDirectory()) {
    throw new Error(`Evaluation root is not a directory: ${configuredRoot}`);
  }
  const realAllowedRoot = fs.realpathSync(allowedRoot);
  const realConfiguredRoot = fs.realpathSync(configuredRoot);
  if (
    !isInsideDirectory(resolvedRepoRoot, realAllowedRoot)
    || !isInsideDirectory(realAllowedRoot, realConfiguredRoot)
  ) {
    throw new Error(
      `Evaluation root escapes ${evaluationRootPrefix}: ${spec.evaluations.root}`
    );
  }
  const evalPath = path.join(realConfiguredRoot, file);
  if (!fs.existsSync(evalPath)) {
    throw new Error(`Eval file not found: ${evalPath}`);
  }
  if (!fs.statSync(evalPath).isFile()) {
    throw new Error(`Eval path is not a file: ${evalPath}`);
  }
  const realEvalPath = fs.realpathSync(evalPath);
  if (!isInsideDirectory(realConfiguredRoot, realEvalPath)) {
    throw new Error(`Eval file escapes evaluations.root: ${file}`);
  }
  return realEvalPath;
}

function countStimuli(repoRoot: string, spec: SkillImprovementRunSpec, files: string[]): number {
  return files.reduce((total, file) => {
    const evalPath = resolveEvaluationPath(repoRoot, spec, file);
    const document = readExpandedYaml<{ stimuli?: unknown[] }>(evalPath);
    if (!Array.isArray(document.stimuli) || document.stimuli.length === 0) {
      throw new Error(`Eval file contains no stimuli: ${evalPath}`);
    }
    return total + document.stimuli.length;
  }, 0);
}

export type EvaluationSet = "development" | "heldOut";

export function hasHeldOutEvaluations(
  spec: SkillImprovementRunSpec,
): boolean {
  return (
    (spec.evaluations.heldOut?.length ?? 0) > 0
    || spec.experiment.conditions.some(
      condition =>
        condition.skill === "enabled"
        && (condition.heldOutEvaluations?.length ?? 0) > 0
    )
  );
}

export function evaluationFilesForCondition(
  spec: SkillImprovementRunSpec,
  condition: EvaluationCondition,
  evaluationSet: EvaluationSet,
): string[] {
  const commonFiles = evaluationSet === "development"
    ? spec.evaluations.development
    : spec.evaluations.heldOut ?? [];
  const conditionFiles = evaluationSet === "development"
    ? condition.developmentEvaluations ?? []
    : condition.heldOutEvaluations ?? [];
  return [...commonFiles, ...conditionFiles];
}

export function createRunPlan(repoRoot: string, spec: SkillImprovementRunSpec): RunPlan {
  const candidateConditions = spec.experiment.conditions.filter(
    condition => condition.skill === "enabled"
  );
  const developmentFiles = Array.from(new Set([
    ...spec.evaluations.development,
    ...spec.experiment.conditions.flatMap(
      condition => condition.developmentEvaluations ?? []
    ),
  ]));
  const heldOutFiles = Array.from(new Set([
    ...(spec.evaluations.heldOut ?? []),
    ...candidateConditions.flatMap(
      condition => condition.heldOutEvaluations ?? []
    ),
  ]));
  const developmentPromptCount = countStimuli(
    repoRoot,
    spec,
    developmentFiles
  );
  const heldOutPromptCount = countStimuli(
    repoRoot,
    spec,
    heldOutFiles
  );
  const answerModels = spec.models.answers.length;
  const repetitions = spec.experiment.repetitions;
  const plannedIterations = spec.improvementAgent.enabled
    ? spec.limits.maxIterations
    : 0;
  const generationCount = (
    conditions: EvaluationCondition[],
    evaluationSet: EvaluationSet,
  ): number => conditions.reduce(
    (total, condition) => total + countStimuli(
      repoRoot,
      spec,
      evaluationFilesForCondition(spec, condition, evaluationSet)
    ),
    0
  ) * answerModels * repetitions;
  const baselineAnswerGenerations = generationCount(
    spec.experiment.conditions,
    "development"
  );
  const candidateAnswerGenerationsPerIteration = generationCount(
    candidateConditions,
    "development"
  );
  const heldOutAnswerGenerations = (
    heldOutPromptCount === 0
    || !spec.acceptance.requireHeldOutImprovement
    || plannedIterations === 0
  )
    ? 0
    : generationCount(candidateConditions, "heldOut") * 2;
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
