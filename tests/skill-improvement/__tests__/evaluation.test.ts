import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  findVallyRunDirectory,
  isGradedVallyRecord,
  requireCompleteGrading,
  runEvaluationBatch,
} from "../evaluation.ts";
import { collectEvaluationAnswerBilling, type BatchBilling } from "../billing.ts";
import type { SkillImprovementRunSpec } from "../config.ts";
import { runProcess, runWithConcurrency } from "../process.ts";
import { aggregateJudgments } from "../report.ts";
import { describe, expect, test, vi } from "vitest";

vi.mock("../process.ts", async importOriginal => {
  const original = await importOriginal<typeof import("../process.ts")>();
  return {
    ...original,
    runProcess: vi.fn(),
    runWithConcurrency: vi.fn(original.runWithConcurrency),
  };
});

describe("answer billing propagation", () => {
  test.each<{ nanoAiu?: number; failure?: string; truncated?: boolean; workers?: number }>([
    { nanoAiu: 1_250_000_000, failure: undefined },
    { nanoAiu: 0, failure: undefined },
    { nanoAiu: undefined, failure: undefined },
    { nanoAiu: 1_250_000_000, failure: "eval" },
    { nanoAiu: 1_250_000_000, failure: "grade" },
    { nanoAiu: 1_250_000_000, failure: "eval", truncated: true },
    { nanoAiu: 1_250_000_000, truncated: true },
    { nanoAiu: 1_250_000_000, workers: 3 },
  ])(
    "retains billing and partial attempt accounting: %s", async ({ nanoAiu, failure, truncated, workers }) => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), "answer-billing-"));
      const evalRoot = path.join(root, "tests", "skill-improvement", "evals", "example");
      fs.mkdirSync(evalRoot, { recursive: true });
      fs.writeFileSync(path.join(evalRoot, "quality.yaml"),
        "stimuli:\n  - name: one\n" + (truncated ? "  - name: two\n" : ""));
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
          maxConcurrentVallyProcesses: 2,
          generationWorkersPerVallyProcess: workers,
          maxSkillTokenIncreasePercent: 15,
        },
        output: { issue: "never", draftPullRequest: "never" },
      };
      const evaluationAnswerBilling = collectEvaluationAnswerBilling([{
        type: "assistant.usage",
        data: nanoAiu === undefined ? {} : { copilotUsage: { totalNanoAiu: nanoAiu } },
      }]);
      const processError = new Error(`${failure} failed`);
      vi.mocked(runProcess).mockImplementation(async (_command, args, options) => {
        if (!options.stdoutFile) {
          throw new Error("Expected output file.");
        }
        if (args.includes("eval")) {
          expect(args[args.indexOf("--workers") + 1]).toBe(String(workers ?? 1));
          const runDirectory = path.join(path.dirname(options.stdoutFile), "run");
          fs.mkdirSync(runDirectory);
          fs.writeFileSync(path.join(runDirectory, "eval-results.md"), "# Results\n");
          fs.writeFileSync(options.stdoutFile, JSON.stringify({
            type: "trial-result",
            itemId: "suite::one",
            trajectory: { output: "answer", metadata: { answerBilling: evaluationAnswerBilling } },
          }) + "\n" + (truncated ? '{"trajectory":\n{"type":"progress"}\n' : ""));
        } else {
          expect(args).not.toContain("--workers");
          if (!options.stdinFile) {
            throw new Error("Expected saved answers as grading input.");
          }
          const record = JSON.parse(fs.readFileSync(options.stdinFile, "utf8"));
          fs.writeFileSync(options.stdoutFile, JSON.stringify({
            ...record,
            gradeResult: { passed: true, score: 1 },
          }) + "\n");
        }
        if (failure && args.includes(failure)) {
          throw processError;
        }
        return { exitCode: 0, stdout: "", stderr: "" };
      });
      try {
        let captured: BatchBilling | undefined;
        const pending = runEvaluationBatch(
          root, root, path.join(root, "results"), spec, "baseline",
          "development", spec.experiment.conditions, Date.now() + 60_000,
          undefined, billing => { captured = billing; }
        );
        if (failure) {
          await expect(pending).rejects.toBe(processError);
          expect(captured).toMatchObject({
            finalized: false,
            evaluationAnswers: { expected: truncated ? 2 : 1, observed: 1, measured: 1, measuredAiCredits: 1.25 },
          });
          return;
        }
        if (truncated) {
          await expect(pending).rejects.toBeInstanceOf(SyntaxError);
          expect(captured?.finalized).toBe(false);
          expect(vi.mocked(runProcess)).toHaveBeenCalledTimes(1);
          return;
        }
        const batch = await pending;
        expect(vi.mocked(runWithConcurrency).mock.calls.map(call => call[1])).toEqual([2, 2]);
        const credits = nanoAiu === undefined ? undefined : nanoAiu / 1_000_000_000;
        expect(batch.answerGenerations).toBe(1);
        expect(batch.judgeCalls).toBe(2);
        expect(batch.trials.map(trial => trial.answerBilledCredits)).toEqual([credits, credits]);
        expect(aggregateJudgments(batch.trials)[0].answerBilledCredits).toBe(credits);
        expect(batch.billing).toMatchObject({
          finalized: true,
          evaluationAnswers: {
            expected: 1, observed: 1, measured: credits === undefined ? 0 : 1,
            measuredAiCredits: credits ?? 0,
          },
          skillImprovement: { expected: 0 },
        });
      } finally {
        vi.mocked(runProcess).mockReset();
        vi.mocked(runWithConcurrency).mockClear();
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
