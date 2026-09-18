import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createRunPlan,
  enforceRunLimits,
  resolveEvaluationPath,
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
      root: "tests/skill-improvement/evals/azure-kusto",
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

function commandEvaluator(): NonNullable<SkillImprovementRunSpec["evaluator"]> {
  return {
    kind: "command",
    generate: {
      executable: "npm",
      args: [
        "run",
        "test:vally",
        "--",
        "--model",
        "{answerModel}",
        "--runs",
        "{repetitions}",
      ],
      workingDirectory: ".",
      environment: {
        VALLY_RUNS: "{repetitions}",
      },
    },
    grade: {
      executable: "npm",
      args: [
        "run",
        "test:vally:grade",
        "--",
        "--judge-model",
        "{judgeModel}",
        "--run-dir",
        "{runDirectory}",
      ],
    },
    output: {
      format: "vally-jsonl",
      generationStdout: "trajectories",
      gradingStdin: "trajectories",
      gradingStdout: "graded-trajectories",
      runDirectoryMarker: "eval-results.md",
    },
  };
}

describe("skill improvement configuration", () => {
  test("calculates worst-case answer and judge calls", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "skill-improvement-config-"));
    const evalDirectory = path.join(
      root,
      "tests",
      "skill-improvement",
      "evals",
      "azure-kusto"
    );
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

  test.each([
    "../evals",
    "/tests/skill-improvement/evals/azure-kusto",
    "C:\\tests\\skill-improvement\\evals\\azure-kusto",
    "tests/skill-improvement/evals/../azure-kusto",
    "tests\\skill-improvement\\evals\\azure-kusto",
    "tests/skill-improvement/evals/Azure Kusto",
    "tests/skill-improvement/evals/azure_kusto",
    "evals/azure-skills/azure-kusto",
  ])("rejects unsafe evaluation root %s", value => {
    const invalid = spec();
    invalid.evaluations.root = value;
    expect(() => validateRunSpec(invalid)).toThrow(
      "evaluations.root must be a repository-relative directory inside tests/skill-improvement/evals"
    );
  });

  test.each([
    "../quality.eval.yaml",
    "nested/quality.eval.yaml",
    "nested\\quality.eval.yaml",
    "/quality.eval.yaml",
    "C:\\quality.eval.yaml",
  ])("rejects unsafe evaluation filename %s", value => {
    const invalid = spec();
    invalid.evaluations.development = [value];
    expect(() => validateRunSpec(invalid)).toThrow(
      "evaluations.development contains an invalid eval filename"
    );
  });

  test("resolves a metacharacter filename literally inside the configured root", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "skill-improvement-path-"));
    const evalDirectory = path.join(
      root,
      "tests",
      "skill-improvement",
      "evals",
      "azure-kusto"
    );
    const filename = "quality & 100% ^.eval.yaml";
    fs.mkdirSync(evalDirectory, { recursive: true });
    fs.writeFileSync(path.join(evalDirectory, filename), "stimuli:\n  - name: one\n");

    try {
      expect(resolveEvaluationPath(root, spec(), filename)).toBe(
        fs.realpathSync(path.join(evalDirectory, filename))
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("reports a missing evaluation file", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "skill-improvement-path-"));
    fs.mkdirSync(
      path.join(root, "tests", "skill-improvement", "evals", "azure-kusto"),
      { recursive: true }
    );

    try {
      expect(() => resolveEvaluationPath(root, spec(), "missing.eval.yaml"))
        .toThrow("Eval file not found");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("rejects an evaluation root symlink that escapes the allowed root", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "skill-improvement-path-"));
    const allowedRoot = path.join(root, "tests", "skill-improvement", "evals");
    const outsideRoot = path.join(root, "outside");
    const configuredRoot = path.join(allowedRoot, "azure-kusto");
    fs.mkdirSync(allowedRoot, { recursive: true });
    fs.mkdirSync(outsideRoot);
    fs.writeFileSync(
      path.join(outsideRoot, "quality.eval.yaml"),
      "stimuli:\n  - name: one\n"
    );
    fs.symlinkSync(
      outsideRoot,
      configuredRoot,
      process.platform === "win32" ? "junction" : "dir"
    );

    try {
      expect(() => resolveEvaluationPath(root, spec(), "quality.eval.yaml"))
        .toThrow("Evaluation root escapes tests/skill-improvement/evals");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test.each([
    "../azure-skills",
    "azure/skills",
    "azure\\skills",
    "Azure-Skills",
    "azure skills",
    "azure_skills",
    "azure-skills\"",
    "azure-skills;echo",
  ])("rejects unsafe target directory name %s", value => {
    for (const field of ["plugin", "skill"] as const) {
      const invalid = spec();
      invalid.target[field] = value;
      expect(() => validateRunSpec(invalid)).toThrow(
        `target.${field} must be a repository-safe lowercase hyphenated directory name`
      );
    }
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

  test("requires held-out files when the held-out list is omitted", () => {
    const invalid = spec();
    delete invalid.evaluations.heldOut;
    expect(() => validateRunSpec(invalid)).toThrow(
      "evaluations.heldOut must contain at least one file"
    );
  });

  test("validates requireHeldOutImprovement without an invocation threshold", () => {
    const invalid = spec();
    delete invalid.acceptance.minimumSkillInvocationRate;
    invalid.acceptance.requireHeldOutImprovement = "yes" as unknown as boolean;
    expect(() => validateRunSpec(invalid)).toThrow(
      "acceptance.requireHeldOutImprovement must be a boolean"
    );
  });

  test("accepts a split-stage npm evaluator with whole-value placeholders", () => {
    const runSpec = spec();
    runSpec.evaluator = commandEvaluator();
    expect(validateRunSpec(runSpec)).toBe(runSpec);
  });

  test.each([
    ["unsafe executable", (runSpec: SkillImprovementRunSpec) => {
      runSpec.evaluator!.generate.executable = "cmd" as "npm";
    }, "executable must be 'npm'"],
    ["unsafe npm prefix", (runSpec: SkillImprovementRunSpec) => {
      runSpec.evaluator!.generate.args = ["--script-shell", "powershell"];
    }, "must start with"],
    ["working-directory traversal", (runSpec: SkillImprovementRunSpec) => {
      runSpec.evaluator!.generate.workingDirectory = "../outside";
    }, "must not contain"],
    ["embedded placeholder", (runSpec: SkillImprovementRunSpec) => {
      runSpec.evaluator!.generate.args.push("--model={answerModel}");
    }, "whole-value allowlisted placeholder"],
    ["stage-invalid placeholder", (runSpec: SkillImprovementRunSpec) => {
      runSpec.evaluator!.generate.args.push("{judgeModel}");
    }, "cannot use {judgeModel}"],
    ["protected environment", (runSpec: SkillImprovementRunSpec) => {
      runSpec.evaluator!.generate.environment = {
        NPM_CONFIG_SCRIPT_SHELL: "powershell",
      };
    }, "cannot override protected variable"],
    ["npm configuration environment", (runSpec: SkillImprovementRunSpec) => {
      runSpec.evaluator!.generate.environment = {
        NPM_CONFIG_PREFIX: "unsafe",
      };
    }, "cannot override protected variable"],
  ])("rejects evaluator %s", (_name, mutate, message) => {
    const runSpec = spec();
    runSpec.evaluator = commandEvaluator();
    mutate(runSpec);
    expect(() => validateRunSpec(runSpec)).toThrow(message);
  });
});
