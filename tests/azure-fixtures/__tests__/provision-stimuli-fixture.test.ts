import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { findFixtureResourceGroups, runAz, type FixtureManifest } from "../fixture-common.ts";
import { provision } from "../provision-fixture.ts";

vi.mock("../fixture-common.ts", async (importOriginal) => ({
  ...await importOriginal<typeof import("../fixture-common.ts")>(),
  runAz: vi.fn(),
  findFixtureResourceGroups: vi.fn(),
}));

const manifestPath = resolve("/fixtures/stimuli/manifest.json");
const manifest: FixtureManifest = {
  id: "stimuli-fixture",
  type: "readOnly",
  version: 1,
  schemaVersion: 1,
  description: "Unit-test fixture",
  bicepConfigs: [
    {
      fixtureId: "storage-fixture",
      path: "./storage.bicep",
      location: "westus2",
      resourceGroupNameBase: "storage",
    },
    {
      fixtureId: "empty-fixture",
      location: "eastus",
      resourceGroupNameBase: "empty",
    },
  ],
};

beforeEach(() => {
  vi.mocked(runAz).mockReset();
  vi.mocked(runAz).mockImplementation((args) => {
    if (args[0] === "account") {
      return JSON.stringify({ id: "subscription-1", tenantId: "tenant-1" });
    }
    if (args[0] === "ad") {
      return "principal-object-1";
    }
    return "";
  });
  vi.mocked(findFixtureResourceGroups).mockReset();
  vi.mocked(findFixtureResourceGroups).mockReturnValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("stimuli fixture instance tags", () => {
  it("uses one DeleteAfter tag for all groups even as time advances", async () => {
    let now = Date.parse("2026-01-01T00:00:00Z");
    vi.spyOn(Date, "now").mockImplementation(() => {
      now += 1_000;
      return now;
    });

    await provision(manifestPath, manifest);

    const creates = vi.mocked(runAz).mock.calls
      .map(([args]) => args)
      .filter((args) => args[0] === "group" && args[1] === "create");
    const retentionTags = creates.map((args) => args.filter((arg) => arg.includes("DeleteAfter=")));
    expect(retentionTags).toHaveLength(2);
    expect(retentionTags[0]).toHaveLength(1);
    expect(retentionTags[1]).toEqual(retentionTags[0]);
  });

  it.each(["never", "permanent"] as const)("tags every new group with a per-run UUID (persistence=%s)", async (persistence) => {
    const first = await provision(manifestPath, { ...manifest, persistence });
    const second = await provision(manifestPath, { ...manifest, persistence });
    const creates = vi.mocked(runAz).mock.calls
      .map(([args]) => args)
      .filter((args) => args[0] === "group" && args[1] === "create");

    expect(creates).toHaveLength(manifest.bicepConfigs.length * 2);
    const midpoint = creates.length / 2;
    const createsByRun = [
      creates.slice(0, midpoint),
      creates.slice(midpoint),
    ];
    expect(first.context.runId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(second.context.runId).not.toBe(first.context.runId);
    for (const [index, result] of [first, second].entries()) {
      for (const args of createsByRun[index]) {
        expect(args.filter((arg) => arg.startsWith("FixtureInstanceId="))).toEqual([
          `FixtureInstanceId=${result.context.runId}`,
        ]);
        expect(args).toContain(persistence === "permanent" ? "DoNotDelete=True" : "Completed=False");
      }
    }
  });

  it("does not overwrite instance tags when reusing persistent groups", async () => {
    vi.mocked(findFixtureResourceGroups).mockImplementation((fixtureId) => [{
      name: `${fixtureId}-existing`,
      tags: {
        FixtureVersion: String(manifest.version),
        FixtureInstanceId: "original-instance",
        Completed: "True",
      },
    }]);

    const result = await provision(manifestPath, { ...manifest, persistence: "permanent" });

    expect(Object.values(result.context.resourceGroupNames)).toEqual([
      "storage-fixture-existing",
      "empty-fixture-existing",
    ]);
    expect(vi.mocked(runAz).mock.calls.some(([args]) => args[0] === "group")).toBe(false);
  });
});
