import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildComparisonReport, renderComparisonMarkdown } from "../generate-report";
import type { CompareRunOutput } from "../run-compare";

function writeResult(
  root: string,
  branch: string,
  condition: string,
  runId: string,
  records: object[],
): void {
  const directory = path.join(root, branch, "_run-results", condition, runId);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(
    path.join(directory, "results.jsonl"),
    records.map(record => JSON.stringify(record)).join("\n"),
    "utf8"
  );
}

function trial(itemId: string, passed: boolean, score: number, invoked: boolean): object {
  return {
    type: "trial-result",
    itemId,
    evalName: "azure-kusto-access-connectivity",
    stimulus: itemId,
    gradeResult: { passed, score },
    trajectory: {
      stimulus: { tags: { area: "response-quality" } },
      metrics: {
        tokenUsage: { totalTokens: 100 },
        toolCallBreakdown: { mcp_kusto_query: 1 },
        skillActivationBreakdown: invoked ? { "azure-kusto": 1 } : {},
      },
    },
  };
}

describe("comparison report", () => {
  test("aggregates repeated runs and computes skill effect", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "comparison-report-"));
    const branch = "feature";
    const manifest: CompareRunOutput = {
      skill: { pluginDirname: "azure-skills", name: "azure-kusto" },
      evalFiles: ["access-connectivity.eval.yaml"],
      date: "2026-09-08",
      results: [{
        branch,
        runs: [
          { model: "model-a", withSkill: true, withAzureMcp: true, run: "https://example/runs/1", conclusion: "success" },
          { model: "model-a", withSkill: true, withAzureMcp: true, run: "https://example/runs/2", conclusion: "failure" },
          { model: "model-a", withSkill: false, withAzureMcp: true, run: "https://example/runs/3", conclusion: "success" },
        ],
      }],
    };

    writeResult(root, branch, "model-a-with-skill-with-mcp", "1", [trial("a", true, 1, true)]);
    writeResult(root, branch, "model-a-with-skill-with-mcp", "2", [trial("b", false, 0.5, true)]);
    writeResult(root, branch, "model-a-without-skill-with-mcp", "3", [trial("c", false, 0.25, false)]);

    const report = buildComparisonReport(manifest, root);

    expect(report.conditions).toHaveLength(2);
    expect(report.conditions.find(condition => condition.withSkill)).toMatchObject({
      total: 2,
      passed: 1,
      passRate: 0.5,
      averageScore: 0.75,
      skillInvoked: 2,
      kustoToolCalls: 2,
      totalTokens: 200,
      workflowConclusions: ["success", "failure"],
    });
    expect(report.skillEffects[0]).toMatchObject({
      withSkillPassRate: 0.5,
      withoutSkillPassRate: 0,
      difference: 0.5,
    });
    expect(report.byEval[0].branch).toBe("feature");
    expect(renderComparisonMarkdown(report)).toContain("| feature | model-a | Yes | Yes | success, failure | 1/2 | 50.0%");
  });
});
