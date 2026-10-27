import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  changedFiles,
  decideHeldOutAcceptance,
  hasActionableFailureEvidence,
  unlinkDependencyLinks,
  writeCandidatePatch,
  writeFinalCandidatePatch,
} from "../engine.ts";
import {
  aggregateJudgments,
  type AggregatedTrial,
} from "../report.ts";
import type {
  EvaluationCondition,
  SkillImprovementRunSpec,
} from "../config.ts";
import type { JudgedTrial } from "../evaluation.ts";
import { describe, expect, test } from "vitest";

const skillOnly: EvaluationCondition = {
  name: "Skill only",
  skill: "enabled",
  mcp: "disabled",
};

function spec(): SkillImprovementRunSpec {
  return {
    name: "example",
    target: { plugin: "azure-skills", skill: "azure-kusto", baselineRef: "main" },
    evaluations: {
      root: "tests/skill-improvement/evals/azure-kusto",
      development: ["quality.eval.yaml"],
      heldOut: ["held-out.eval.yaml"],
    },
    models: { answers: ["model-a"], judges: ["judge-a"] },
    experiment: { repetitions: 1, conditions: [skillOnly] },
    improvementAgent: { enabled: true, model: "agent" },
    acceptance: {
      minimumQualityImprovementPoints: 20,
      maximumEvalRegressionPoints: 5,
      maximumModelRegressionPoints: 5,
      minimumSkillInvocationRate: 0.8,
    },
    heldOutAcceptance: {
      enabled: true,
      minimumQualityImprovementPoints: 0,
      maximumEvalRegressionPoints: 0,
      maximumModelRegressionPoints: 0,
    },
    refinement: {
      minimumScoreImprovementPoints: 1,
      maximumQualityRegressionPoints: 0,
    },
    limits: {
      maxIterations: 1,
      maxAnswerGenerations: 20,
      maxJudgeCalls: 20,
      maxDurationMinutes: 60,
      maxConcurrentVallyProcesses: 1,
      maxSkillTokenIncreasePercent: 15,
    },
    output: { issue: "never", draftPullRequest: "accepted-candidate-only" },
  };
}

function judged(phase: JudgedTrial["phase"], passed: boolean): JudgedTrial {
  return {
    phase,
    condition: skillOnly,
    answerModel: "model-a",
    judgeModel: "judge-a",
    evalFile: "held-out.eval.yaml",
    itemId: "held-out-case",
    stimulus: "held-out case",
    area: "response-quality",
    passed,
    score: passed ? 1 : 0,
    evidence: "judge evidence",
    details: [],
    output: "answer",
    targetSkillInvoked: true,
    totalTokens: 100,
  };
}

describe("held-out acceptance engine mapping", () => {
  test("accepts unchanged held-out results with a zero improvement requirement", () => {
    const baseline = aggregateJudgments([judged("held-out-baseline", true)]);
    const candidate = aggregateJudgments([judged("held-out-candidate", true)]);

    const decision = decideHeldOutAcceptance(
      spec(),
      baseline,
      candidate,
      1000,
      1000
    );

    expect(decision.accepted).toBe(true);
    expect(decision.comparison.qualityImprovementPoints).toBe(0);
  });

  test("rejects a held-out regression through the engine mapping", () => {
    const baseline = aggregateJudgments([judged("held-out-baseline", true)]);
    const candidate = aggregateJudgments([judged("held-out-candidate", false)]);

    const decision = decideHeldOutAcceptance(
      spec(),
      baseline,
      candidate,
      1000,
      1000
    );

    expect(decision.accepted).toBe(false);
    expect(decision.comparison.qualityImprovementPoints).toBe(-100);
    expect(decision.reasons.join("\n")).toContain("0.00 required");
  });
});

function trial(overrides: Partial<AggregatedTrial> = {}): AggregatedTrial {
  return {
    condition: { name: "Skill only", skill: "enabled", mcp: "disabled" },
    answerModel: "model",
    evalFile: "eval.yaml",
    itemId: "item",
    stimulus: "prompt",
    area: "response-quality",
    passed: true,
    score: 1,
    judgePasses: 1,
    judgeCount: 1,
    judgeDisagreement: false,
    judgments: [],
    output: "answer",
    targetSkillInvoked: true,
    totalTokens: 100,
    ...overrides,
  };
}

describe("worktree dependency cleanup", () => {
  test("unlinks dependency junctions without deleting their targets", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "skill-improvement-links-"));
    const source = path.join(root, "source");
    const worktree = path.join(root, "worktree");
    const link = path.join(worktree, "node_modules");
    fs.mkdirSync(source);
    fs.mkdirSync(worktree);
    fs.writeFileSync(path.join(source, "marker.txt"), "keep", "utf8");
    fs.symlinkSync(source, link, process.platform === "win32" ? "junction" : "dir");

    unlinkDependencyLinks(worktree);

    expect(fs.existsSync(link)).toBe(false);
    expect(fs.readFileSync(path.join(source, "marker.txt"), "utf8")).toBe("keep");
    fs.rmSync(root, { recursive: true, force: true });
  });

  test("excludes runner dependency links from candidate changes and patches", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "skill-improvement-git-"));
    const dependencySource = fs.mkdtempSync(
      path.join(os.tmpdir(), "skill-improvement-dependencies-")
    );
    const skillFile = path.join(
      root,
      "plugins",
      "azure-skills",
      "skills",
      "azure-kusto",
      "SKILL.md"
    );
    const dependencyLink = path.join(root, "node_modules");
    const iterationDirectory = path.join(root, "iteration-output");
    try {
      execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
      execFileSync("git", ["config", "user.name", "Skill Improvement Test"], {
        cwd: root,
      });
      execFileSync("git", ["config", "user.email", "test@example.com"], {
        cwd: root,
      });
      execFileSync("git", ["config", "core.autocrlf", "false"], { cwd: root });
      fs.mkdirSync(path.dirname(skillFile), { recursive: true });
      fs.writeFileSync(skillFile, "baseline\n", "utf8");
      execFileSync("git", ["add", "--all"], { cwd: root });
      execFileSync("git", ["commit", "-m", "baseline"], {
        cwd: root,
        stdio: "ignore",
      });

      fs.writeFileSync(path.join(dependencySource, "marker.txt"), "dependency", "utf8");
      fs.symlinkSync(
        dependencySource,
        dependencyLink,
        process.platform === "win32" ? "junction" : "dir"
      );
      fs.writeFileSync(skillFile, "candidate\n", "utf8");
      fs.mkdirSync(iterationDirectory);

      expect(changedFiles(root)).toEqual([
        "plugins/azure-skills/skills/azure-kusto/SKILL.md",
      ]);
      const patch = fs.readFileSync(
        writeCandidatePatch(root, iterationDirectory),
        "utf8"
      );
      expect(patch).toContain("plugins/azure-skills/skills/azure-kusto/SKILL.md");
      expect(patch).not.toContain("node_modules");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
      fs.rmSync(dependencySource, { recursive: true, force: true });
    }
  });

  test("writes an applicable final patch with its trailing newline intact", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "skill-improvement-final-patch-"));
    const output = path.join(root, "output");
    const skillFile = path.join(
      root,
      "plugins",
      "azure-skills",
      "skills",
      "azure-kusto",
      "SKILL.md"
    );
    try {
      execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
      execFileSync("git", ["config", "user.name", "Skill Improvement Test"], {
        cwd: root,
      });
      execFileSync("git", ["config", "user.email", "test@example.com"], {
        cwd: root,
      });
      execFileSync("git", ["config", "core.autocrlf", "false"], { cwd: root });
      fs.mkdirSync(path.dirname(skillFile), { recursive: true });
      fs.writeFileSync(skillFile, "# Skill\n\n## Use Cases\n", "utf8");
      execFileSync("git", ["add", "--all"], { cwd: root });
      execFileSync("git", ["commit", "-m", "baseline"], {
        cwd: root,
        stdio: "ignore",
      });
      const baselineCommit = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: root,
        encoding: "utf8",
      }).trim();

      fs.writeFileSync(
        skillFile,
        "# Skill\n\nNew guidance.\n\n## Use Cases\n",
        "utf8"
      );
      execFileSync("git", ["add", "--all"], { cwd: root });
      execFileSync("git", ["commit", "-m", "candidate"], {
        cwd: root,
        stdio: "ignore",
      });
      const candidateCommit = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: root,
        encoding: "utf8",
      }).trim();
      fs.mkdirSync(output);

      const patchPath = writeFinalCandidatePatch(
        root,
        output,
        baselineCommit,
        candidateCommit
      );
      const patch = fs.readFileSync(patchPath);

      expect(patch.at(-1)).toBe(10);
      execFileSync("git", ["checkout", "--detach", baselineCommit], {
        cwd: root,
        stdio: "ignore",
      });
      expect(() =>
        execFileSync("git", ["apply", "--check", patchPath], {
          cwd: root,
          stdio: "ignore",
        })
      ).not.toThrow();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("hill-climbing actionability", () => {
  test("stops when no actionable failure evidence remains", () => {
    expect(hasActionableFailureEvidence([trial()], undefined, 15)).toBe(false);
  });

  test.each([
    ["failed trial", [trial({ passed: false })], undefined, {}],
    ["judge disagreement", [trial({ judgeDisagreement: true })], undefined, {}],
    ["low retained skill invocation", [trial({ targetSkillInvoked: false })], 0.8, {}],
    ["low candidate skill invocation", [trial()], 0.8, { candidateSkillInvocationRate: 0 }],
    ["token growth", [trial()], undefined, { skillMarkdownTokenIncreasePercent: 16 }],
    ["validation failure", [trial()], undefined, { hasValidationFailure: true }],
  ] as const)(
    "continues for %s",
    (_name, trials, minimumInvocationRate, gateEvidence) => {
      expect(hasActionableFailureEvidence(
        [...trials],
        minimumInvocationRate,
        15,
        gateEvidence
      )).toBe(true);
    }
  );
});
