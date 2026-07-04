/**
 * Validate the vally suites in this repository to make sure they follow the
 * standards of this project in addition to following the vally eval suite schema.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import matter from "gray-matter";

type GrayMatterWithYamlEngine = typeof matter & {
  engines: {
    yaml: {
      parse: (value: string) => unknown;
    };
  };
};

type Stimuli = {
  name?: string;
  graders?: Array<{
    type?: string;
    config?: unknown;
  }>;
  tags?: {
    type?: string;
    tier?: string;
    cost?: string;
    area?: string;
    earlyTerminate?: string;
    followUp?: string[];
    systemPrompt?: string;
    takeScreenshot?: string;
    requiredSkills?: string[];
  };
};

type EvalSuite = {
  tags?: {
    type?: string;
    skill?: string;
  };
  stimuli?: Stimuli[];
};

const REQUIRED_TAG_KEYS = ["type", "tier", "cost", "area"] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateJsonObjectTag(
  displayPath: string,
  stimulusIndex: number,
  stimulusName: string | undefined,
  tagName: "systemPrompt",
  value: string | undefined,
): boolean;
function validateJsonObjectTag(
  displayPath: string,
  stimulusIndex: number,
  stimulusName: string | undefined,
  tagName: "earlyTerminate" | "takeScreenshot",
  value: string | undefined,
): boolean;
function validateJsonObjectTag(
  displayPath: string,
  stimulusIndex: number,
  stimulusName: string | undefined,
  tagName: "earlyTerminate" | "systemPrompt" | "takeScreenshot",
  value: string | undefined,
): boolean {
  if (!value) {
    return true;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (isPlainObject(parsed) || Array.isArray(parsed)) {
      return true;
    }
  } catch {
    // Fall through to the validation error below.
  }

  reportValidationError(
    displayPath,
    stimulusIndex,
    stimulusName,
    `tags.${tagName} must be parsable JSON`,
  );
  return false;
}

function validateSingleRule(
  displayPath: string,
  stimulusIndex: number,
  stimulusName: string | undefined,
  rule: unknown,
  ruleLabel: string,
): boolean {
  if (!isPlainObject(rule)) {
    reportValidationError(
      displayPath,
      stimulusIndex,
      stimulusName,
      `${ruleLabel} must be an object`,
    );
    return false;
  }

  if (rule.type !== "has-property") {
    reportValidationError(
      displayPath,
      stimulusIndex,
      stimulusName,
      `${ruleLabel}.type must be 'has-property'`,
    );
    return false;
  }

  if (typeof rule.key !== "string" || rule.key.trim().length === 0) {
    reportValidationError(
      displayPath,
      stimulusIndex,
      stimulusName,
      `${ruleLabel}.key must be a non-empty string`,
    );
    return false;
  }

  if (rule.value !== undefined) {
    if (rule.value !== "string" && rule.value !== "number") {
      reportValidationError(
        displayPath,
        stimulusIndex,
        stimulusName,
        `${ruleLabel}.value must be undefined or a string or a number`,
      );
    }
    return false;
  }

  return true;
}

function validateJsonObjectRulesGrader(
  displayPath: string,
  stimulusIndex: number,
  stimulusName: string | undefined,
  grader: { type?: string; config?: unknown },
): boolean {
  if (grader.type !== "json-object-rules") {
    return true;
  }

  if (!isPlainObject(grader.config)) {
    reportValidationError(
      displayPath,
      stimulusIndex,
      stimulusName,
      "graders.json-object-rules must define a config object with path and rules",
    );
    return false;
  }

  const { path, rules } = grader.config;
  if (typeof path !== "string" || path.trim().length === 0) {
    reportValidationError(
      displayPath,
      stimulusIndex,
      stimulusName,
      "graders.json-object-rules.config.path must be a non-empty string",
    );
    return false;
  }

  const ruleLabel = "graders.json-object-rules.config.rules";

  // rules as a JSON string (single rule object serialized)
  if (typeof rules === "string") {
    let parsedRules: unknown;
    try {
      parsedRules = JSON.parse(rules);
    } catch {
      reportValidationError(
        displayPath,
        stimulusIndex,
        stimulusName,
        `${ruleLabel} must be valid JSON`,
      );
      return false;
    }

    return validateSingleRule(displayPath, stimulusIndex, stimulusName, parsedRules, ruleLabel);
  }

  // rules as an array of rule objects
  if (Array.isArray(rules)) {
    if (rules.length === 0) {
      reportValidationError(
        displayPath,
        stimulusIndex,
        stimulusName,
        `${ruleLabel} must not be an empty array`,
      );
      return false;
    }

    let valid = true;
    for (const [ruleIndex, rule] of rules.entries()) {
      if (!validateSingleRule(displayPath, stimulusIndex, stimulusName, rule, `${ruleLabel}[${ruleIndex}]`)) {
        valid = false;
      }
    }
    return valid;
  }

  // rules as a single inline object
  if (isPlainObject(rules)) {
    return validateSingleRule(displayPath, stimulusIndex, stimulusName, rules, ruleLabel);
  }

  reportValidationError(
    displayPath,
    stimulusIndex,
    stimulusName,
    `${ruleLabel} must be a JSON string, an object, or an array of objects`,
  );
  return false;
}

const VALID_STRIP_COMMENTS = new Set(["xml", "java"]);

function validateFileContentRule(
  displayPath: string,
  stimulusIndex: number,
  stimulusName: string | undefined,
  rule: unknown,
  ruleLabel: string,
): boolean {
  if (!isPlainObject(rule)) {
    reportValidationError(displayPath, stimulusIndex, stimulusName, `${ruleLabel} must be an object`);
    return false;
  }

  let valid = true;

  if (typeof rule.glob !== "string" || rule.glob.trim().length === 0) {
    reportValidationError(displayPath, stimulusIndex, stimulusName, `${ruleLabel}.glob must be a non-empty string`);
    valid = false;
  }

  if (rule.stripComments !== undefined && !VALID_STRIP_COMMENTS.has(rule.stripComments as string)) {
    reportValidationError(displayPath, stimulusIndex, stimulusName, `${ruleLabel}.stripComments must be "xml" or "java"`);
    valid = false;
  }

  if (rule.scope !== undefined && (typeof rule.scope !== "string" || rule.scope.trim().length === 0)) {
    reportValidationError(displayPath, stimulusIndex, stimulusName, `${ruleLabel}.scope must be a non-empty string`);
    valid = false;
  }

  const hasMatches = rule.matches !== undefined;
  const hasNotMatches = rule["not-matches"] !== undefined;
  const hasAnyMatches = rule["any-matches"] !== undefined;

  if (!hasMatches && !hasNotMatches && !hasAnyMatches) {
    reportValidationError(displayPath, stimulusIndex, stimulusName, `${ruleLabel} must specify at least one of matches, not-matches, or any-matches`);
    valid = false;
  }

  for (const field of ["matches", "not-matches", "any-matches"] as const) {
    const value = rule[field];
    if (value === undefined) continue;
    if (typeof value !== "string" || value.trim().length === 0) {
      reportValidationError(displayPath, stimulusIndex, stimulusName, `${ruleLabel}.${field} must be a non-empty string`);
      valid = false;
      continue;
    }
    try {
      new RegExp(value);
    } catch {
      reportValidationError(displayPath, stimulusIndex, stimulusName, `${ruleLabel}.${field} must be a valid regex pattern`);
      valid = false;
    }
  }

  return valid;
}

function validateJavaUpgradeFileContentGrader(
  displayPath: string,
  stimulusIndex: number,
  stimulusName: string | undefined,
  grader: { type?: string; config?: unknown },
): boolean {
  if (grader.type !== "java-upgrade-file-content") {
    return true;
  }

  if (!isPlainObject(grader.config)) {
    reportValidationError(
      displayPath,
      stimulusIndex,
      stimulusName,
      "graders.java-upgrade-file-content must define a config object with rules",
    );
    return false;
  }

  const { rules } = grader.config;
  const ruleLabel = "graders.java-upgrade-file-content.config.rules";

  if (!Array.isArray(rules) || rules.length === 0) {
    reportValidationError(displayPath, stimulusIndex, stimulusName, `${ruleLabel} must be a non-empty array`);
    return false;
  }

  let valid = true;
  for (const [ruleIndex, rule] of rules.entries()) {
    if (!validateFileContentRule(displayPath, stimulusIndex, stimulusName, rule, `${ruleLabel}[${ruleIndex}]`)) {
      valid = false;
    }
  }
  return valid;
}

function validateFollowUpTag(
  displayPath: string,
  stimulusIndex: number,
  stimulusName: string | undefined,
  value: string[] | string | undefined,
): boolean {
  if (value === undefined) {
    return true;
  }

  if (Array.isArray(value) && value.every((entry) => typeof entry === "string")) {
    return true;
  }

  reportValidationError(
    displayPath,
    stimulusIndex,
    stimulusName,
    "tags.followUp must be a string array",
  );
  return false;
}

function validateRequiredSkillsTag(
  displayPath: string,
  stimulusIndex: number,
  stimulusName: string | undefined,
  value: string[] | string | undefined,
): boolean {
  if (value === undefined) {
    return true;
  }

  if (Array.isArray(value) && value.every((entry) => typeof entry === "string")) {
    return true;
  }

  reportValidationError(
    displayPath,
    stimulusIndex,
    stimulusName,
    "tags.requiredSkills must be a string array",
  );
  return false;
}

function reportValidationError(
  displayPath: string,
  stimulusIndex: number,
  stimulusName: string | undefined,
  message: string,
): void {
  const stimulusLabel = stimulusName ? `stimulus "${stimulusName}"` : `stimulus #${stimulusIndex + 1}`;
  console.error(`${displayPath}: ${stimulusLabel}: ${message}`);
  process.exitCode = 1;
}

function findEvalYamlFiles(dirPath: string): string[] {
  const entries = readdirSync(dirPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = join(dirPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...findEvalYamlFiles(entryPath));
      continue;
    }

    if (entry.isFile() && entry.name === "eval.yaml") {
      files.push(entryPath);
    }
  }

  return files;
}

function hasCompletedGrader(stimulus: Stimuli): boolean {
  return Array.isArray(stimulus.graders)
    && stimulus.graders.some((grader) => grader?.type === "completed");
}

export function validateStimulus(rootDir: string, _args: string[]): void {
  const evalsDir = join(rootDir, "evals");
  const evalFiles = findEvalYamlFiles(evalsDir).sort();
  const matterWithYamlEngine = matter as GrayMatterWithYamlEngine;
  let hasErrors = false;

  for (const filePath of evalFiles) {
    const fileContents = readFileSync(filePath, "utf8");
    const parsed = matter(fileContents);
    const parsedBody: EvalSuite | null = parsed.content.trim()
      ? matterWithYamlEngine.engines.yaml.parse(parsed.content) as EvalSuite
      : null;
    const displayPath = relative(rootDir, filePath);
    const topLevelSkill = parsedBody?.tags?.skill;
    const stimuli = (parsedBody?.stimuli ?? parsed.data.stimuli) as unknown;

    if (!Array.isArray(stimuli)) {
      console.error(`${displayPath}: missing stimuli array`);
      process.exitCode = 1;
      hasErrors = true;
      continue;
    }

    let fileHasErrors = false;

    if (!topLevelSkill) {
      console.error(`${displayPath}: missing top-level tags.skill`);
      process.exitCode = 1;
      fileHasErrors = true;
    }

    for (const [stimulusIndex, stimulus] of stimuli.entries()) {
      const typedStimulus = stimulus as Stimuli;

      if (!typedStimulus.name) {
        reportValidationError(displayPath, stimulusIndex, typedStimulus.name, "missing name");
        fileHasErrors = true;
      }

      for (const key of REQUIRED_TAG_KEYS) {
        if (!typedStimulus.tags?.[key]) {
          reportValidationError(
            displayPath,
            stimulusIndex,
            typedStimulus.name,
            `missing tags.${key}`,
          );
          fileHasErrors = true;
        }
      }

      if (!validateJsonObjectTag(
        displayPath,
        stimulusIndex,
        typedStimulus.name,
        "earlyTerminate",
        typedStimulus.tags?.earlyTerminate,
      )) {
        fileHasErrors = true;
      }

      if (!validateFollowUpTag(
        displayPath,
        stimulusIndex,
        typedStimulus.name,
        typedStimulus.tags?.followUp,
      )) {
        fileHasErrors = true;
      }

      if (!validateRequiredSkillsTag(
        displayPath,
        stimulusIndex,
        typedStimulus.name,
        typedStimulus.tags?.requiredSkills
      )) {
        fileHasErrors = true;
      }

      if (!validateJsonObjectTag(
        displayPath,
        stimulusIndex,
        typedStimulus.name,
        "systemPrompt",
        typedStimulus.tags?.systemPrompt,
      )) {
        fileHasErrors = true;
      }

      if (!validateJsonObjectTag(
        displayPath,
        stimulusIndex,
        typedStimulus.name,
        "takeScreenshot",
        typedStimulus.tags?.takeScreenshot,
      )) {
        fileHasErrors = true;
      }

      if (Array.isArray(typedStimulus.graders)) {
        for (const grader of typedStimulus.graders) {
          if (!validateJsonObjectRulesGrader(
            displayPath,
            stimulusIndex,
            typedStimulus.name,
            grader,
          )) {
            fileHasErrors = true;
          }
          if (!validateJavaUpgradeFileContentGrader(
            displayPath,
            stimulusIndex,
            typedStimulus.name,
            grader,
          )) {
            fileHasErrors = true;
          }
        }
      }

      if (typedStimulus.tags?.earlyTerminate && hasCompletedGrader(typedStimulus)) {
        reportValidationError(
          displayPath,
          stimulusIndex,
          typedStimulus.name,
          "tags.earlyTerminate must not coexist with a completed grader",
        );
        fileHasErrors = true;
      }
    }

    if (!fileHasErrors) {
      continue;
    }

    hasErrors = true;
  }

  if (!hasErrors) {
    console.log("All stimuli are valid.");
  } else {
    process.exit(1);
  }
}