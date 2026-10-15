import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  aggregateJudgments,
  buildFailurePacket,
  decideAcceptance,
  decideRefinement,
  renderReport,
  renderReportSummary,
  writeReport,
  type AggregatedTrial,
  type SkillImprovementReport,
} from "../report.ts";
import type {
  EvaluationCondition,
  SkillImprovementRunSpec,
} from "../config.ts";
import type { JudgedTrial } from "../evaluation.ts";
import { emptyBilling, type BatchBilling } from "../billing.ts";
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
  evalFile = "quality.eval.yaml",
): JudgedTrial {
  return {
    phase: "candidate",
    condition,
    answerModel,
    judgeModel,
    evalFile,
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
    refinement: {
      minimumScoreImprovementPoints: 1,
      maximumQualityRegressionPoints: 0,
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

function decideHeldOut(
  reference: AggregatedTrial[],
  candidate: AggregatedTrial[],
) {
  const runSpec = spec();
  runSpec.acceptance = {
    ...runSpec.acceptance,
    minimumQualityImprovementPoints: 0,
    maximumEvalRegressionPoints: 0,
    maximumModelRegressionPoints: 0,
  };
  return decideAcceptance(runSpec, reference, candidate, 1000, 1000);
}

describe("skill improvement reporting", () => {
  test("averages repeated answer billing without summing duplicated judge records", () => {
    const trials = [
      { ...judged("one", "model-a", "judge-a", true, 1, 100), answerBilledCredits: 2 },
      { ...judged("one", "model-a", "judge-b", true, 1, 100), answerBilledCredits: 2 },
      { ...judged("one", "model-a", "judge-a", true, 1, 100), answerBilledCredits: 4 },
      { ...judged("one", "model-a", "judge-b", true, 1, 100), answerBilledCredits: 4 },
    ];
    expect(aggregateJudgments(trials)[0].answerBilledCredits).toBe(3);
    expect(aggregateJudgments([
      ...trials,
      judged("one", "model-a", "judge-a", true, 1, 100),
    ])[0].answerBilledCredits).toBeUndefined();
    expect(aggregateJudgments([
      judged("one", "model-a", "judge-a", true, 1, 100),
      judged("one", "model-a", "judge-b", true, 1, 100),
      judged("one", "model-a", "judge-a", true, 1, 200),
      judged("one", "model-a", "judge-b", true, 1, 200),
    ])[0].totalTokens).toBe(150);
  });
  test("includes previous validation failures in the next failure packet", () => {
    const packet = buildFailurePacket(
      spec(),
      aggregateJudgments([
        judged("one", "model-a", "judge-a", true, 1, 100),
      ]),
      undefined,
      undefined,
      ["Frontmatter validation failed.", "Reference validation failed."]
    );

    expect(packet).toContain("## Previous candidate validation failures");
    expect(packet).toContain("- Frontmatter validation failed.");
    expect(packet).toContain("- Reference validation failed.");
  });

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

  test("accepts a saturated held-out baseline when the candidate does not regress", () => {
    const reference = aggregateJudgments([
      judged("one", "model-a", "judge-a", true, 1, 100),
      judged("two", "model-a", "judge-a", true, 1, 100),
    ]);
    const candidate = aggregateJudgments([
      judged("one", "model-a", "judge-a", true, 1, 100),
      judged("two", "model-a", "judge-a", true, 1, 100),
    ]);
    const decision = decideHeldOut(reference, candidate);

    expect(decision.accepted).toBe(true);
    expect(decision.comparison.qualityImprovementPoints).toBe(0);
  });

  test("keeps the development quality-improvement requirement unchanged", () => {
    const reference = aggregateJudgments([
      judged("one", "model-a", "judge-a", true, 1, 100),
    ]);
    const candidate = aggregateJudgments([
      judged("one", "model-a", "judge-a", true, 1, 100),
    ]);

    const decision = decideAcceptance(spec(), reference, candidate, 1000, 1000);

    expect(decision.accepted).toBe(false);
    expect(decision.reasons.join("\n")).toContain("20.00 required");
  });

  test("rejects a held-out regression when no regression is allowed", () => {
    const reference = aggregateJudgments([
      judged("one", "model-a", "judge-a", true, 1, 100),
      judged("two", "model-a", "judge-a", true, 1, 100),
    ]);
    const candidate = aggregateJudgments([
      judged("one", "model-a", "judge-a", false, 0, 100),
      judged("two", "model-a", "judge-a", true, 1, 100),
    ]);
    const decision = decideHeldOut(reference, candidate);

    expect(decision.accepted).toBe(false);
    expect(decision.comparison.qualityImprovementPoints).toBe(-50);
    expect(decision.reasons.join("\n")).toContain("0.00 required");
  });

  test("rejects a held-out per-evaluation regression with unchanged aggregate quality", () => {
    const reference = aggregateJudgments([
      judged("one", "model-a", "judge-a", true, 1, 100, skillWithMcp, true, "one.eval.yaml"),
      judged("two", "model-a", "judge-a", false, 0, 100, skillWithMcp, true, "two.eval.yaml"),
    ]);
    const candidate = aggregateJudgments([
      judged("one", "model-a", "judge-a", false, 0, 100, skillWithMcp, true, "one.eval.yaml"),
      judged("two", "model-a", "judge-a", true, 1, 100, skillWithMcp, true, "two.eval.yaml"),
    ]);
    const decision = decideHeldOut(reference, candidate);

    expect(decision.accepted).toBe(false);
    expect(decision.comparison.qualityImprovementPoints).toBe(0);
    expect(decision.reasons.join("\n")).toContain("one.eval.yaml regressed");
  });

  test("rejects a held-out per-model regression with unchanged aggregate quality", () => {
    const reference = aggregateJudgments([
      judged("one", "model-a", "judge-a", true, 1, 100),
      judged("two", "model-b", "judge-a", false, 0, 100),
    ]);
    const candidate = aggregateJudgments([
      judged("one", "model-a", "judge-a", false, 0, 100),
      judged("two", "model-b", "judge-a", true, 1, 100),
    ]);
    const decision = decideHeldOut(reference, candidate);

    expect(decision.accepted).toBe(false);
    expect(decision.comparison.qualityImprovementPoints).toBe(0);
    expect(decision.reasons.join("\n")).toContain("model-a regressed");
  });

  test("retains score progress for another refinement iteration", () => {
    const reference = aggregateJudgments([
      judged("one", "model-a", "judge-a", false, 0.5, 100),
      judged("two", "model-a", "judge-a", true, 0.8, 100),
    ]);
    const candidate = aggregateJudgments([
      judged("one", "model-a", "judge-a", false, 0.55, 100),
      judged("two", "model-a", "judge-a", true, 0.8, 100),
    ]);

    const decision = decideRefinement(spec(), reference, candidate, 1000, 1000);

    expect(decision.retained).toBe(true);
    expect(decision.comparison.qualityImprovementPoints).toBe(0);
    expect(decision.comparison.scoreImprovementPoints).toBe(2.5);
  });

  test("rejects refinement that crosses the aggregate quality boundary", () => {
    const reference = aggregateJudgments([
      judged("one", "model-a", "judge-a", true, 0.8, 100),
      judged("two", "model-a", "judge-a", true, 0.8, 100),
    ]);
    const candidate = aggregateJudgments([
      judged("one", "model-a", "judge-a", false, 0.9, 100),
      judged("two", "model-a", "judge-a", true, 0.9, 100),
    ]);

    const decision = decideRefinement(spec(), reference, candidate, 1000, 1000);

    expect(decision.retained).toBe(false);
    expect(decision.reasons.join("\n")).toContain("Aggregate quality regressed");
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
      ]).map(trial => ({ ...trial, answerBilledCredits: 2 }))
    );
    const reference = baselineTrials.filter(
      trial => trial.condition.name === skillWithMcp.name
    );
    const candidate = aggregateJudgments([
      judged("one", "model-a", "judge-a", false, 0.2, 130, skillWithMcp, false),
      judged("one", "model-a", "judge-b", false, 0.2, 130, skillWithMcp, false),
    ]).map(trial => ({ ...trial, answerBilledCredits: 3 }));
    const decision = decideAcceptance(runSpec, reference, candidate, 1000, 1300);
    const refinementDecision = decideRefinement(
      runSpec,
      reference,
      candidate,
      1000,
      1300
    );
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
        refinementDecision,
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
    expect(rendered).toContain("refinement gates");
    expect(rendered).toContain("Refinement progress");
    for (const reason of [...decision.reasons, ...report.iterations[0].validationErrors]) {
      expect(rendered).toContain(reason);
    }
    expect(rendered).toContain("Pass → Fail");
    expect(rendered).toContain("iteration-1/candidate.patch");
    expect(rendered).toContain("## Correctness and trajectory tokens");
    expect(rendered).toContain("| Iteration 1 | model-a | Skill + MCP | 0/1 (0.0%) | 0/2 | 130 |");
    expect(rendered).toContain("## Answer AI-credit consumption");
    expect(rendered).toContain("| Batch | Model | Arm | Tests | Repetitions | Billing coverage | Avg AIC / test | Total answer AIC |");
    expect(rendered).toContain("| Iteration 1 | model-a | Skill + MCP | 1 | 1 | 1/1 | 3.000000 | 3.000000 |");
    report.spec.experiment.repetitions = 2;
    expect(renderReportSummary(report)).toContain("| 1 | 2 | 0/1 | not measured (incomplete) | not measured (incomplete) |");
    report.iterations[0].trials = candidate.map(trial => ({
      ...trial,
      judgments: [...trial.judgments, ...trial.judgments],
    }));
    expect(renderReportSummary(report)).toContain("| 1 | 2 | 1/1 | 3.000000 | 6.000000 |");
    report.spec.experiment.repetitions = 1;
    report.iterations[0].trials = candidate.map(trial => ({
      ...trial,
      answerBilledCredits: undefined,
    }));
    expect(renderReportSummary(report)).toContain("not measured (incomplete)");
    expect(renderReportSummary(report)).toContain("| 1 | 1 | 0/1 | not measured (incomplete) | not measured (incomplete) |");
    expect(rendered).not.toContain("Kusto calls");
    expect(rendered).not.toContain(`${path.parse(process.cwd()).root}runner`);
  });

  test.each([
    { enabled: false, maxIterations: 1 },
    { enabled: true, maxIterations: 0 },
    { enabled: false, maxIterations: 0 },
  ])("reports baseline-only runs as completed evaluations: %s", ({ enabled, maxIterations }) => {
    const runSpec = spec();
    runSpec.improvementAgent.enabled = enabled;
    runSpec.limits.maxIterations = maxIterations;
    const report: SkillImprovementReport = {
      runId: "run",
      generatedAt: "2026-10-09T00:00:00Z",
      status: "completed",
      spec: runSpec,
      plan: {
        developmentPromptCount: 1,
        heldOutPromptCount: 0,
        baselineAnswerGenerations: 4,
        candidateAnswerGenerationsPerIteration: 0,
        heldOutAnswerGenerations: 0,
        maximumAnswerGenerations: 4,
        maximumJudgeCalls: 8,
      },
      baselineCommit: "abc",
      baselineSkillTokens: 100,
      baselineTrials: [],
      iterations: [],
      finalAccepted: false,
      usage: { answerGenerations: 4, judgeCalls: 8, durationMinutes: 1 },
    };

    const summary = renderReportSummary(report);
    const detailed = renderReport(report);

    expect(summary.startsWith("# Final outcome: BASELINE EVALUATION COMPLETED")).toBe(true);
    expect(summary).toContain("Candidate evaluation: **not configured (baseline-only run)**");
    expect(summary).toContain("acceptance and rejection do not apply");
    expect(summary).not.toContain("## Candidate decisions");
    expect(summary).not.toContain("## Rejection and validation reasons");
    expect(summary).not.toContain("NOT ACCEPTED");
    expect(detailed).toContain("Candidate evaluation: **not configured (baseline-only run)**");
    expect(detailed).not.toContain("Final acceptance: **not passed**");
    report.status = "failed";
    expect(renderReportSummary(report)).toContain("# Final outcome: RUN FAILED");
  });

  test("totals unrounded repeated answer credits once across judges, models, and held-out batches", () => {
    const runSpec = spec();
    runSpec.experiment.repetitions = 2;
    runSpec.models.answers = ["model-a", "model-b"];
    const records = runSpec.models.answers.flatMap(model =>
      ["one", "two"].flatMap(item =>
        [0.1234564, 0.2345674].flatMap(credits =>
          runSpec.models.judges.map(judge => ({
            ...judged(item, model, judge, true, 1, 100),
            answerBilledCredits: model === "model-a" ? credits : 0,
          }))
        )
      )
    );
    const trials = aggregateJudgments(records);
    const decision = decideAcceptance(runSpec, trials, trials, 100, 100);
    const report: SkillImprovementReport = {
      runId: "run",
      generatedAt: "2026-10-14T00:00:00Z",
      status: "completed",
      spec: runSpec,
      plan: {
        developmentPromptCount: 2,
        heldOutPromptCount: 2,
        baselineAnswerGenerations: 8,
        candidateAnswerGenerationsPerIteration: 8,
        heldOutAnswerGenerations: 16,
        maximumAnswerGenerations: 32,
        maximumJudgeCalls: 64,
      },
      baselineCommit: "abc",
      baselineSkillTokens: 100,
      baselineTrials: trials,
      iterations: [{ iteration: 1, changedFiles: [], validationErrors: [], trials }],
      heldOut: { decision, baselineTrials: trials, candidateTrials: trials },
      finalAccepted: false,
      usage: { answerGenerations: 32, judgeCalls: 64, durationMinutes: 1 },
    };
    const rendered = renderReportSummary(report);
    for (const batch of ["Baseline", "Iteration 1", "Held-out baseline", "Held-out candidate"]) {
      expect(rendered).toContain(`| ${batch} | model-a | Skill + MCP | 2 | 2 | 2/2 | 0.179012 | 0.716048 |`);
      expect(rendered).toContain(`| ${batch} | model-b | Skill + MCP | 2 | 2 | 2/2 | 0.000000 | 0.000000 |`);
    }
    expect(renderReport(report)).toContain("0.716048");

    // An equal total verdict count is insufficient when one judge is overrepresented.
    report.baselineTrials = trials.map(trial => ({
      ...trial,
      judgments: trial.judgments.map(judgment => ({ ...judgment, judgeModel: "judge-a" })),
    }));
    expect(renderReportSummary(report)).toContain(
      "| Baseline | model-a | Skill + MCP | 2 | 2 | 0/2 | not measured (incomplete) | not measured (incomplete) |"
    );

    report.baselineTrials = aggregateJudgments(records.map((trial, index) =>
      index === 0 ? { ...trial, answerBilledCredits: undefined } : trial
    ));
    expect(renderReportSummary(report)).toContain(
      "| Baseline | model-a | Skill + MCP | 2 | 2 | 1/2 | not measured (incomplete) | not measured (incomplete) |"
    );

    const batchBilling = (batch: string, withAgent = false): BatchBilling => ({
      batch, finalized: true,
      answers: {
        ...emptyBilling("answer trajectories", 8, "copilot_usage.totalNanoAiu"),
        observed: 8, measured: 8, measuredAiCredits: 4,
      },
      judges: emptyBilling("graded trajectories", 16, "vally", "Judge billing unavailable."),
      agents: withAgent ? {
        ...emptyBilling("agent invocations", 1, "copilot_cli.usage_output.totalNanoAiu"),
        observed: 1, measured: 1, measuredAiCredits: 2,
      } : emptyBilling("agent invocations", 0, "not applicable"),
    });
    report.billing = [
      batchBilling("Baseline"), batchBilling("Iteration 1", true),
      batchBilling("Held-out baseline"), batchBilling("Held-out candidate"),
    ];
    let accounting = renderReportSummary(report);
    expect(accounting).toContain(
      "| Baseline | 4.000000 | unavailable | N/A | 4.000000 (measured subtotal) |"
    );
    expect(accounting).toContain(
      "| Iteration 1 | 4.000000 | unavailable | 2.000000 | 6.000000 (measured subtotal) |"
    );
    expect(accounting).toContain(
      "| Run total | 16.000000 | unavailable | 2.000000 | 18.000000 (measured subtotal) |"
    );
    expect(accounting).toContain("answers 32/32 answer trajectories; judges 0/64 graded trajectories; agents 1/1 agent invocations");
    for (const batch of report.billing) {
      batch.judges = { ...batch.judges, observed: 16, measured: 16, measuredAiCredits: 1 };
      delete batch.judges.reason;
    }
    accounting = renderReportSummary(report);
    expect(accounting).toContain("| Run total | 16.000000 | 4.000000 | 2.000000 | 22.000000 |");
    report.billing[1].agents.measured = 0;
    report.billing[1].agents.measuredAiCredits = 0;
    expect(renderReportSummary(report)).toContain(
      "| Run total | 16.000000 | 4.000000 | unavailable | 20.000000 (measured subtotal) |"
    );
    report.billing[1].agents.measured = 1;
    report.billing[1].agents.measuredAiCredits = 0;
    expect(renderReportSummary(report)).toContain("| Run total | 16.000000 | 4.000000 | 0.000000 | 20.000000 |");
    report.billing[1].finalized = false;
    expect(renderReportSummary(report)).toContain(
      "| Run total | 16.000000 | 4.000000 | 0.000000 | 20.000000 (measured subtotal) |"
    );
    expect(renderReportSummary(report)).toContain("incomplete attempt accounting");
    report.billing[1].finalized = true;
    report.status = "failed";
    expect(renderReportSummary(report)).toContain(
      "| Run total | 16.000000 | 4.000000 | 0.000000 | 20.000000 (measured subtotal) |"
    );
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
      terminationReason: "no-actionable-failures",
      finalAccepted: true,
      finalPatchPath: "final-candidate.patch",
      usage: { answerGenerations: 0, judgeCalls: 0, durationMinutes: 1 },
    };
    const output = fs.mkdtempSync(path.join(os.tmpdir(), "skill-improvement-report-"));

    try {
      writeReport(output, report);
      expect(fs.readFileSync(path.join(output, "report-summary.md"), "utf8"))
        .toContain("# Final outcome: ACCEPTED");
      expect(fs.readFileSync(path.join(output, "report-summary.md"), "utf8"))
        .toContain("no-actionable-failures");
      expect(fs.existsSync(path.join(output, "issue-summary.md"))).toBe(false);
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
