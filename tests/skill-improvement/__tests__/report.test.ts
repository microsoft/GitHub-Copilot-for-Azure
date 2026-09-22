import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  aggregateJudgments,
  decideAcceptance,
  renderReport,
  renderReportSummary,
  writeReport,
  type SkillImprovementReport,
} from "../report.ts";
import type {
  EvaluationCondition,
  SkillImprovementRunSpec,
} from "../config.ts";
import type { JudgedTrial } from "../evaluation.ts";
import { describe, expect, test } from "vitest";

const skillWithMcp = {
  name: "Skill + MCP",
  skill: "enabled",
  mcp: "enabled",
} as const;

function judged(
  itemId: string,
  answerModel: string,
  judgeModel: string,
  passed: boolean,
  score: number,
  tokens: number,
  condition: EvaluationCondition = skillWithMcp,
  targetSkillInvoked = true,
): JudgedTrial {
  return {
    phase: "candidate",
    condition,
    answerModel,
    judgeModel,
    evalFile: "quality.eval.yaml",
    itemId,
    stimulus: itemId,
    area: "response-quality",
    passed,
    score,
    evidence: `${judgeModel} evidence`,
    details: [],
    output: "answer",
    targetSkillInvoked,
    totalTokens: tokens,
  };
}

function spec(): SkillImprovementRunSpec {
  return {
    name: "example",
    target: { plugin: "azure-skills", skill: "azure-kusto", baselineRef: "main" },
    evaluations: {
      root: "tests/skill-improvement/evals/azure-kusto",
      development: ["quality.eval.yaml"],
    },
    models: { answers: ["model-a"], judges: ["judge-a", "judge-b"] },
    experiment: {
      repetitions: 1,
      conditions: [
        { name: "Agent only", skill: "disabled", mcp: "disabled" },
        { name: "Skill only", skill: "enabled", mcp: "disabled" },
        { name: "MCP only", skill: "disabled", mcp: "enabled" },
        skillWithMcp,
      ],
    },
    improvementAgent: { enabled: true, model: "agent" },
    acceptance: {
      minimumQualityImprovementPoints: 20,
      maximumEvalRegressionPoints: 5,
      maximumModelRegressionPoints: 5,
      minimumSkillInvocationRate: 0.8,
    },
    limits: {
      maxIterations: 1,
      maxAnswerGenerations: 20,
      maxJudgeCalls: 40,
      maxDurationMinutes: 60,
      maxConcurrentJobs: 2,
      maxSkillTokenIncreasePercent: 15,
    },
    output: { issue: "never", draftPullRequest: "accepted-candidate-only" },
  };
}

describe("skill improvement reporting", () => {
  test("uses judge majority and accepts a quality improvement", () => {
    const reference = aggregateJudgments([
      judged("one", "model-a", "judge-a", false, 0.5, 100),
      judged("one", "model-a", "judge-b", false, 0.6, 100),
      judged("two", "model-a", "judge-a", true, 0.9, 100),
      judged("two", "model-a", "judge-b", true, 0.8, 100),
    ]);
    const candidate = aggregateJudgments([
      judged("one", "model-a", "judge-a", true, 0.8, 105),
      judged("one", "model-a", "judge-b", true, 0.9, 105),
      judged("two", "model-a", "judge-a", true, 0.9, 105),
      judged("two", "model-a", "judge-b", true, 0.9, 105),
    ]);

    const decision = decideAcceptance(spec(), reference, candidate, 1000, 1100);

    expect(decision.accepted).toBe(true);
    expect(decision.comparison.qualityImprovementPoints).toBe(50);
    expect(decision.comparison.averageAnswerTokenChangePercent).toBe(5);
    expect(decision.skillMarkdownTokenIncreasePercent).toBe(10);
  });

  test("rejects comparison when candidate trajectories are missing", () => {
    const reference = aggregateJudgments([
      judged("one", "model-a", "judge-a", false, 0.5, 100),
      judged("two", "model-a", "judge-a", true, 0.9, 100),
    ]);
    const candidate = aggregateJudgments([
      judged("two", "model-a", "judge-a", true, 0.9, 100),
    ]);

    expect(() => decideAcceptance(spec(), reference, candidate, 1000, 1000))
      .toThrow("1 missing candidate, 0 unexpected candidate");
  });

  test("renders a decision-first summary with every arm, gate, reason, and changed outcome", () => {
    const runSpec = spec();
    const baselineTrials = runSpec.experiment.conditions.flatMap(condition =>
      aggregateJudgments([
        judged(
          "one",
          "model-a",
          "judge-a",
          true,
          0.9,
          100,
          condition,
          condition.skill === "enabled"
        ),
        judged(
          "one",
          "model-a",
          "judge-b",
          true,
          0.9,
          100,
          condition,
          condition.skill === "enabled"
        ),
      ])
    );
    const reference = baselineTrials.filter(
      trial => trial.condition.name === skillWithMcp.name
    );
    const candidate = aggregateJudgments([
      judged("one", "model-a", "judge-a", false, 0.2, 130, skillWithMcp, false),
      judged("one", "model-a", "judge-b", false, 0.2, 130, skillWithMcp, false),
    ]);
    const decision = decideAcceptance(runSpec, reference, candidate, 1000, 1300);
    const report: SkillImprovementReport = {
      runId: "run",
      generatedAt: "2026-09-08T00:00:00Z",
      status: "completed",
      spec: runSpec,
      plan: {
        developmentPromptCount: 1,
        heldOutPromptCount: 0,
        baselineAnswerGenerations: 4,
        candidateAnswerGenerationsPerIteration: 2,
        heldOutAnswerGenerations: 0,
        maximumAnswerGenerations: 6,
        maximumJudgeCalls: 12,
      },
      baselineCommit: "abc",
      baselineSkillTokens: 1000,
      baselineTrials,
      iterations: [{
        iteration: 1,
        candidatePatchPath: "iteration-1/candidate.patch",
        candidateSkillPath: "iteration-1/candidate-skill",
        changedFiles: ["plugins/azure-skills/skills/azure-kusto/SKILL.md"],
        validationErrors: ["frontmatter validation failed", "reference validation failed"],
        decision,
        trials: candidate,
      }],
      finalAccepted: false,
      usage: { answerGenerations: 6, judgeCalls: 12, durationMinutes: 1 },
    };

    const rendered = renderReportSummary(report);

    expect(rendered.startsWith("# Final outcome: NOT ACCEPTED")).toBe(true);
    for (const name of ["Agent only", "Skill only", "MCP only", "Skill + MCP"]) {
      expect(rendered).toContain(`| ${name} |`);
    }
    expect(rendered).toContain("Candidate pass rate");
    expect(rendered).toContain("answer-token change (diagnostic)");
    expect(rendered).toContain("Skill Markdown token growth (gate)");
    expect(rendered).toContain("Worst answer-model regression");
    expect(rendered).toContain("Worst evaluation regression");
    expect(rendered).toContain("Target Skill invocation rate");
    for (const reason of [...decision.reasons, ...report.iterations[0].validationErrors]) {
      expect(rendered).toContain(reason);
    }
    expect(rendered).toContain("Pass → Fail");
    expect(rendered).toContain("iteration-1/candidate.patch");
    expect(rendered).not.toContain("Kusto calls");
    expect(rendered).not.toContain(`${path.parse(process.cwd()).root}runner`);
  });

  test("writes the concise summary and relative workflow metadata paths", () => {
    const runSpec = spec();
    const report: SkillImprovementReport = {
      runId: "run",
      generatedAt: "2026-09-08T00:00:00Z",
      status: "completed",
      spec: runSpec,
      plan: {
        developmentPromptCount: 0,
        heldOutPromptCount: 0,
        baselineAnswerGenerations: 0,
        candidateAnswerGenerationsPerIteration: 0,
        heldOutAnswerGenerations: 0,
        maximumAnswerGenerations: 0,
        maximumJudgeCalls: 0,
      },
      baselineCommit: "abc",
      baselineSkillTokens: 100,
      baselineTrials: [],
      iterations: [],
      finalAccepted: true,
      finalPatchPath: "final-candidate.patch",
      usage: { answerGenerations: 0, judgeCalls: 0, durationMinutes: 1 },
    };
    const output = fs.mkdtempSync(path.join(os.tmpdir(), "skill-improvement-report-"));

    try {
      writeReport(output, report);
      expect(fs.readFileSync(path.join(output, "report-summary.md"), "utf8"))
        .toContain("# Final outcome: ACCEPTED");
      expect(JSON.parse(
        fs.readFileSync(path.join(output, "workflow-outputs.json"), "utf8")
      ).finalPatchPath).toBe("final-candidate.patch");
      expect(renderReport(report)).toContain(
        "a draft pull request is created only when a candidate satisfies every configured acceptance rule"
      );
    } finally {
      fs.rmSync(output, { recursive: true, force: true });
    }
  });
});
