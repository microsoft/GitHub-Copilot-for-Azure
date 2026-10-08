import {
  cleanupManagedResources,
  kustoResourceId,
  prepareManagedResources,
  type ManagedResourceRuntime,
} from "../managed-resources.ts";
import type { SkillImprovementRunSpec } from "../config.ts";
import { describe, expect, test } from "vitest";

function spec(): SkillImprovementRunSpec {
  return {
    name: "managed-resource-test",
    target: {
      plugin: "azure-skills",
      skill: "azure-kusto",
      baselineRef: "main",
    },
    evaluations: {
      root: "tests/skill-improvement/evals/azure-kusto",
      development: ["quality.eval.yaml"],
    },
    models: {
      answers: ["answer"],
      judges: ["judge"],
    },
    experiment: {
      repetitions: 1,
      conditions: [
        { name: "Skill + MCP", skill: "enabled", mcp: "enabled" },
      ],
    },
    improvementAgent: {
      enabled: false,
      model: "agent",
    },
    acceptance: {
      minimumQualityImprovementPoints: 0,
      maximumEvalRegressionPoints: 0,
      maximumModelRegressionPoints: 0,
    },
    refinement: {
      minimumScoreImprovementPoints: 0,
      maximumQualityRegressionPoints: 0,
    },
    resources: {
      kusto: {
        subscriptionId: "subscription",
        resourceGroup: "resource-group",
        clusterName: "cluster",
        databaseName: "database",
        startBeforeRun: true,
        stopAfterRun: true,
        startupTimeoutMinutes: 20,
      },
    },
    limits: {
      maxIterations: 0,
      maxAnswerGenerations: 1,
      maxJudgeCalls: 1,
      maxDurationMinutes: 1,
      maxConcurrentJobs: 1,
      maxSkillTokenIncreasePercent: 0,
    },
    output: {
      issue: "never",
      draftPullRequest: "never",
    },
  };
}

describe("managed evaluation resources", () => {
  test("builds the scoped Kusto cluster resource ID", () => {
    expect(kustoResourceId({
      subscriptionId: "subscription",
      resourceGroup: "resource-group",
      clusterName: "cluster",
      databaseName: "database",
      startBeforeRun: true,
      stopAfterRun: true,
      startupTimeoutMinutes: 20,
    })).toBe(
      "/subscriptions/subscription/resourceGroups/resource-group/"
      + "providers/Microsoft.Kusto/clusters/cluster"
    );
  });

  test("starts a stopped cluster and verifies the database health endpoint", async () => {
    const calls: string[][] = [];
    let clusterReads = 0;
    const runtime: ManagedResourceRuntime = {
      runProcess: async (_command, args) => {
        calls.push(args);
        if (args[0] === "resource") {
          clusterReads += 1;
          const properties = clusterReads === 1
            ? { state: "Stopped", provisioningState: "Succeeded" }
            : {
              state: "Running",
              provisioningState: "Succeeded",
              uri: "https://cluster.kusto.windows.net",
            };
          return {
            exitCode: 0,
            stdout: JSON.stringify({
              properties,
            }),
            stderr: "",
          };
        }
        if (args[0] === "account") {
          return { exitCode: 0, stdout: "token\n", stderr: "" };
        }
        return { exitCode: 0, stdout: "", stderr: "" };
      },
      fetch: async (input, init) => {
        expect(input).toBe("https://cluster.kusto.windows.net/v1/rest/query");
        expect(init?.body).toBe(JSON.stringify({
          db: "database",
          csl: "print Health=1",
        }));
        return new Response("{}", { status: 200 });
      },
      sleep: async () => {},
      now: () => 0,
    };

    await prepareManagedResources(spec(), process.cwd(), runtime);

    expect(calls.some(args =>
      args[0] === "rest"
      && args.some(arg => arg.includes("/start?api-version=2024-04-13"))
    )).toBe(true);
  });

  test("stops a running cluster", async () => {
    const calls: string[][] = [];
    const runtime: ManagedResourceRuntime = {
      runProcess: async (_command, args) => {
        calls.push(args);
        const stdout = args[0] === "resource"
          ? JSON.stringify({
            properties: {
              state: "Running",
              provisioningState: "Succeeded",
            },
          })
          : "";
        return {
          exitCode: 0,
          stdout,
          stderr: "",
        };
      },
      fetch,
      sleep: async () => {},
      now: Date.now,
    };

    await cleanupManagedResources(spec(), process.cwd(), runtime);

    expect(calls.some(args =>
      args[0] === "rest"
      && args.some(arg => arg.includes("/stop?api-version=2024-04-13"))
    )).toBe(true);
  });
});
