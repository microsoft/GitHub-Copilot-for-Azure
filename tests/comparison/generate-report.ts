import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CompareRunOutput } from "./run-compare";

type TrialResult = {
  type?: string;
  itemId?: string;
  evalName?: string;
  stimulus?: string;
  model?: string;
  status?: string;
  gradeResult?: {
    passed?: boolean;
    score?: number;
  };
  trajectory?: {
    stimulus?: {
      tags?: {
        area?: string;
      };
    };
    metrics?: {
      tokenUsage?: {
        totalTokens?: number;
      };
      toolCallBreakdown?: Record<string, number>;
      skillActivationBreakdown?: Record<string, number>;
    };
  };
};

export type ConditionSummary = {
  branch: string;
  model: string;
  withSkill: boolean;
  withAzureMcp: boolean;
  runIds: string[];
  runUrls: string[];
  workflowConclusions: Array<string | null>;
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  averageScore: number;
  skillInvoked: number;
  skillInvocationRate: number;
  kustoToolCalls: number;
  totalTokens: number;
};

export type ComparisonReport = {
  generatedAt: string;
  skill: string;
  evalFiles?: string[];
  conditions: ConditionSummary[];
  byEval: Array<{
    branch: string;
    evalName: string;
    model: string;
    withSkill: boolean;
    withAzureMcp: boolean;
    total: number;
    passed: number;
    passRate: number;
    averageScore: number;
  }>;
  skillEffects: Array<{
    branch: string;
    model: string;
    withAzureMcp: boolean;
    withSkillPassRate: number;
    withoutSkillPassRate: number;
    difference: number;
  }>;
};

function extractRunId(runUrl: string): string {
  const runId = runUrl.split("/").pop();
  if (!runId) {
    throw new Error(`Could not extract run id from URL: ${runUrl}`);
  }
  return runId;
}

function conditionName(model: string, withSkill: boolean, withAzureMcp: boolean): string {
  return `${model}-${withSkill ? "with-skill" : "without-skill"}-${withAzureMcp ? "with-mcp" : "without-mcp"}`;
}

function readJsonlFiles(directory: string): TrialResult[] {
  if (!fs.existsSync(directory)) {
    throw new Error(`Artifact directory not found: ${directory}`);
  }

  const files = fs.readdirSync(directory)
    .filter(file => file.endsWith(".jsonl"))
    .map(file => path.join(directory, file));
  if (files.length === 0) {
    throw new Error(`No JSONL results found in ${directory}`);
  }

  const records = new Map<string, TrialResult>();
  for (const file of files) {
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      const record = JSON.parse(line) as TrialResult;
      if (record.type !== "trial-result" || record.trajectory?.stimulus?.tags?.area === "routing") {
        continue;
      }
      const key = record.itemId ?? `${record.evalName}:${record.stimulus}:${records.size}`;
      records.set(key, record);
    }
  }
  return [...records.values()];
}

function round(value: number, digits = 4): number {
  return Number(value.toFixed(digits));
}

function summarizeCondition(
  branch: string,
  model: string,
  withSkill: boolean,
  withAzureMcp: boolean,
  runUrls: string[],
  workflowConclusions: Array<string | null>,
  records: TrialResult[],
  skillName: string,
): ConditionSummary {
  const passed = records.filter(record => record.gradeResult?.passed === true).length;
  const scores = records
    .map(record => record.gradeResult?.score)
    .filter((score): score is number => typeof score === "number");
  const skillInvoked = records.filter(
    record => (record.trajectory?.metrics?.skillActivationBreakdown?.[skillName] ?? 0) > 0
  ).length;
  const kustoToolCalls = records.reduce((sum, record) => {
    const breakdown = record.trajectory?.metrics?.toolCallBreakdown ?? {};
    return sum + Object.entries(breakdown)
      .filter(([tool]) => tool.toLowerCase().includes("kusto"))
      .reduce((toolSum, [, count]) => toolSum + count, 0);
  }, 0);
  const totalTokens = records.reduce(
    (sum, record) => sum + (record.trajectory?.metrics?.tokenUsage?.totalTokens ?? 0),
    0
  );

  return {
    branch,
    model,
    withSkill,
    withAzureMcp,
    runIds: runUrls.map(extractRunId),
    runUrls,
    workflowConclusions,
    total: records.length,
    passed,
    failed: records.length - passed,
    passRate: records.length === 0 ? 0 : round(passed / records.length),
    averageScore: scores.length === 0
      ? 0
      : round(scores.reduce((sum, score) => sum + score, 0) / scores.length),
    skillInvoked,
    skillInvocationRate: records.length === 0 ? 0 : round(skillInvoked / records.length),
    kustoToolCalls,
    totalTokens,
  };
}

export function buildComparisonReport(
  manifest: CompareRunOutput,
  artifactRoot: string,
): ComparisonReport {
  const conditions: ConditionSummary[] = [];
  const conditionGroups = new Map<string, {
    runUrls: string[];
    workflowConclusions: Array<string | null>;
    records: TrialResult[];
  }>();
  const byEvalGroups = new Map<string, TrialResult[]>();

  for (const branchResult of manifest.results) {
    for (const run of branchResult.runs) {
      const withAzureMcp = run.withAzureMcp ?? true;
      const runId = extractRunId(run.run);
      const runDirectory = path.join(
        artifactRoot,
        branchResult.branch.replaceAll("/", "_"),
        "_run-results",
        conditionName(run.model, run.withSkill, withAzureMcp),
        runId
      );
      const records = readJsonlFiles(runDirectory);
      const conditionKey = JSON.stringify([
        branchResult.branch,
        run.model,
        run.withSkill,
        withAzureMcp,
      ]);
      const conditionGroup = conditionGroups.get(conditionKey) ?? {
        runUrls: [],
        workflowConclusions: [],
        records: [],
      };
      conditionGroup.runUrls.push(run.run);
      conditionGroup.workflowConclusions.push(run.conclusion ?? null);
      conditionGroup.records.push(...records);
      conditionGroups.set(conditionKey, conditionGroup);

      for (const record of records) {
        const evalName = record.evalName ?? "unknown";
        const key = JSON.stringify([
          branchResult.branch,
          evalName,
          run.model,
          run.withSkill,
          withAzureMcp,
        ]);
        const group = byEvalGroups.get(key) ?? [];
        group.push(record);
        byEvalGroups.set(key, group);
      }
    }
  }

  for (const [key, group] of conditionGroups) {
    const [branch, model, withSkill, withAzureMcp] = JSON.parse(key) as [
      string,
      string,
      boolean,
      boolean,
    ];
    conditions.push(summarizeCondition(
      branch,
      model,
      withSkill,
      withAzureMcp,
      group.runUrls,
      group.workflowConclusions,
      group.records,
      manifest.skill.name
    ));
  }

  const byEval = [...byEvalGroups.entries()].map(([key, records]) => {
    const [branch, evalName, model, withSkill, withAzureMcp] = JSON.parse(key) as [
      string,
      string,
      string,
      boolean,
      boolean,
    ];
    const passed = records.filter(record => record.gradeResult?.passed === true).length;
    const scores = records
      .map(record => record.gradeResult?.score)
      .filter((score): score is number => typeof score === "number");
    return {
      branch,
      evalName,
      model,
      withSkill,
      withAzureMcp,
      total: records.length,
      passed,
      passRate: records.length === 0 ? 0 : round(passed / records.length),
      averageScore: scores.length === 0
        ? 0
        : round(scores.reduce((sum, score) => sum + score, 0) / scores.length),
    };
  });

  const skillEffects: ComparisonReport["skillEffects"] = [];
  for (const withSkill of conditions.filter(condition => condition.withSkill)) {
    const withoutSkill = conditions.find(condition =>
      condition.branch === withSkill.branch
      && condition.model === withSkill.model
      && condition.withAzureMcp === withSkill.withAzureMcp
      && !condition.withSkill
    );
    if (withoutSkill) {
      skillEffects.push({
        branch: withSkill.branch,
        model: withSkill.model,
        withAzureMcp: withSkill.withAzureMcp,
        withSkillPassRate: withSkill.passRate,
        withoutSkillPassRate: withoutSkill.passRate,
        difference: round(withSkill.passRate - withoutSkill.passRate),
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    skill: manifest.skill.name,
    evalFiles: manifest.evalFiles,
    conditions,
    byEval,
    skillEffects,
  };
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function renderComparisonMarkdown(report: ComparisonReport): string {
  const lines = [
    `# ${report.skill} comparison report`,
    "",
    `Generated: ${report.generatedAt}`,
    "",
  ];
  if (report.evalFiles && report.evalFiles.length > 0) {
    lines.push(`Eval files: ${report.evalFiles.map(file => `\`${file}\``).join(", ")}`, "");
  }

  lines.push(
    "## Results by setup",
    "",
    "| Branch | Model | Skills | MCP | Workflow | Passed | Pass rate | Average score | Skill invoked | Kusto calls | Tokens |",
    "| --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  );
  for (const condition of report.conditions) {
    const conclusions = [...new Set(condition.workflowConclusions.map(value => value ?? "unknown"))].join(", ");
    lines.push(
      `| ${condition.branch} | ${condition.model} | ${condition.withSkill ? "Yes" : "No"} | ${condition.withAzureMcp ? "Yes" : "No"} | ${conclusions} | `
      + `${condition.passed}/${condition.total} | ${percent(condition.passRate)} | ${percent(condition.averageScore)} | `
      + `${condition.skillInvoked}/${condition.total} | ${condition.kustoToolCalls} | ${condition.totalTokens} |`
    );
  }

  lines.push(
    "",
    "## Skill effect",
    "",
    "| Branch | Model | MCP | With skill | Without skill | Difference |",
    "| --- | --- | --- | ---: | ---: | ---: |",
  );
  for (const effect of report.skillEffects) {
    const sign = effect.difference > 0 ? "+" : "";
    lines.push(
      `| ${effect.branch} | ${effect.model} | ${effect.withAzureMcp ? "Yes" : "No"} | ${percent(effect.withSkillPassRate)} | `
      + `${percent(effect.withoutSkillPassRate)} | ${sign}${(effect.difference * 100).toFixed(1)} points |`
    );
  }

  lines.push(
    "",
    "## Results by eval suite",
    "",
    "| Branch | Eval | Model | Skills | MCP | Passed | Pass rate | Average score |",
    "| --- | --- | --- | --- | --- | ---: | ---: | ---: |",
  );
  for (const item of report.byEval) {
    lines.push(
      `| ${item.branch} | ${item.evalName} | ${item.model} | ${item.withSkill ? "Yes" : "No"} | `
      + `${item.withAzureMcp ? "Yes" : "No"} | ${item.passed}/${item.total} | `
      + `${percent(item.passRate)} | ${percent(item.averageScore)} |`
    );
  }

  return `${lines.join("\n")}\n`;
}

export function writeComparisonReport(
  manifestPath: string,
  artifactRoot: string,
  outputDirectory: string,
): ComparisonReport {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as CompareRunOutput;
  const report = buildComparisonReport(manifest, artifactRoot);
  fs.mkdirSync(outputDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(outputDirectory, "summary.json"),
    JSON.stringify(report, null, 2),
    "utf8"
  );
  fs.writeFileSync(
    path.join(outputDirectory, "report.md"),
    renderComparisonMarkdown(report),
    "utf8"
  );
  return report;
}

function main(): void {
  const [, , manifestPath, artifactRoot, outputDirectory] = process.argv;
  if (!manifestPath || !artifactRoot || !outputDirectory) {
    throw new Error("Usage: npm run compare:report -- <run-manifest.json> <artifact-root> <output-directory>");
  }
  writeComparisonReport(manifestPath, artifactRoot, outputDirectory);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
