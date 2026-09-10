import fs from "node:fs";
import path from "node:path";
import type { RunPlan, SkillImprovementRunSpec } from "./config.ts";
import type { JudgedTrial } from "./evaluation.ts";

export type AggregatedTrial = {
  condition: JudgedTrial["condition"];
  answerModel: string;
  evalFile: string;
  itemId: string;
  stimulus: string;
  area: string;
  passed: boolean;
  score: number;
  judgePasses: number;
  judgeCount: number;
  judgeDisagreement: boolean;
  judgments: Array<{
    judgeModel: string;
    passed: boolean;
    score: number;
    evidence: string;
  }>;
  output: string;
  targetSkillInvoked: boolean;
  kustoToolCalls: number;
  totalTokens: number;
};

export type EvaluationSummary = {
  total: number;
  passed: number;
  passRate: number;
  averageScore: number;
  targetSkillInvoked: number;
  skillInvocationRate: number;
  kustoToolCalls: number;
  totalTokens: number;
  averageTokens: number;
  judgeDisagreements: number;
};

export type Comparison = {
  matchedTrials: number;
  reference: EvaluationSummary;
  candidate: EvaluationSummary;
  qualityImprovementPoints: number;
  scoreImprovementPoints: number;
  tokenIncreasePercent: number;
  byModel: Array<{
    name: string;
    referencePassRate: number;
    candidatePassRate: number;
    differencePoints: number;
  }>;
  byEval: Array<{
    name: string;
    referencePassRate: number;
    candidatePassRate: number;
    differencePoints: number;
  }>;
};

export type AcceptanceDecision = {
  accepted: boolean;
  reasons: string[];
  comparison: Comparison;
};

export type IterationReport = {
  iteration: number;
  candidateCommit?: string;
  candidatePatchPath?: string;
  changedFiles: string[];
  validationErrors: string[];
  decision?: AcceptanceDecision;
  trials?: AggregatedTrial[];
};

export type SkillImprovementReport = {
  runId: string;
  generatedAt: string;
  status: "completed" | "failed";
  failure?: string;
  spec: SkillImprovementRunSpec;
  plan: RunPlan;
  baselineCommit: string;
  baselineSkillTokens: number;
  baselineTrials: AggregatedTrial[];
  baselineSummary: EvaluationSummary;
  iterations: IterationReport[];
  heldOut?: {
    decision: AcceptanceDecision;
    baselineTrials: AggregatedTrial[];
    candidateTrials: AggregatedTrial[];
  };
  bestCandidateCommit?: string;
  finalAccepted: boolean;
  finalPatchPath?: string;
  usage: {
    answerGenerations: number;
    judgeCalls: number;
    durationMinutes: number;
  };
};

function round(value: number, digits = 4): number {
  return Number(value.toFixed(digits));
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function trialKey(trial: Pick<JudgedTrial, "condition" | "answerModel" | "evalFile" | "itemId">): string {
  return JSON.stringify([
    trial.condition.name,
    trial.answerModel,
    trial.evalFile,
    trial.itemId,
  ]);
}

export function aggregateJudgments(trials: JudgedTrial[]): AggregatedTrial[] {
  const groups = new Map<string, JudgedTrial[]>();
  for (const trial of trials) {
    const key = trialKey(trial);
    const group = groups.get(key) ?? [];
    group.push(trial);
    groups.set(key, group);
  }

  return [...groups.values()].map(group => {
    const first = group[0];
    const judgePasses = group.filter(trial => trial.passed).length;
    const requiredPasses = Math.floor(group.length / 2) + 1;
    return {
      condition: first.condition,
      answerModel: first.answerModel,
      evalFile: first.evalFile,
      itemId: first.itemId,
      stimulus: first.stimulus,
      area: first.area,
      passed: judgePasses >= requiredPasses,
      score: round(median(group.map(trial => trial.score))),
      judgePasses,
      judgeCount: group.length,
      judgeDisagreement: judgePasses > 0 && judgePasses < group.length,
      judgments: group.map(trial => ({
        judgeModel: trial.judgeModel,
        passed: trial.passed,
        score: trial.score,
        evidence: trial.evidence,
      })),
      output: first.output,
      targetSkillInvoked: first.targetSkillInvoked,
      kustoToolCalls: first.kustoToolCalls,
      totalTokens: first.totalTokens,
    };
  });
}

export function summarizeTrials(trials: AggregatedTrial[]): EvaluationSummary {
  const passed = trials.filter(trial => trial.passed).length;
  const invoked = trials.filter(trial => trial.targetSkillInvoked).length;
  const totalTokens = trials.reduce((total, trial) => total + trial.totalTokens, 0);
  return {
    total: trials.length,
    passed,
    passRate: trials.length === 0 ? 0 : round(passed / trials.length),
    averageScore: trials.length === 0
      ? 0
      : round(trials.reduce((total, trial) => total + trial.score, 0) / trials.length),
    targetSkillInvoked: invoked,
    skillInvocationRate: trials.length === 0 ? 0 : round(invoked / trials.length),
    kustoToolCalls: trials.reduce((total, trial) => total + trial.kustoToolCalls, 0),
    totalTokens,
    averageTokens: trials.length === 0 ? 0 : round(totalTokens / trials.length),
    judgeDisagreements: trials.filter(trial => trial.judgeDisagreement).length,
  };
}

function compareGroup(
  reference: AggregatedTrial[],
  candidate: AggregatedTrial[],
  nameSelector: (trial: AggregatedTrial) => string,
): Array<{
  name: string;
  referencePassRate: number;
  candidatePassRate: number;
  differencePoints: number;
}> {
  const names = new Set(reference.map(nameSelector));
  return [...names].sort().map(name => {
    const referenceSummary = summarizeTrials(reference.filter(trial => nameSelector(trial) === name));
    const candidateSummary = summarizeTrials(candidate.filter(trial => nameSelector(trial) === name));
    return {
      name,
      referencePassRate: referenceSummary.passRate,
      candidatePassRate: candidateSummary.passRate,
      differencePoints: round(
        (candidateSummary.passRate - referenceSummary.passRate) * 100,
        2
      ),
    };
  });
}

export function compareTrials(
  referenceTrials: AggregatedTrial[],
  candidateTrials: AggregatedTrial[],
): Comparison {
  const referenceByKey = new Map(referenceTrials.map(trial => [trialKey(trial), trial]));
  const candidateByKey = new Map(candidateTrials.map(trial => [trialKey(trial), trial]));
  const matchedKeys = [...candidateByKey.keys()].filter(key => referenceByKey.has(key));
  const reference = matchedKeys.map(key => referenceByKey.get(key)!);
  const candidate = matchedKeys.map(key => candidateByKey.get(key)!);
  if (matchedKeys.length === 0) {
    throw new Error("Candidate and reference evaluations have no matching trials.");
  }
  const referenceSummary = summarizeTrials(reference);
  const candidateSummary = summarizeTrials(candidate);
  const tokenIncreasePercent = referenceSummary.averageTokens === 0
    ? 0
    : round(
      ((candidateSummary.averageTokens - referenceSummary.averageTokens)
        / referenceSummary.averageTokens) * 100,
      2
    );
  return {
    matchedTrials: matchedKeys.length,
    reference: referenceSummary,
    candidate: candidateSummary,
    qualityImprovementPoints: round(
      (candidateSummary.passRate - referenceSummary.passRate) * 100,
      2
    ),
    scoreImprovementPoints: round(
      (candidateSummary.averageScore - referenceSummary.averageScore) * 100,
      2
    ),
    tokenIncreasePercent,
    byModel: compareGroup(reference, candidate, trial => trial.answerModel),
    byEval: compareGroup(reference, candidate, trial => trial.evalFile),
  };
}

export function decideAcceptance(
  spec: SkillImprovementRunSpec,
  referenceTrials: AggregatedTrial[],
  candidateTrials: AggregatedTrial[],
  baselineSkillTokens: number,
  candidateSkillTokens: number,
): AcceptanceDecision {
  const comparison = compareTrials(referenceTrials, candidateTrials);
  const reasons: string[] = [];
  if (
    comparison.qualityImprovementPoints
    < spec.acceptance.minimumQualityImprovementPoints
  ) {
    reasons.push(
      `Quality improved by ${comparison.qualityImprovementPoints.toFixed(2)} points; `
      + `${spec.acceptance.minimumQualityImprovementPoints.toFixed(2)} required.`
    );
  }
  const worstModel = [...comparison.byModel]
    .sort((a, b) => a.differencePoints - b.differencePoints)[0];
  if (
    worstModel
    && worstModel.differencePoints < -spec.acceptance.maximumModelRegressionPoints
  ) {
    reasons.push(
      `${worstModel.name} regressed by ${Math.abs(worstModel.differencePoints).toFixed(2)} points; `
      + `${spec.acceptance.maximumModelRegressionPoints.toFixed(2)} allowed.`
    );
  }
  const worstEval = [...comparison.byEval]
    .sort((a, b) => a.differencePoints - b.differencePoints)[0];
  if (
    worstEval
    && worstEval.differencePoints < -spec.acceptance.maximumEvalRegressionPoints
  ) {
    reasons.push(
      `${worstEval.name} regressed by ${Math.abs(worstEval.differencePoints).toFixed(2)} points; `
      + `${spec.acceptance.maximumEvalRegressionPoints.toFixed(2)} allowed.`
    );
  }
  const skillIncreasePercent = baselineSkillTokens === 0
    ? 0
    : ((candidateSkillTokens - baselineSkillTokens) / baselineSkillTokens) * 100;
  if (skillIncreasePercent > spec.limits.maxSkillTokenIncreasePercent) {
    reasons.push(
      `Estimated skill tokens increased by ${skillIncreasePercent.toFixed(2)}%; `
      + `${spec.limits.maxSkillTokenIncreasePercent.toFixed(2)}% allowed.`
    );
  }
  if (
    spec.acceptance.minimumSkillInvocationRate !== undefined
    && comparison.candidate.skillInvocationRate
      < spec.acceptance.minimumSkillInvocationRate
  ) {
    reasons.push(
      `Target skill invocation rate was ${(comparison.candidate.skillInvocationRate * 100).toFixed(1)}%; `
      + `${(spec.acceptance.minimumSkillInvocationRate * 100).toFixed(1)}% required.`
    );
  }
  return {
    accepted: reasons.length === 0,
    reasons,
    comparison,
  };
}

export function buildFailurePacket(
  spec: SkillImprovementRunSpec,
  trials: AggregatedTrial[],
  previousDecision?: AcceptanceDecision,
): string {
  const failures = trials
    .filter(trial => !trial.passed || trial.judgeDisagreement)
    .sort((a, b) => a.score - b.score);
  const lines = [
    `# ${spec.target.skill} improvement input`,
    "",
    "Improve the skill based on the development evaluation evidence below.",
    "Do not edit evaluation files, graders, workflows, or unrelated skills.",
    "",
  ];
  if (previousDecision && !previousDecision.accepted) {
    lines.push("## Previous candidate rejection", "");
    for (const reason of previousDecision.reasons) {
      lines.push(`- ${reason}`);
    }
    lines.push("");
  }
  lines.push("## Development failures and disagreements", "");
  for (const failure of failures) {
    lines.push(
      `### ${failure.stimulus}`,
      "",
      `- Eval: \`${failure.evalFile}\``,
      `- Answer model: \`${failure.answerModel}\``,
      `- Condition: \`${failure.condition.name}\``,
      `- Score: ${(failure.score * 100).toFixed(1)}%`,
      `- Judges passing: ${failure.judgePasses}/${failure.judgeCount}`,
      `- Skill invoked: ${failure.targetSkillInvoked ? "yes" : "no"}`,
      "",
      "Judge evidence:",
    );
    for (const judgment of failure.judgments) {
      lines.push(
        `- **${judgment.judgeModel}** (${judgment.passed ? "pass" : "fail"}, `
        + `${(judgment.score * 100).toFixed(1)}%): ${judgment.evidence.slice(0, 2500)}`
      );
    }
    lines.push("", "Answer excerpt:", "", failure.output.slice(0, 4000), "");
  }
  if (failures.length === 0) {
    lines.push("No failed or judge-disputed development trials were found.", "");
  }
  return `${lines.join("\n")}\n`;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function renderSummaryTable(trials: AggregatedTrial[]): string[] {
  const groups = new Map<string, AggregatedTrial[]>();
  for (const trial of trials) {
    const key = JSON.stringify([
      trial.condition.name,
      trial.answerModel,
      trial.evalFile,
    ]);
    const group = groups.get(key) ?? [];
    group.push(trial);
    groups.set(key, group);
  }
  const lines = [
    "| Condition | Answer model | Eval | Passed | Pass rate | Score | Skill invocation | Kusto calls | Avg. tokens | Judge disagreements |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];
  for (const [key, group] of groups) {
    const [condition, model, evalFile] = JSON.parse(key) as string[];
    const summary = summarizeTrials(group);
    lines.push(
      `| ${condition} | ${model} | ${evalFile} | ${summary.passed}/${summary.total} | `
      + `${percent(summary.passRate)} | ${percent(summary.averageScore)} | `
      + `${summary.targetSkillInvoked}/${summary.total} | ${summary.kustoToolCalls} | `
      + `${summary.averageTokens.toFixed(0)} | ${summary.judgeDisagreements} |`
    );
  }
  return lines;
}

function renderFailureDetails(trials: AggregatedTrial[]): string[] {
  const failures = trials
    .filter(trial => !trial.passed || trial.judgeDisagreement)
    .sort((a, b) => a.score - b.score)
    .slice(0, 30);
  if (failures.length === 0) {
    return ["No failed or judge-disputed trials.", ""];
  }
  const lines: string[] = [];
  for (const trial of failures) {
    lines.push(
      `<details><summary>${trial.stimulus} — ${trial.answerModel}, ${trial.condition.name}, ${(trial.score * 100).toFixed(1)}%</summary>`,
      "",
      `- Eval: \`${trial.evalFile}\``,
      `- Pass: ${trial.passed ? "yes" : "no"}`,
      `- Skill invoked: ${trial.targetSkillInvoked ? "yes" : "no"}`,
      `- Kusto calls: ${trial.kustoToolCalls}`,
      `- Tokens: ${trial.totalTokens}`,
      ""
    );
    for (const judgment of trial.judgments) {
      lines.push(
        `**${judgment.judgeModel}** — ${judgment.passed ? "pass" : "fail"}, `
        + `${(judgment.score * 100).toFixed(1)}%`,
        "",
        judgment.evidence.slice(0, 1500),
        ""
      );
    }
    lines.push("</details>", "");
  }
  return lines;
}

function renderSkillEffects(trials: AggregatedTrial[]): string[] {
  const lines = [
    "| Answer model | MCP | With skill | Without skill | Difference |",
    "| --- | --- | ---: | ---: | ---: |",
  ];
  for (const answerModel of [...new Set(trials.map(trial => trial.answerModel))].sort()) {
    for (const mcp of ["enabled", "disabled"] as const) {
      const withSkill = trials.filter(trial =>
        trial.answerModel === answerModel
        && trial.condition.mcp === mcp
        && trial.condition.skill === "enabled"
      );
      const withoutSkill = trials.filter(trial =>
        trial.answerModel === answerModel
        && trial.condition.mcp === mcp
        && trial.condition.skill === "disabled"
      );
      if (withSkill.length === 0 || withoutSkill.length === 0) {
        continue;
      }
      const withSummary = summarizeTrials(withSkill);
      const withoutSummary = summarizeTrials(withoutSkill);
      const difference = (withSummary.passRate - withoutSummary.passRate) * 100;
      lines.push(
        `| ${answerModel} | ${mcp === "enabled" ? "Yes" : "No"} | `
        + `${percent(withSummary.passRate)} | ${percent(withoutSummary.passRate)} | `
        + `${difference >= 0 ? "+" : ""}${difference.toFixed(2)} points |`
      );
    }
  }
  return lines.length === 2
    ? ["No matching skill-enabled and skill-disabled conditions were configured.", ""]
    : [...lines, ""];
}

export function renderReport(report: SkillImprovementReport): string {
  const lines = [
    `# Skill improvement run: ${report.spec.target.skill}`,
    "",
    `- Run ID: \`${report.runId}\``,
    `- Status: **${report.status}**`,
    `- Baseline: \`${report.baselineCommit}\``,
    `- Best development candidate: ${report.bestCandidateCommit ? `\`${report.bestCandidateCommit}\`` : "none"}`,
    `- Final acceptance: **${report.finalAccepted ? "passed" : "not passed"}**`,
    `- Answer generations: ${report.usage.answerGenerations}/${report.spec.limits.maxAnswerGenerations}`,
    `- Judge calls: ${report.usage.judgeCalls}/${report.spec.limits.maxJudgeCalls}`,
    `- Duration: ${report.usage.durationMinutes.toFixed(1)}/${report.spec.limits.maxDurationMinutes} minutes`,
    "",
    "## Run plan",
    "",
    `- Development prompts: ${report.plan.developmentPromptCount}`,
    `- Held-out prompts: ${report.plan.heldOutPromptCount}`,
    `- Maximum answer generations: ${report.plan.maximumAnswerGenerations}`,
    `- Maximum judge calls: ${report.plan.maximumJudgeCalls}`,
    `- Iterations: ${report.spec.limits.maxIterations}`,
    `- Concurrent evaluation jobs: ${report.spec.limits.maxConcurrentJobs}`,
    "",
    "## Baseline results",
    "",
    ...renderSummaryTable(report.baselineTrials),
    "",
    "### Baseline skill effect",
    "",
    ...renderSkillEffects(report.baselineTrials),
    "### Baseline failures and judge disagreements",
    "",
    ...renderFailureDetails(report.baselineTrials),
  ];
  for (const iteration of report.iterations) {
    lines.push(`## Iteration ${iteration.iteration}`, "");
    if (iteration.changedFiles.length > 0) {
      lines.push("Changed files:", "", ...iteration.changedFiles.map(file => `- \`${file}\``), "");
    }
    if (iteration.candidatePatchPath) {
      lines.push(`Candidate patch: \`${iteration.candidatePatchPath}\``, "");
    }
    if (iteration.validationErrors.length > 0) {
      lines.push(
        "Validation errors:",
        "",
        ...iteration.validationErrors.map(error => `- ${error}`),
        ""
      );
    }
    if (iteration.decision) {
      const comparison = iteration.decision.comparison;
      lines.push(
        `Decision: **${iteration.decision.accepted ? "accepted" : "rejected"}**`,
        "",
        `- Quality difference: ${comparison.qualityImprovementPoints >= 0 ? "+" : ""}${comparison.qualityImprovementPoints.toFixed(2)} points`,
        `- Average score difference: ${comparison.scoreImprovementPoints >= 0 ? "+" : ""}${comparison.scoreImprovementPoints.toFixed(2)} points`,
        `- Average token difference: ${comparison.tokenIncreasePercent >= 0 ? "+" : ""}${comparison.tokenIncreasePercent.toFixed(2)}%`,
        ""
      );
      if (iteration.decision.reasons.length > 0) {
        lines.push(...iteration.decision.reasons.map(reason => `- ${reason}`), "");
      }
    }
    if (iteration.trials) {
      lines.push(
        ...renderSummaryTable(iteration.trials),
        "",
        "### Candidate failures and judge disagreements",
        "",
        ...renderFailureDetails(iteration.trials)
      );
    }
  }
  if (report.heldOut) {
    lines.push(
      "## Final held-out acceptance",
      "",
      `Decision: **${report.heldOut.decision.accepted ? "accepted" : "rejected"}**`,
      "",
      `- Quality difference: ${report.heldOut.decision.comparison.qualityImprovementPoints.toFixed(2)} points`,
      `- Average score difference: ${report.heldOut.decision.comparison.scoreImprovementPoints.toFixed(2)} points`,
      "",
      "### Baseline held-out results",
      "",
      ...renderSummaryTable(report.heldOut.baselineTrials),
      "",
      "### Candidate held-out results",
      "",
      ...renderSummaryTable(report.heldOut.candidateTrials),
      ""
    );
  }
  if (report.failure) {
    lines.push("## Failure", "", report.failure, "");
  }
  lines.push(
    "## Output policy",
    "",
    `- Issue: \`${report.spec.output.issue}\``,
    `- Draft pull request: \`${report.spec.output.draftPullRequest}\``,
    "",
    "`accepted-candidate-only` means a draft pull request is created only when a candidate satisfies every configured acceptance rule.",
    ""
  );
  return `${lines.join("\n")}\n`;
}

export function renderIssueSummary(report: SkillImprovementReport): string {
  const lines = [
    `# Skill improvement run: ${report.spec.target.skill}`,
    "",
    `- Status: **${report.status}**`,
    `- Baseline: \`${report.baselineCommit}\``,
    `- Best development candidate: ${report.bestCandidateCommit ? `\`${report.bestCandidateCommit}\`` : "none"}`,
    `- Final acceptance: **${report.finalAccepted ? "passed" : "not passed"}**`,
    `- Answer models: ${report.spec.models.answers.map(model => `\`${model}\``).join(", ")}`,
    `- Judge models: ${report.spec.models.judges.map(model => `\`${model}\``).join(", ")}`,
    `- Answer generations: ${report.usage.answerGenerations}/${report.spec.limits.maxAnswerGenerations}`,
    `- Judge calls: ${report.usage.judgeCalls}/${report.spec.limits.maxJudgeCalls}`,
    `- Duration: ${report.usage.durationMinutes.toFixed(1)} minutes`,
    "",
    "## Baseline",
    "",
    `- Passed: ${report.baselineSummary.passed}/${report.baselineSummary.total}`,
    `- Pass rate: ${percent(report.baselineSummary.passRate)}`,
    `- Average score: ${percent(report.baselineSummary.averageScore)}`,
    `- Skill invocation: ${report.baselineSummary.targetSkillInvoked}/${report.baselineSummary.total}`,
    `- Judge disagreements: ${report.baselineSummary.judgeDisagreements}`,
    "",
    "## Iterations",
    "",
    "| Iteration | Decision | Quality difference | Score difference | Token difference | Reason |",
    "| ---: | --- | ---: | ---: | ---: | --- |",
  ];
  for (const iteration of report.iterations) {
    const decision = iteration.decision;
    lines.push(
      `| ${iteration.iteration} | ${decision ? (decision.accepted ? "Accepted" : "Rejected") : "Not evaluated"} | `
      + `${decision ? `${decision.comparison.qualityImprovementPoints.toFixed(2)} points` : "N/A"} | `
      + `${decision ? `${decision.comparison.scoreImprovementPoints.toFixed(2)} points` : "N/A"} | `
      + `${decision ? `${decision.comparison.tokenIncreasePercent.toFixed(2)}%` : "N/A"} | `
      + `${(iteration.validationErrors[0] ?? decision?.reasons[0] ?? "").slice(0, 500)} |`
    );
  }
  if (report.failure) {
    lines.push("", "## Failure", "", report.failure.slice(0, 4000), "");
  }
  lines.push(
    "",
    "The complete report, trajectories, judge evidence, agent output, and patches are attached to the workflow run.",
    ""
  );
  return `${lines.join("\n")}\n`;
}

export function writeReport(outputDirectory: string, report: SkillImprovementReport): void {
  fs.mkdirSync(outputDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(outputDirectory, "report.json"),
    JSON.stringify(report, null, 2),
    "utf8"
  );
  fs.writeFileSync(
    path.join(outputDirectory, "report.md"),
    renderReport(report),
    "utf8"
  );
  fs.writeFileSync(
    path.join(outputDirectory, "issue-summary.md"),
    renderIssueSummary(report),
    "utf8"
  );
  fs.writeFileSync(
    path.join(outputDirectory, "workflow-outputs.json"),
    JSON.stringify({
      accepted: report.finalAccepted,
      issueMode: report.spec.output.issue,
      draftPullRequestMode: report.spec.output.draftPullRequest,
      skill: report.spec.target.skill,
      baselineCommit: report.baselineCommit,
      candidateCommit: report.bestCandidateCommit ?? null,
      finalPatchPath: report.finalPatchPath ?? null,
    }, null, 2),
    "utf8"
  );
}
