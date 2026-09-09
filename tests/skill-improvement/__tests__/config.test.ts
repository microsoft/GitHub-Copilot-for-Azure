import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createRunPlan,
  enforceRunLimits,
  validateRunSpec,
  type SkillImprovementRunSpec,
} from "../config.ts";

function spec(): SkillImprovementRunSpec {
  return {
    name: "example",
    target: {
      plugin: "azure-skills",
      skill: "azure-kusto",
      baselineRef: "main",
    },
    evaluations: {
      development: ["quality.eval.yaml"],
      heldOut: ["held-out.eval.yaml"],
    },
    models: {
      answers: ["answer-a", "answer-b"],
      judges: ["judge-a", "judge-b"],
    },
    experiment: {
      repetitions: 1,
      conditions: [
        { name: "skill", skill: "enabled", mcp: "enabled" },
        { name: "control", skill: "disabled", mcp: "enabled" },
      ],
    },
    improvementAgent: {
      enabled: true,
      model: "agent",
    },
    acceptance: {
      minimumQualityImprovementPoints: 2,
      maximumEvalRegressionPoints: 5,
      maximumModelRegressionPoints: 5,
      requireHeldOutImprovement: true,
    },
    limits: {
      maxIterations: 2,
      maxAnswerGenerations: 100,
      maxJudgeCalls: 200,
      maxDurationMinutes: 60,
      maxConcurrentJobs: 2,
      maxSkillTokenIncreasePercent: 15,
    },
    output: {
      issue: "always",
      draftPullRequest: "accepted-candidate-only",
    },
  };
}

describe("skill improvement configuration", () => {
  test("calculates worst-case answer and judge calls", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "skill-improvement-config-"));
    const evalDirectory = path.join(root, "evals", "azure-skills", "azure-kusto");
    fs.mkdirSync(evalDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(evalDirectory, "quality.eval.yaml"),
      "stimuli:\n  - name: one\n  - name: two\n",
      "utf8"
    );
    fs.writeFileSync(
      path.join(evalDirectory, "held-out.eval.yaml"),
      "stimuli:\n  - name: unseen\n",
      "utf8"
    );

    const plan = createRunPlan(root, spec());

    expect(plan).toEqual({
      developmentPromptCount: 2,
      heldOutPromptCount: 1,
      baselineAnswerGenerations: 8,
      candidateAnswerGenerationsPerIteration: 4,
      heldOutAnswerGenerations: 4,
      maximumAnswerGenerations: 20,
      maximumJudgeCalls: 40,
    });
  });

  test("rejects editable paths outside the target skill", () => {
    const invalid = spec();
    invalid.target.editablePaths = ["evals/**"];
    expect(() => validateRunSpec(invalid)).toThrow(
      "target.editablePaths must remain inside"
    );
  });

  test("rejects a run plan that exceeds limits", () => {
    const runSpec = spec();
    expect(() => enforceRunLimits(runSpec, {
      developmentPromptCount: 1,
      heldOutPromptCount: 0,
      baselineAnswerGenerations: 101,
      candidateAnswerGenerationsPerIteration: 0,
      heldOutAnswerGenerations: 0,
      maximumAnswerGenerations: 101,
      maximumJudgeCalls: 202,
    })).toThrow("maxAnswerGenerations");
  });

  test("requires held-out files when held-out improvement is enabled", () => {
    const invalid = spec();
    invalid.evaluations.heldOut = [];
    expect(() => validateRunSpec(invalid)).toThrow(
      "evaluations.heldOut must contain at least one file"
    );
  });
});
