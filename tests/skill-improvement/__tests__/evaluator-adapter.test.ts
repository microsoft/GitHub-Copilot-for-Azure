import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { SkillImprovementRunSpec } from "../config.ts";
import {
  createGenerationLaunch,
  createGradingLaunch,
  resolveEvaluatorWorkingDirectory,
} from "../evaluator-adapter.ts";
import { commandName } from "../process.ts";

function spec(): SkillImprovementRunSpec {
  return {
    name: "adapter",
    target: {
      plugin: "azure-skills",
      skill: "azure-kusto",
      baselineRef: "main",
    },
    evaluations: { development: ["eval.yaml"] },
    models: { answers: ["answer"], judges: ["judge"] },
    experiment: {
      repetitions: 2,
      conditions: [
        { name: "skill", skill: "enabled", mcp: "enabled" },
        { name: "control", skill: "disabled", mcp: "enabled" },
      ],
    },
    improvementAgent: { enabled: false, model: "agent" },
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
}

function context(root: string) {
  const testsDirectory = path.join(root, "tests");
  fs.mkdirSync(testsDirectory, { recursive: true });
  return {
    worktree: root,
    evalRepoRoot: root,
    testsDirectory,
    evalPath: path.join(root, "evals", "azure-skills", "azure-kusto", "eval.yaml"),
    evalFile: "eval.yaml",
    answerModel: "answer & literal",
    generationDirectory: path.join(root, "generation"),
    answerFile: path.join(root, "generation", "answers.jsonl"),
    condition: { name: "skill", skill: "enabled", mcp: "enabled" } as const,
    conditionEnvironment: { NO_SKILLS: "" },
  };
}

describe("evaluator adapter", () => {
  test("keeps the direct Vally CLI as the default", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "default-adapter-"));
    try {
      const launch = createGenerationLaunch(spec(), context(root));
      expect(launch.command).toBe(commandName("npx"));
      expect(launch.cwd).toBe(path.join(root, "tests"));
      expect(launch.args).toEqual(expect.arrayContaining([
        "@microsoft/vally-cli",
        "eval",
        "--model",
        "answer & literal",
        "--skip-grade",
      ]));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("expands placeholders as literal npm argv elements", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "custom-adapter-"));
    try {
      const runSpec = spec();
      runSpec.evaluator = {
        kind: "command",
        generate: {
          executable: "npm",
          args: [
            "run",
            "test:vally",
            "--",
            "--suite",
            "foundry-e2e & not-a-command",
            "--model",
            "{answerModel}",
            "--runs",
            "{repetitions}",
          ],
          workingDirectory: ".",
          environment: { VALLY_RUNS: "{repetitions}" },
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
      const generationContext = context(root);
      const generation = createGenerationLaunch(runSpec, generationContext);
      expect(generation).toMatchObject({
        command: commandName("npm"),
        cwd: root,
        args: [
          "run",
          "--silent",
          "test:vally",
          "--",
          "--suite",
          "foundry-e2e & not-a-command",
          "--model",
          "answer & literal",
          "--runs",
          "2",
        ],
        env: {
          NO_SKILLS: "",
          VALLY_RUNS: "2",
        },
      });

      const grading = createGradingLaunch(runSpec, {
        ...generationContext,
        judgeModel: "judge | literal",
        runDirectory: path.join(root, "generation", "run"),
        judgmentDirectory: path.join(root, "judgments"),
      });
      expect(grading.args).toEqual([
        "run",
        "--silent",
        "test:vally:grade",
        "--",
        "--judge-model",
        "judge | literal",
        "--run-dir",
        path.join(root, "generation", "run"),
      ]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("rejects a working directory that resolves through a link outside the repository", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "adapter-root-"));
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), "adapter-outside-"));
    const link = path.join(root, "linked");
    try {
      fs.symlinkSync(
        outside,
        link,
        process.platform === "win32" ? "junction" : "dir"
      );
      expect(() => resolveEvaluatorWorkingDirectory(root, "linked")).toThrow(
        "resolves outside the repository"
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });
});
