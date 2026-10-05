import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createRunPlan,
  enforceRunLimits,
  loadRunSpec,
  materializeEvaluationFile,
  resolveEvaluationPath,
  validateRunSpec,
  type SkillImprovementRunSpec,
} from "../config.ts";
import { describe, expect, test } from "vitest";

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
        { name: "Agent only", skill: "disabled", mcp: "disabled" },
        { name: "Skill only", skill: "enabled", mcp: "disabled" },
        { name: "MCP only", skill: "disabled", mcp: "enabled" },
        { name: "Skill + MCP", skill: "enabled", mcp: "enabled" },
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
    refinement: {
      minimumScoreImprovementPoints: 1,
      maximumQualityRegressionPoints: 0,
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
  test("configures a valid Azure Kusto improvement run", () => {
    const runSpec = loadRunSpec(fileURLToPath(
      new URL("../specs/azure-kusto.yaml", import.meta.url)
    ), {
      AZURE_EVALS_SUBSCRIPTION_ID: "subscription-from-environment",
      AZURE_EVALS_RESOURCE_GROUP: "resource-group-from-environment",
    });

    expect(runSpec.target.baselineRef).toBe("main");
    expect(runSpec.experiment.conditions.some(
      condition => condition.skill === "enabled"
    )).toBe(true);
    expect(runSpec.output.issue).toBe("never");
    expect(runSpec.refinement.maximumQualityRegressionPoints).toBe(0);
    expect(runSpec.acceptance.requireHeldOutImprovement).toBe(true);
    expect(runSpec.evaluations.heldOut).toEqual([
      "held-out-troubleshoot-remediate.eval.yaml",
    ]);
    expect(runSpec.evaluations.development).toContain(
      "live-connection.eval.yaml"
    );
    expect(runSpec.experiment.conditions.every(
      condition => condition.developmentEvaluations === undefined
    )).toBe(true);
    expect(runSpec.resources?.kusto?.clusterName).toBe("ghcfaevalskusto");
    expect(runSpec.resources?.kusto?.subscriptionId).toBe(
      "subscription-from-environment"
    );
    expect(runSpec.resources?.kusto?.resourceGroup).toBe(
      "resource-group-from-environment"
    );
    expect(runSpec.limits.maxAnswerGenerations).toBeGreaterThanOrEqual(550);
    expect(runSpec.limits.maxJudgeCalls).toBeGreaterThanOrEqual(550);
  });

  test("reports missing run-spec environment variables", () => {
    expect(() => loadRunSpec(fileURLToPath(
      new URL("../specs/azure-kusto.yaml", import.meta.url)
    ), {})).toThrow(
      "Missing environment variables referenced by"
      + " "
      + fileURLToPath(new URL("../specs/azure-kusto.yaml", import.meta.url))
      + ": AZURE_EVALS_RESOURCE_GROUP, AZURE_EVALS_SUBSCRIPTION_ID"
    );
  });

  test("materializes evaluation stimuli with environment values", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "skill-improvement-env-"));
    const source = path.join(root, "source.eval.yaml");
    const destination = path.join(root, "resolved.eval.yaml");
    fs.writeFileSync(
      source,
      "stimuli:\n  - prompt: Use ${SUBSCRIPTION_ID} in ${RESOURCE_GROUP}.\n",
      "utf8"
    );

    try {
      materializeEvaluationFile(source, destination, {
        SUBSCRIPTION_ID: "subscription-value",
        RESOURCE_GROUP: "resource-group-value",
      });
      expect(fs.readFileSync(destination, "utf8")).toContain(
        "Use subscription-value in resource-group-value."
      );
      expect(fs.readFileSync(destination, "utf8")).not.toContain("${");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("rejects evaluation stimuli with missing environment variables", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "skill-improvement-env-"));
    const source = path.join(root, "source.eval.yaml");
    const destination = path.join(root, "resolved.eval.yaml");
    fs.writeFileSync(
      source,
      "stimuli:\n  - prompt: Use ${SUBSCRIPTION_ID}.\n",
      "utf8"
    );

    try {
      expect(() => materializeEvaluationFile(source, destination, {})).toThrow(
        `Missing environment variables referenced by ${source}: SUBSCRIPTION_ID`
      );
      expect(fs.existsSync(destination)).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test.each([
    {
      name: "one Skill-enabled arm",
      conditions: [
        { name: "Skill only", skill: "enabled", mcp: "disabled" },
      ],
    },
    {
      name: "two Skill-enabled arms",
      conditions: [
        { name: "Skill only", skill: "enabled", mcp: "disabled" },
        { name: "Skill + MCP", skill: "enabled", mcp: "enabled" },
      ],
    },
  ] satisfies Array<{
    name: string;
    conditions: SkillImprovementRunSpec["experiment"]["conditions"];
  }>)(
    "allows skill improvement without a no-skill control: $name",
    ({ conditions }) => {
      const runSpec = spec();
      runSpec.experiment.conditions = conditions;

      expect(() => validateRunSpec(runSpec)).not.toThrow();
    }
  );

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
      baselineAnswerGenerations: 16,
      candidateAnswerGenerationsPerIteration: 8,
      heldOutAnswerGenerations: 8,
      maximumAnswerGenerations: 40,
      maximumJudgeCalls: 80,
    });
  });

  test("counts condition-specific evaluation files only for their condition", () => {
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
    fs.writeFileSync(
      path.join(evalDirectory, "live.eval.yaml"),
      "stimuli:\n  - name: live-one\n  - name: live-two\n  - name: live-three\n",
      "utf8"
    );
    const runSpec = spec();
    runSpec.experiment.conditions[3].developmentEvaluations = ["live.eval.yaml"];

    try {
      expect(createRunPlan(root, runSpec)).toMatchObject({
        developmentPromptCount: 5,
        baselineAnswerGenerations: 22,
        candidateAnswerGenerationsPerIteration: 14,
        heldOutAnswerGenerations: 8,
        maximumAnswerGenerations: 58,
        maximumJudgeCalls: 116,
      });
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
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

  test("rejects condition-specific files duplicated by the common set", () => {
    const invalid = spec();
    invalid.experiment.conditions[1].developmentEvaluations = [
      "quality.eval.yaml",
    ];
    expect(() => validateRunSpec(invalid)).toThrow(
      "duplicates common evaluation files"
    );
  });

  test("validates managed Kusto resource settings", () => {
    const invalid = spec();
    invalid.resources = {
      kusto: {
        subscriptionId: "subscription",
        resourceGroup: "group",
        clusterName: "cluster",
        databaseName: "database",
        startBeforeRun: true,
        stopAfterRun: true,
        startupTimeoutMinutes: 0,
      },
    };
    expect(() => validateRunSpec(invalid)).toThrow(
      "resources.kusto.startupTimeoutMinutes"
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
      "condition-specific held-out evaluation is required"
    );
  });

  test("requires held-out files when the held-out list is omitted", () => {
    const invalid = spec();
    delete invalid.evaluations.heldOut;
    expect(() => validateRunSpec(invalid)).toThrow(
      "condition-specific held-out evaluation is required"
    );
  });

  test("allows held-out evidence scoped to one condition", () => {
    const valid = spec();
    valid.evaluations.heldOut = [];
    valid.experiment.conditions[3].heldOutEvaluations = ["held-out.eval.yaml"];
    expect(() => validateRunSpec(valid)).not.toThrow();
  });

  test("validates requireHeldOutImprovement without an invocation threshold", () => {
    const invalid = spec();
    delete invalid.acceptance.minimumSkillInvocationRate;
    invalid.acceptance.requireHeldOutImprovement = "yes" as unknown as boolean;
    expect(() => validateRunSpec(invalid)).toThrow(
      "acceptance.requireHeldOutImprovement must be a boolean"
    );
  });

  test.each([
    ["minimumScoreImprovementPoints", -1],
    ["maximumQualityRegressionPoints", -1],
  ] as const)("rejects invalid refinement threshold %s", (field, value) => {
    const invalid = spec();
    invalid.refinement[field] = value;
    expect(() => validateRunSpec(invalid)).toThrow(`refinement.${field}`);
  });
});
