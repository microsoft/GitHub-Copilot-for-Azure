import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { parse } from "yaml";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));

function read(relativePath: string): string {
  return fs.readFileSync(`${repositoryRoot}/${relativePath}`, "utf8");
}

describe("Azure Diagnostics live AKS evaluations", () => {
  test("remain manual and clean up the ephemeral resource group", () => {
    const workflow = parse(read(
      ".github/workflows/test-azure-diagnostics-live.yml",
    )) as {
      on?: Record<string, unknown>;
      jobs?: Record<string, { steps?: Array<Record<string, unknown>> }>;
    };

    expect(workflow.on).toHaveProperty("workflow_dispatch");
    expect(workflow.on).not.toHaveProperty("schedule");

    const steps = workflow.jobs?.["live-aks"]?.steps ?? [];
    const deployStep = steps.find(step =>
      step.name === "Deploy ephemeral AKS cluster from Bicep"
    );
    const cleanupStep = steps.find(step =>
      step.name === "Delete ephemeral resource group"
    );

    expect(String(deployStep?.run)).toContain("live/infra/main.bicep");
    expect(cleanupStep?.if).toBe("always()");
    expect(String(cleanupStep?.run)).toContain("az group delete");
    expect(String(cleanupStep?.run)).not.toContain("--no-wait");
  });

  test("defines the three isolated live diagnosis scenarios", () => {
    const evaluation = parse(read(
      "evals/azure-skills/azure-diagnostics/live/eval.yaml",
    )) as {
      stimuli?: Array<{ tags?: { liveScenario?: string; cost?: string } }>;
    };

    const scenarios = evaluation.stimuli?.map(
      stimulus => stimulus.tags?.liveScenario,
    );

    expect(scenarios).toEqual([
      "coredns-scheduling",
      "missing-service-endpoints",
      "dns-network-policy",
    ]);
    expect(evaluation.stimuli?.every(
      stimulus => stimulus.tags?.cost === "azure",
    )).toBe(true);
  });

  test("ships setup and cleanup handling for every scenario", () => {
    const script = read(
      "evals/azure-skills/azure-diagnostics/live/manage-scenario.sh",
    );

    expect(script).toContain(
      "Exit codes: 0 = success, 1 = scenario setup/cleanup failure,",
    );
    for (const scenario of [
      "coredns-scheduling",
      "missing-service-endpoints",
      "dns-network-policy",
    ]) {
      expect(script).toContain(scenario);
    }
    expect(script).toContain('"${action}_coredns_scheduling"');
    expect(script).toContain('"${action}_missing_service_endpoints"');
    expect(script).toContain('"${action}_dns_network_policy"');
  });
});
