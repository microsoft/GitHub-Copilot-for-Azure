import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  findVallyRunDirectory,
  isGradedVallyRecord,
  readVallyJsonl,
  requireCompleteGeneration,
  requireCompleteGrading,
  runEvaluationBatch,
} from "../evaluation.ts";
import type { SkillImprovementRunSpec } from "../config.ts";

describe("findVallyRunDirectory", () => {
  test("finds the timestamped directory containing eval results", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "vally-run-"));
    const runDirectory = path.join(root, "2026-09-10T05-09-08-698Z");
    fs.mkdirSync(runDirectory);
    fs.writeFileSync(path.join(runDirectory, "eval-results.md"), "# Results\n");
    fs.writeFileSync(path.join(root, "answers.jsonl"), "{}\n");

    try {
      expect(findVallyRunDirectory(root)).toBe(runDirectory);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("recognizes Vally 0.14 grade records without a type field", () => {
    expect(isGradedVallyRecord({
      status: "success",
      trajectory: { output: "answer" },
      gradeResult: { passed: true, score: 1 },
    })).toBe(true);
  });

  test("rejects judge output containing an ungraded trajectory", () => {
    expect(() => requireCompleteGrading([
      {
        status: "success",
        trajectory: { output: "answer" },
        gradeResult: { passed: true, score: 1 },
      },
      {
        status: "failure",
        trajectory: { output: "ungraded answer" },
      },
    ], 2)).toThrow(
      "expected 2 graded trajectories, received 2, 1 without grades"
    );
  });

  test("rejects judge output missing an expected trajectory", () => {
    expect(() => requireCompleteGrading([
      {
        status: "success",
        trajectory: { output: "answer" },
        gradeResult: { passed: true, score: 1 },
      },
    ], 2)).toThrow(
      "expected 2 graded trajectories, received 1, 0 without grades"
    );
  });

  test("rejects generation output that does not match the planned stimuli", () => {
    expect(() => requireCompleteGeneration([
      { type: "trial-result", trajectory: { output: "one" } },
      { type: "trial-result", trajectory: { output: "unexpected" } },
    ], 1)).toThrow("expected 1 trajectories, received 2");
  });

  test("reports the line containing invalid JSONL output", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "vally-jsonl-"));
    const file = path.join(root, "answers.jsonl");
    fs.writeFileSync(file, "{}\nnot-json\n", "utf8");
    try {
      expect(() => readVallyJsonl(file)).toThrow("at line 2");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("runs a split-stage npm wrapper with engine-owned JSONL streams", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "vally-wrapper-"));
    const evalDirectory = path.join(
      root,
      "tests",
      "skill-improvement",
      "evals",
      "fixture"
    );
    const outputRoot = path.join(root, "artifacts");
    const sideEffectFile = path.join(root, "injected.txt");
    fs.mkdirSync(evalDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(evalDirectory, "eval.yaml"),
      "stimuli:\n  - name: one\n",
      "utf8"
    );
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({
        name: "evaluator-fixture",
        private: true,
        scripts: {
          "fixture:generate": "node generate.cjs",
          "fixture:grade": "node grade.cjs",
        },
      }),
      "utf8"
    );
    fs.writeFileSync(
      path.join(root, "generate.cjs"),
      [
        'const fs = require("node:fs");',
        'const path = require("node:path");',
        "const args = process.argv.slice(2);",
        'const output = args[args.indexOf("--output-dir") + 1];',
        'const run = path.join(output, "fixture-run");',
        "fs.mkdirSync(run, { recursive: true });",
        'fs.writeFileSync(path.join(run, "eval-results.md"), "# Results\\n");',
        "console.log(JSON.stringify({",
        '  type: "trial-result",',
        '  itemId: "eval::one",',
        '  trajectory: { output: "answer", stimulus: { name: "one", tags: { area: "fixture" } } }',
        "}));",
      ].join("\n"),
      "utf8"
    );
    fs.writeFileSync(
      path.join(root, "grade.cjs"),
      [
        'let input = "";',
        'process.stdin.setEncoding("utf8");',
        'process.stdin.on("data", chunk => { input += chunk; });',
        'process.stdin.on("end", () => {',
        "  for (const line of input.trim().split(/\\r?\\n/)) {",
        "    const record = JSON.parse(line);",
        "    record.gradeResult = { passed: true, score: 1, evidence: \"fixture\" };",
        "    console.log(JSON.stringify(record));",
        "  }",
        "});",
      ].join("\n"),
      "utf8"
    );
    fs.writeFileSync(
      path.join(root, "side-effect.cjs"),
      `require("node:fs").writeFileSync(${JSON.stringify(sideEffectFile)}, "injected");`,
      "utf8"
    );
    const spec: SkillImprovementRunSpec = {
      name: "fixture",
      target: {
        plugin: "azure-skills",
        skill: "azure-kusto",
        baselineRef: "main",
      },
      evaluations: {
        root: "tests/skill-improvement/evals/fixture",
        development: ["eval.yaml"],
      },
      models: {
        answers: ["answer-model & node side-effect.cjs"],
        judges: ["judge-model | node side-effect.cjs"],
      },
      evaluator: {
        kind: "command",
        generate: {
          executable: "npm",
          args: [
            "run",
            "fixture:generate",
            "--",
            "--output-dir",
            "{generationDirectory}",
            "--model",
            "{answerModel}",
          ],
          workingDirectory: ".",
        },
        grade: {
          executable: "npm",
          args: ["run", "fixture:grade", "--", "--judge", "{judgeModel}"],
          workingDirectory: ".",
        },
        output: {
          format: "vally-jsonl",
          generationStdout: "trajectories",
          gradingStdin: "trajectories",
          gradingStdout: "graded-trajectories",
          runDirectoryMarker: "eval-results.md",
        },
      },
      experiment: {
        repetitions: 1,
        conditions: [
          { name: "skill", skill: "enabled", mcp: "enabled" },
          { name: "control", skill: "disabled", mcp: "enabled" },
        ],
      },
      improvementAgent: { enabled: false, model: "unused" },
      acceptance: {
        minimumQualityImprovementPoints: 0,
        maximumEvalRegressionPoints: 0,
        maximumModelRegressionPoints: 0,
      },
      limits: {
        maxIterations: 0,
        maxAnswerGenerations: 10,
        maxJudgeCalls: 10,
        maxDurationMinutes: 10,
        maxConcurrentJobs: 1,
        maxSkillTokenIncreasePercent: 0,
      },
      output: { issue: "never", draftPullRequest: "never" },
    };

    try {
      const result = await runEvaluationBatch(
        root,
        root,
        outputRoot,
        spec,
        "baseline",
        ["eval.yaml"],
        [spec.experiment.conditions[0]],
        Date.now() + 60_000
      );
      expect(result.answerGenerations).toBe(1);
      expect(result.judgeCalls).toBe(1);
      expect(result.trials).toEqual([
        expect.objectContaining({
          itemId: "one",
          passed: true,
          score: 1,
          evidence: "fixture",
          output: "answer",
        }),
      ]);
      expect(fs.existsSync(sideEffectFile)).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }, 30_000);
});
