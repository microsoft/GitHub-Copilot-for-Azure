import {
  aggregateJudgments,
  decideAcceptance,
  renderReport,
  type SkillImprovementReport,
} from "../report.ts";
import type { SkillImprovementRunSpec } from "../config.ts";
import type { JudgedTrial } from "../evaluation.ts";

const condition = { name: "skill-with-mcp", skill: "enabled", mcp: "enabled" } as const;

function judged(
  itemId: string,
  answerModel: string,
  judgeModel: string,
  passed: boolean,
  score: number,
  tokens: number,
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
    targetSkillInvoked: true,
    kustoToolCalls: 1,
    totalTokens: tokens,
  };
}

function spec(): SkillImprovementRunSpec {
  return {
    name: "example",
    target: { plugin: "azure-skills", skill: "azure-kusto", baselineRef: "main" },
    evaluations: { development: ["quality.eval.yaml"] },
    models: { answers: ["model-a"], judges: ["judge-a", "judge-b"] },
    experiment: {
      repetitions: 1,
      conditions: [
        condition,
        { name: "control", skill: "disabled", mcp: "enabled" },
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
    output: { issue: "always", draftPullRequest: "accepted-candidate-only" },
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
    expect(decision.comparison.tokenIncreasePercent).toBe(5);
  });

  test("explains accepted-candidate-only in the report", () => {
    const runSpec = spec();
    const report: SkillImprovementReport = {
      runId: "run",
      generatedAt: "2026-09-08T00:00:00Z",
      status: "completed",
      spec: runSpec,
      plan: {
        developmentPromptCount: 2,
        heldOutPromptCount: 0,
        baselineAnswerGenerations: 4,
        candidateAnswerGenerationsPerIteration: 2,
        heldOutAnswerGenerations: 0,
        maximumAnswerGenerations: 6,
        maximumJudgeCalls: 12,
      },
      baselineCommit: "abc",
      baselineSkillTokens: 100,
      baselineTrials: [],
      baselineSummary: {
        total: 0,
        passed: 0,
        passRate: 0,
        averageScore: 0,
        targetSkillInvoked: 0,
        skillInvocationRate: 0,
        kustoToolCalls: 0,
        totalTokens: 0,
        averageTokens: 0,
        judgeDisagreements: 0,
      },
      iterations: [],
      heldOut: undefined,
      finalAccepted: false,
      usage: { answerGenerations: 4, judgeCalls: 8, durationMinutes: 1 },
    };

    expect(renderReport(report)).toContain(
      "a draft pull request is created only when a candidate satisfies every configured acceptance rule"
    );
  });
});
