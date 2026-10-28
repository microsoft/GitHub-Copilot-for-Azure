import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createBudget, runAz, type FixtureManifest } from "../fixture-common.ts";
import { provision } from "../provision-fixture.ts";

const { execFileSync } = vi.hoisted(() => ({
  execFileSync: vi.fn<(command: string, args: string[], options: { timeout?: number }) => string>(),
}));

vi.mock("node:child_process", () => ({ execFileSync }));
vi.mock("../resource-lock.ts", () => ({
  ResourceLock: class {
    async initialize(): Promise<void> {}
    async acquire() {
      return {
        assertHealthy() {},
        read: async () => ({ state: "Empty" }),
        write: async () => {},
        renew: async () => {},
        release: async () => {},
      };
    }
  },
}));

const manifestPath = resolve("/fixtures/budget/manifest.json");
const manifest: FixtureManifest = {
  id: "budget-fixture",
  type: "readOnly",
  persistence: "temporary",
  version: 1,
  schemaVersion: 1,
  description: "Budget isolation fixture",
  bicepConfigs: ["first", "second"].map((name) => ({
    fixtureId: name,
    path: `./${name}.bicep`,
    location: "westus2",
    resourceGroupNameBase: name,
  })),
  postProvisionScript: { path: "./post.ts" },
};
const start = Date.parse("2026-01-01T00:00:00Z");
const provisioningBudgetMs = 10 * 60 * 1000;

function commandOutput(command: string, args: string[]): string {
  if (command === "npx" || command === "npx.cmd") {
    return "";
  }
  if (args[0] === "account") {
    return JSON.stringify({ id: "subscription-1", tenantId: "tenant-1" });
  }
  if (args[0] === "ad") {
    return "principal-1";
  }
  if (args[0] === "group") {
    if (args[1] === "list") {
      return "[]";
    }
    if (args[1] === "show") {
      return "01/02/2026 00:00:00";
    }
    if (args[1] === "create" || args[1] === "update") {
      return "";
    }
  }
  if (args.slice(0, 3).join(" ") === "deployment group create") {
    return "";
  }
  throw new Error(`Unexpected command: ${command} ${args.join(" ")}`);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(start);
  vi.stubEnv("AZURE_FIXTURE_COORDINATION_STORAGE_ACCOUNT", "storage");
  vi.stubEnv("AZURE_FIXTURE_COORDINATION_CONTAINER", "fixtures");
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  execFileSync.mockReset();
  execFileSync.mockImplementation(commandOutput);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("per-invocation provisioning budgets", () => {
  it.each([5, 10])("does not reset a pending run's budget when another starts %i minutes later", async (minutes) => {
    let deployed: () => void = () => {};
    const firstDeployment = new Promise<void>((resolvePromise) => {
      deployed = resolvePromise;
    });
    execFileSync.mockImplementation((command, args) => {
      if (args.slice(0, 3).join(" ") === "deployment group create") {
        deployed();
      }
      return commandOutput(command, args);
    });

    const pending = provision(manifestPath, manifest);
    await firstDeployment;
    vi.setSystemTime(start + minutes * 60 * 1000);
    const otherManifest: FixtureManifest = {
      ...manifest,
      id: "other-fixture",
      persistence: "never",
      bicepConfigs: [{ ...manifest.bicepConfigs[0], resourceGroupNameBase: "other" }],
    };
    await provision(manifestPath, otherManifest);

    if (minutes === 10) {
      await expect(pending).rejects.toThrow("Time budget was exhausted before az group create");
    } else {
      await expect(pending).resolves.toBeDefined();
      const secondCreate = execFileSync.mock.calls.find(([, args]) =>
        args[0] === "group" && args[1] === "create" && args.some((arg) => arg.startsWith("second-")));
      expect(secondCreate?.[2].timeout).toBe(5 * 60 * 1000);
      const scripts = execFileSync.mock.calls.filter(([command]) => command === "npx" || command === "npx.cmd");
      expect(scripts.map(([, , options]) => options.timeout)).toEqual([
        provisioningBudgetMs,
        5 * 60 * 1000,
      ]);
    }
  });

  it("does not leak a completed run's budget into later invocations or standalone commands", async () => {
    await provision(manifestPath, { ...manifest, persistence: "never" });
    vi.setSystemTime(start + provisioningBudgetMs);
    await provision(manifestPath, { ...manifest, persistence: "never" });

    runAz(["account", "show", "-o", "json"]);
    expect(execFileSync.mock.lastCall?.[2].timeout).toBeUndefined();
  });

  it("allows explicitly unbudgeted commands even after their supplied budget is exhausted", () => {
    const budget = createBudget();
    budget.set(1);
    vi.setSystemTime(start + 1);

    expect(() => runAz(["account", "show"], { budget })).toThrow("Time budget was exhausted before az");
    expect(execFileSync).not.toHaveBeenCalled();

    runAz(["account", "show"], { budget, subjectToBudget: false });
    expect(execFileSync.mock.lastCall?.[2].timeout).toBeUndefined();
  });
});
