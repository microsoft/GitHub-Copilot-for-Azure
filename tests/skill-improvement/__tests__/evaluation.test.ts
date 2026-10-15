import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  findVallyRunDirectory,
  isGradedVallyRecord,
  requireCompleteGrading,
  runEvaluationBatch,
} from "../evaluation.ts";
import { collectAnswerBilling } from "../billing.ts";
import type { SkillImprovementRunSpec } from "../config.ts";
import { runProcess } from "../process.ts";
import { aggregateJudgments } from "../report.ts";
import { describe, expect, test, vi } from "vitest";

vi.mock("../process.ts", async importOriginal => ({
  ...await importOriginal<typeof import("../process.ts")>(),
  runProcess: vi.fn(),
}));

describe("answer billing propagation", () => {
  test.each([1_250_000_000, 0, undefined])(
    "retains request billing %s through generation, each judge, and aggregation", async nanoAiu => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), "answer-billing-"));
      const evalRoot = path.join(root, "tests", "skill-improvement", "evals", "example");
      fs.mkdirSync(evalRoot, { recursive: true });
      fs.writeFileSync(path.join(evalRoot, "quality.yaml"), "stimuli:\n  - name: one\n");
      const spec: SkillImprovementRunSpec = {
        name: "example",
        target: { plugin: "example", skill: "example", baselineRef: "main" },
        evaluations: {
          root: "tests/skill-improvement/evals/example",
          development: ["quality.yaml"],
        },
        models: { answers: ["answer-model"], judges: ["judge-a", "judge-b"] },
        experiment: {
          repetitions: 1,
          conditions: [{ name: "Skill only", skill: "enabled", mcp: "disabled" }],
        },
        improvementAgent: { enabled: false, model: "agent" },
        acceptance: {
          minimumQualityImprovementPoints: 1,
          maximumEvalRegressionPoints: 0,
          maximumModelRegressionPoints: 0,
          minimumSkillInvocationRate: 1,
        },
        refinement: {
          minimumScoreImprovementPoints: 1,
          maximumQualityRegressionPoints: 0,
        },
        limits: {
          maxIterations: 0,
          maxAnswerGenerations: 1,
          maxJudgeCalls: 2,
          maxDurationMinutes: 1,
          maxConcurrentJobs: 1,
          maxSkillTokenIncreasePercent: 15,
        },
        output: { issue: "never", draftPullRequest: "never" },
      };
      const answerBilling = collectAnswerBilling([{
        type: "assistant.usage",
        data: nanoAiu === undefined ? {} : { copilotUsage: { totalNanoAiu: nanoAiu } },
      }]);
      vi.mocked(runProcess).mockImplementation(async (_command, args, options) => {
        if (!options.stdoutFile) {
          throw new Error("Expected output file.");
        }
        if (args.includes("eval")) {
          const runDirectory = path.join(path.dirname(options.stdoutFile), "run");
          fs.mkdirSync(runDirectory);
          fs.writeFileSync(path.join(runDirectory, "eval-results.md"), "# Results\n");
          fs.writeFileSync(options.stdoutFile, JSON.stringify({
            type: "trial-result",
            itemId: "suite::one",
            trajectory: { output: "answer", metadata: { answerBilling } },
          }) + "\n");
        } else {
          if (!options.stdinFile) {
            throw new Error("Expected saved answers as grading input.");
          }
          const record = JSON.parse(fs.readFileSync(options.stdinFile, "utf8"));
          fs.writeFileSync(options.stdoutFile, JSON.stringify({
            ...record,
            gradeResult: { passed: true, score: 1 },
          }) + "\n");
        }
        return { exitCode: 0, stdout: "", stderr: "" };
      });
      try {
        const batch = await runEvaluationBatch(
          root, root, path.join(root, "results"), spec, "baseline",
          "development", spec.experiment.conditions, Date.now() + 60_000
        );
        const credits = nanoAiu === undefined ? undefined : nanoAiu / 1_000_000_000;
        expect(batch.answerGenerations).toBe(1);
        expect(batch.judgeCalls).toBe(2);
        expect(batch.trials.map(trial => trial.answerBilledCredits)).toEqual([credits, credits]);
        expect(aggregateJudgments(batch.trials)[0].answerBilledCredits).toBe(credits);
      } finally {
        vi.mocked(runProcess).mockReset();
        fs.rmSync(root, { recursive: true, force: true });
      }
    }
  );
});

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
});
