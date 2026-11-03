import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { ProvisionScriptOutput, FixtureManifest } from "../fixture-common.ts";
import {
  provisionWithDependencies,
} from "../provision-fixture.ts";
import { FakeAzureEnvironment } from "./support/fake-azure.ts";

const manifestPath = resolve("/fixtures/workflow/manifest.json");
const manifest: FixtureManifest = {
  id: "workflow-fixture",
  type: "readOnly",
  persistence: "temporary",
  version: 7,
  schemaVersion: 1,
  description: "Unit-test fixture",
  bicepConfigs: [
    {
      fixtureId: "storage-fixture",
      path: "./storage.bicep",
      location: "westus2",
      resourceGroupNameBase: "storage",
      parameters: [{ key: "testPrincipalId" }],
    },
    {
      fixtureId: "search-fixture",
      path: "./search.bicep",
      location: "eastus",
      resourceGroupNameBase: "search",
      parameters: [{ key: "sku", value: "basic" }],
    },
  ],
  postProvisionScript: { path: "./post.ts" },
};

const environments: FakeAzureEnvironment[] = [];

function environment(): FakeAzureEnvironment {
  const fake = new FakeAzureEnvironment();
  environments.push(fake);
  return fake;
}

function output(value: { output: string }): ProvisionScriptOutput {
  return JSON.parse(value.output) as ProvisionScriptOutput;
}

function azCommands(fake: FakeAzureEnvironment): string[][] {
  return fake.journal
    .filter((entry): entry is typeof entry & { args: string[] } => entry.operation === "az" && entry.args !== undefined)
    .map((entry) => entry.args);
}

function writes(fake: FakeAzureEnvironment): Record<string, unknown>[] {
  return fake.journal
    .filter((entry) => entry.operation === "write")
    .map((entry) => entry.value as Record<string, unknown>);
}

afterEach(() => {
  for (const fake of environments.splice(0)) {
    fake.expectConsistent();
  }
});

describe("fixture persistence policies", () => {
  it.each([undefined, "never"] as const)("always provisions fresh ad hoc fixtures (persistence=%s)", async (persistence) => {
    const fake = environment();
    fake.seedCompleteInstance(manifest, "existing");
    const adHocManifest = { ...manifest, persistence };
    const dependencies = fake.createDependencies("adhoc");
    dependencies.environment = {};

    const first = await provisionWithDependencies(manifestPath, adHocManifest, dependencies);
    const second = await provisionWithDependencies(manifestPath, adHocManifest, dependencies);

    expect(first.context.runId).not.toBe(second.context.runId);
    expect(fake.deploymentCount).toBe(4);
    expect(azCommands(fake).some((args) => args[0] === "group" && args[1] === "list")).toBe(false);
    expect(fake.coordination).toBeUndefined();
    expect(fake.postProvisionRuns).toHaveLength(2);
    for (const name of [...output(first).resourceGroups, ...output(second).resourceGroups]) {
      expect(fake.groups.get(name)?.tags).toMatchObject({
        DeleteAfter: "01/01/2026 03:00:00",
        Completed: "True",
      });
      expect(fake.groups.get(name)?.tags).not.toHaveProperty("DoNotDelete");
    }
    expect(output(first)).toEqual({ resourceGroups: Object.values(first.context.resourceGroupNames) });
  });

  it("provisions permanent fixtures with DoNotDelete and reuses them without coordination", async () => {
    const fake = environment();
    const permanentManifest = { ...manifest, persistence: "permanent" } as const;
    const dependencies = fake.createDependencies("permanent");
    dependencies.environment = {};

    const first = await provisionWithDependencies(manifestPath, permanentManifest, dependencies);
    const second = await provisionWithDependencies(manifestPath, permanentManifest, dependencies);

    expect(output(second)).toEqual(output(first));
    expect(fake.deploymentCount).toBe(2);
    expect(fake.coordination).toBeUndefined();
    expect(fake.postProvisionRuns).toHaveLength(2);
    for (const name of output(first).resourceGroups) {
      expect(fake.groups.get(name)?.tags).toMatchObject({
        DoNotDelete: "True",
        Completed: "True",
        FixtureInstanceId: first.context.runId,
      });
      expect(fake.groups.get(name)?.tags).not.toHaveProperty("DeleteAfter");
    }
  });

  it.each(["incomplete", "partial", "duplicate"] as const)("rejects %s permanent fixtures instead of provisioning", async (state) => {
    const fake = environment();
    fake.seedCompleteInstance(manifest, "existing");
    const firstGroup = [...fake.groups.values()][0];
    if (state === "incomplete") {
      firstGroup.tags.Completed = "False";
    } else if (state === "partial") {
      fake.groups.delete(firstGroup.name);
    } else {
      fake.seedCompleteInstance(manifest, "duplicate");
    }

    await expect(provisionWithDependencies(
      manifestPath,
      { ...manifest, persistence: "permanent" },
      fake.createDependencies("reader"),
    )).rejects.toThrow(state === "duplicate" ? /multiple provisioned/ : /partially provisioned/);

    expect(fake.deploymentCount).toBe(0);
    expect(fake.coordination).toBeUndefined();
  });

  it("ignores older permanent fixture versions", async () => {
    const fake = environment();
    fake.seedCompleteInstance({ ...manifest, version: manifest.version - 1 }, "old");

    const result = await provisionWithDependencies(
      manifestPath,
      { ...manifest, persistence: "permanent" },
      fake.createDependencies("new"),
    );

    expect(fake.deploymentCount).toBe(2);
    expect(output(result).resourceGroups.every((name) => !name.endsWith("-old"))).toBe(true);
  });

  it("keeps temporary fixtures for a fixed 24 hours", async () => {
    const fake = environment();
    const dependencies = fake.createDependencies("temporary");
    dependencies.readyRetentionMs = 24 * 60 * 60 * 1000;

    const first = await provisionWithDependencies(manifestPath, manifest, dependencies);
    for (const name of output(first).resourceGroups) {
      expect(fake.groups.get(name)?.tags.DeleteAfter).toBe("01/02/2026 00:00:00");
      expect(fake.groups.get(name)?.tags).not.toHaveProperty("DoNotDelete");
    }
    expect(writes(fake).at(-1)?.expiresAt).toBe("2026-01-01T23:00:00.000Z");

    fake.advance(60 * 60 * 1000);
    const second = await provisionWithDependencies(manifestPath, manifest, dependencies);

    expect(output(second)).toEqual(output(first));
    expect(fake.deploymentCount).toBe(2);
    expect(fake.postProvisionRuns).toHaveLength(1);
    for (const name of output(second).resourceGroups) {
      expect(fake.groups.get(name)?.tags.DeleteAfter).toBe("01/02/2026 00:00:00");
    }
    expect(writes(fake).at(-1)?.expiresAt).toBe("2026-01-01T23:00:00.000Z");
  });
});

describe("temporary fixture cold start", () => {
  it("provisions every component in order and publishes one complete Ready instance", async () => {
    const fake = environment();
    const result = await provisionWithDependencies(
      manifestPath,
      manifest,
      fake.createDependencies("winner", { GITHUB_RUN_ID: "42", GITHUB_RUN_ATTEMPT: "3" }),
    );
    const parsed = output(result);
    const commands = azCommands(fake);
    const deployments = commands.filter((args) => args.slice(0, 3).join(" ") === "deployment group create");

    expect(deployments).toHaveLength(2);
    expect(deployments.map((args) => args[args.indexOf("--template-file") + 1])).toEqual([
      resolve("/fixtures/workflow/storage.bicep"),
      resolve("/fixtures/workflow/search.bicep"),
    ]);
    expect(fake.postProvisionRuns).toEqual([{
      actor: "winner",
      groups: parsed.resourceGroups,
    }]);
    expect(parsed).toMatchObject({
      fixtureId: manifest.id,
      fixtureVersion: manifest.version,
      fixtureInstanceId: result.context.runId,
    });
    expect(Object.keys(parsed.resourceGroupIdsByComponent ?? {})).toEqual(["storage", "search"]);
    expect(writes(fake).map((record) => record.state)).toEqual(["Preparing", "Ready"]);
    expect(writes(fake).at(-1)).toMatchObject({ ownerWorkflowRunId: "42:3" });
    const creates = commands.filter((args) => args[0] === "group" && args[1] === "create");
    expect(creates).toHaveLength(2);
    for (const args of creates) {
      expect(args.filter((arg) => arg.startsWith("FixtureInstanceId="))).toEqual([
        `FixtureInstanceId=${result.context.runId}`,
      ]);
    }
    for (const name of parsed.resourceGroups) {
      expect(fake.groups.get(name)?.tags).toMatchObject({
        ManifestId: manifest.id,
        FixtureInstanceId: result.context.runId,
        Completed: "True",
      });
    }
  });

  it("keeps component names, locations, parameters, and IDs associated", async () => {
    const fake = environment();
    const result = await provisionWithDependencies(
      manifestPath,
      manifest,
      fake.createDependencies("components"),
    );
    const parsed = output(result);
    const commands = azCommands(fake);
    const creates = commands.filter((args) => args.slice(0, 2).join(" ") === "group create");
    const deployments = commands.filter((args) => args.slice(0, 3).join(" ") === "deployment group create");

    expect(creates.map((args) => args[args.indexOf("--location") + 1])).toEqual(["westus2", "eastus"]);
    expect(deployments[0]).toContain("testPrincipalId=principal-object-1");
    expect(deployments[0]).toContain("location=westus2");
    expect(deployments[1]).toContain("sku=basic");
    expect(deployments[1]).toContain("location=eastus");
    expect(parsed.resourceGroupIdsByComponent?.storage).toContain(`/resourceGroups/${result.context.resourceGroupNames.storage}`);
    expect(parsed.resourceGroupIdsByComponent?.search).toContain(`/resourceGroups/${result.context.resourceGroupNames.search}`);
  });

  it.each([
    [{}, /^local:1234:/],
    [{ GITHUB_RUN_ID: "900", GITHUB_RUN_ATTEMPT: "4" }, /^900:4$/],
  ])("records the expected workflow owner for %j", async (variables, ownerPattern) => {
    const fake = environment();
    await provisionWithDependencies(
      manifestPath,
      manifest,
      fake.createDependencies("owner", variables),
    );
    expect(writes(fake).at(-1)?.ownerWorkflowRunId).toMatch(ownerPattern);
  });
});

describe("reuse and discovery", () => {
  it("reuses a Ready fixture without deploying or mutating resource groups", async () => {
    const fake = environment();
    const first = await provisionWithDependencies(
      manifestPath,
      manifest,
      fake.createDependencies("first"),
    );
    const deployments = fake.deploymentCount;
    const mutationCount = mutations(fake).length;

    const second = await provisionWithDependencies(
      manifestPath,
      manifest,
      fake.createDependencies("second"),
    );

    expect(output(second).fixtureInstanceId).toBe(output(first).fixtureInstanceId);
    expect(fake.deploymentCount).toBe(deployments);
    expect(mutations(fake)).toHaveLength(mutationCount);
    expect(fake.postProvisionRuns).toHaveLength(1);
    expect(writes(fake).at(-1)?.state).toBe("Ready");
  });

  it("preserves a later group expiration without issuing an update", async () => {
    const fake = environment();
    fake.seedCompleteInstance(manifest, "existing");
    for (const group of fake.groups.values()) {
      group.tags.DeleteAfter = "01/01/2030 00:00:00";
    }
    fake.coordination = {
      state: "Ready",
      manifestId: manifest.id,
      manifestVersion: manifest.version,
      instanceId: "existing",
      resourceGroups: Object.fromEntries([...fake.groups.values()].map((group) => [
        group.tags.FixtureComponent,
        `/subscriptions/subscription-1/resourceGroups/${group.name}`,
      ])),
    };

    await provisionWithDependencies(
      manifestPath,
      manifest,
      fake.createDependencies("reuse"),
    );

    expect(mutations(fake)).toHaveLength(0);
  });

  it("discovers and publishes an existing complete instance from Empty", async () => {
    const fake = environment();
    fake.seedCompleteInstance(manifest, "discovered");

    const result = await provisionWithDependencies(
      manifestPath,
      manifest,
      fake.createDependencies("discoverer"),
    );

    expect(output(result).fixtureInstanceId).toBe("discovered");
    expect(fake.deploymentCount).toBe(0);
    expect(fake.postProvisionRuns).toHaveLength(0);
    expect(azCommands(fake).filter((args) => args[1] === "update" && args.includes("tags.Completed=True"))).toHaveLength(0);
    expect(writes(fake)).toHaveLength(1);
    expect(writes(fake)[0]).toMatchObject({ state: "Ready", instanceId: "discovered" });
  });

  it("prefers the recorded complete duplicate and does not delete complete groups", async () => {
    const fake = environment();
    fake.seedCompleteInstance(manifest, "a");
    fake.seedCompleteInstance(manifest, "b");
    fake.coordination = {
      state: "Preparing",
      manifestId: manifest.id,
      manifestVersion: manifest.version,
      instanceId: "b",
      resourceGroups: {},
    };

    const result = await provisionWithDependencies(
      manifestPath,
      manifest,
      fake.createDependencies("duplicate"),
    );

    expect(output(result).fixtureInstanceId).toBe("b");
    expect(fake.logs.some((entry) => entry.level === "warn" && entry.message.includes("duplicate complete"))).toBe(true);
    expect(azCommands(fake).some((args) => args[0] === "group" && args[1] === "delete")).toBe(false);
  });
});

describe("deterministic contenders", () => {
  it.each([2, 10, 100])(
    "lets one of %i simultaneous actors provision and all actors return one instance",
    async (actorCount) => {
      const fake = environment();
      const results = await Promise.all(
        Array.from({ length: actorCount }, (_, index) =>
          provisionWithDependencies(
            manifestPath,
            manifest,
            fake.createDependencies(`actor-${index}`),
          )),
      );

      expect(new Set(results.map((result) => output(result).fixtureInstanceId)).size).toBe(1);
      expect(fake.deploymentCount).toBe(manifest.bicepConfigs.length);
      expect(writes(fake).filter((record) => record.state === "Preparing")).toHaveLength(1);
      expect(fake.maximumActiveLeases).toBe(1);
      expect(fake.journal.filter((entry) => entry.operation === "acquire-contended").length).toBeGreaterThan(0);
    },
  );

  it("fails a follower whose acquisition budget expires without ARM mutations", async () => {
    const fake = environment();
    const holderDependencies = fake.createDependencies("holder");
    const lock = holderDependencies.createResourceLock("storage", "fixtures", "blob", fake.nowMs + 1_000);
    await lock.initialize({ state: "Empty" });
    const lease = await lock.acquire();
    const followerDependencies = fake.createDependencies("follower");
    followerDependencies.leaseAcquisitionBudgetMs = 0;

    await expect(provisionWithDependencies(
      manifestPath,
      manifest,
      followerDependencies,
    )).rejects.toThrow("Timed out acquiring resource lock");
    expect(azCommands(fake).filter((args) => ["create", "update", "delete"].includes(args[1]))).toHaveLength(0);
    await lease.release();
  });
});

describe("failure boundaries", () => {
  it("fails missing coordination configuration before Azure activity", async () => {
    const fake = environment();
    const dependencies = fake.createDependencies("missing");
    dependencies.environment = {};

    await expect(provisionWithDependencies(
      manifestPath,
      manifest,
      dependencies,
    )).rejects.toThrow("AZURE_FIXTURE_COORDINATION_STORAGE_ACCOUNT");
    expect(fake.journal).toHaveLength(0);
  });

  it.each([
    ["account show -o", "account lookup failed"],
    ["initialize", "blob initialization failed"],
    ["acquire", "lease acquisition failed"],
    ["group list --tag", "discovery failed"],
  ])("surfaces %s failure before any ARM mutation", async (operation, message) => {
    const fake = environment();
    fake.fail({ operation, error: new Error(message) });

    await expect(provisionWithDependencies(
      manifestPath,
      manifest,
      fake.createDependencies("failure"),
    )).rejects.toThrow(message);
    expect(azCommands(fake).filter((args) => ["create", "update", "delete"].includes(args[1]))).toHaveLength(0);
  });

  it.each([
    [null, "malformed"],
    [{ state: "Unknown" }, "unsupported state"],
    [{ state: "Ready", manifestId: "other", manifestVersion: 7 }, "identity does not match"],
  ])("rejects invalid coordination record %j", async (record, diagnostic) => {
    const fake = environment();
    fake.coordination = record;

    await expect(provisionWithDependencies(
      manifestPath,
      manifest,
      fake.createDependencies("record"),
    )).rejects.toThrow(diagnostic);
    expect(fake.deploymentCount).toBe(0);
  });

  it("rejects a Ready record that references a missing group with manual-repair guidance", async () => {
    const fake = environment();
    fake.coordination = {
      state: "Ready",
      manifestId: manifest.id,
      manifestVersion: manifest.version,
      instanceId: "gone",
      resourceGroups: {
        storage: "/subscriptions/subscription-1/resourceGroups/missing",
        search: "/subscriptions/subscription-1/resourceGroups/also-missing",
      },
    };

    await expect(provisionWithDependencies(
      manifestPath,
      manifest,
      fake.createDependencies("repair"),
    )).rejects.toThrow("manual repair is required");
  });

  it.each([
    ["group create --name", "create failed"],
    ["deployment group create", "deployment failed"],
    ["post-provision", "post failed"],
    ["group update --name", "completion failed"],
    ["renew", "renewal failed"],
  ])("never publishes Ready after %s failure", async (operation, message) => {
    const fake = environment();
    fake.fail({ actor: "broken", operation, error: new Error(message) });

    await expect(provisionWithDependencies(
      manifestPath,
      manifest,
      fake.createDependencies("broken"),
    )).rejects.toThrow(message);
    expect(writes(fake).at(-1)?.state).toBe("Preparing");
  });

  it("preserves the primary error and logs a release failure", async () => {
    const fake = environment();
    fake.fail({ actor: "broken", operation: "post-provision", error: new Error("primary") });
    fake.fail({ actor: "broken", operation: "release", error: new Error("release") });

    await expect(provisionWithDependencies(
      manifestPath,
      manifest,
      fake.createDependencies("broken"),
    )).rejects.toThrow("primary");
    expect(fake.logs.some((entry) => entry.level === "error" && entry.message.includes("Failed to release"))).toBe(true);
  });

  it("leaves abandoned groups for the external cleanup workflow", async () => {
    const fake = environment();
    fake.seedCompleteInstance(manifest, "abandoned");
    for (const group of fake.groups.values()) {
      group.tags.Completed = "False";
    }
    const abandoned = [...fake.groups.keys()];

    const result = await provisionWithDependencies(
      manifestPath,
      manifest,
      fake.createDependencies("replacement"),
    );

    expect(output(result).fixtureInstanceId).toBe(result.context.runId);
    expect([...fake.groups.keys()]).toEqual(expect.arrayContaining(abandoned));
    expect(azCommands(fake).some((args) => args[0] === "group" && args[1] === "delete")).toBe(false);
  });
});

describe("Azure CLI command contract", () => {
  it("uses service-principal discovery and exact mutation arguments", async () => {
    const fake = environment();
    await provisionWithDependencies(
      manifestPath,
      manifest,
      fake.createDependencies("contract"),
    );
    const commands = azCommands(fake);

    expect(commands).toContainEqual([
      "ad", "sp", "show", "--id", "principal-app", "--query", "id", "-o", "tsv",
    ]);
    expect(commands.find((args) => args.slice(0, 2).join(" ") === "group create")).toEqual(expect.arrayContaining([
      "--tags",
      "ManifestId=workflow-fixture",
      "FixtureId=storage-fixture",
      "FixtureVersion=7",
      "Completed=False",
      "FixtureComponent=storage",
    ]));
    expect(commands.find((args) => args.slice(0, 3).join(" ") === "deployment group create")).toEqual(expect.arrayContaining([
      "--template-file",
      resolve("/fixtures/workflow/storage.bicep"),
      "--parameters",
      "testPrincipalId=principal-object-1",
      "location=westus2",
    ]));
  });

  it("uses signed-in-user discovery for local user accounts", async () => {
    const fake = environment();
    fake.account.user = { name: "user@example.com", type: "user" };

    await provisionWithDependencies(
      manifestPath,
      manifest,
      fake.createDependencies("user"),
    );

    expect(azCommands(fake)).toContainEqual([
      "ad", "signed-in-user", "show", "--query", "id", "-o", "tsv",
    ]);
  });

  it("never issues resource-group deletion commands", async () => {
    const fake = environment();
    fake.seedCompleteInstance(manifest, "abandoned");
    for (const group of fake.groups.values()) {
      group.tags.Completed = "False";
    }

    await provisionWithDependencies(
      manifestPath,
      manifest,
      fake.createDependencies("cleanup"),
    );

    expect(azCommands(fake).some((args) => args[0] === "group" && args[1] === "delete")).toBe(false);
  });
});

function readyRecord(fake: FakeAzureEnvironment, instanceId: string): void {
  fake.coordination = {
    state: "Ready",
    manifestId: manifest.id,
    manifestVersion: manifest.version,
    instanceId,
    resourceGroups: Object.fromEntries(manifest.bicepConfigs.map((config) => [
      config.resourceGroupNameBase,
      `/subscriptions/subscription-1/resourceGroups/${config.resourceGroupNameBase}-${manifest.version}-${instanceId}`,
    ])),
  };
}

function preparingRecord(fake: FakeAzureEnvironment, instanceId: string, retryInMs: number): void {
  fake.coordination = {
    state: "Preparing",
    manifestId: manifest.id,
    manifestVersion: manifest.version,
    instanceId,
    resourceGroups: {},
    nextAttemptNotBefore: new Date(fake.nowMs + retryInMs).toISOString(),
  };
}

function mutations(fake: FakeAzureEnvironment): string[][] {
  return azCommands(fake).filter((args) => ["create", "update", "delete"].includes(args[1]));
}

describe("expiration tags", () => {
  it("emits exactly one platform-quoted DeleteAfter tag when creating workflow groups", async () => {
    const fake = environment();
    fake.onOperation({
      actor: "tags",
      operation: "deployment group create",
      invocation: 1,
      run: () => fake.advance(2_000),
    });
    await provisionWithDependencies(manifestPath, manifest, fake.createDependencies("tags"));

    const creates = azCommands(fake).filter((args) => args.slice(0, 2).join(" ") === "group create");
    const expectedTag = process.platform === "win32"
      ? '"DeleteAfter=01/02/2026 00:00:00"'
      : "DeleteAfter=01/02/2026 00:00:00";
    expect(creates).toHaveLength(2);
    for (const args of creates) {
      const tags = args.slice(args.indexOf("--tags") + 1, args.indexOf("-o", args.indexOf("--tags")));
      expect(tags.filter((tag) => tag.includes("DeleteAfter="))).toEqual([expectedTag]);
    }
    expect(writes(fake).at(-1)?.expiresAt).toBe("2026-01-01T23:00:00.000Z");
    expect([...fake.groups.values()].map((group) => group.tags.DeleteAfter)).toEqual([
      "01/02/2026 00:00:00", "01/02/2026 00:00:00",
    ]);
  });

  it.each(["Ready", "Empty"] as const)("records one hour before the earliest UTC expiration without extending it from %s", async (state) => {
    const fake = environment();
    fake.seedCompleteInstance(manifest, "existing");
    const groups = [...fake.groups.values()];
    groups[0].tags.DeleteAfter = "01/03/2026 00:00:00";
    groups[1].tags.DeleteAfter = "01/01/2026 02:00:00";
    if (state === "Ready") {
      readyRecord(fake, "existing");
    }

    await provisionWithDependencies(manifestPath, manifest, fake.createDependencies("utc"));

    expect(groups[0].tags.DeleteAfter).toBe("01/03/2026 00:00:00");
    expect(groups[1].tags.DeleteAfter).toBe("01/01/2026 02:00:00");
    expect(writes(fake).at(-1)?.expiresAt).toBe("2026-01-01T01:00:00.000Z");
    expect(mutations(fake)).toHaveLength(0);
  });

  it("uses the earliest existing expiration when all groups outlive 24 hours", async () => {
    const fake = environment();
    fake.seedCompleteInstance(manifest, "existing");
    const groups = [...fake.groups.values()];
    groups[0].tags.DeleteAfter = "01/04/2026 00:00:00";
    groups[1].tags.DeleteAfter = "01/03/2026 00:00:00";
    readyRecord(fake, "existing");

    await provisionWithDependencies(manifestPath, manifest, fake.createDependencies("later"));

    expect(groups.map((group) => group.tags.DeleteAfter)).toEqual([
      "01/04/2026 00:00:00", "01/03/2026 00:00:00",
    ]);
    expect(writes(fake).at(-1)?.expiresAt).toBe("2026-01-02T23:00:00.000Z");
  });

  it.each(["Ready", "Empty", "Preparing"] as const)(
    "does not reuse or rediscover unsafe components from %s",
    async (state) => {
      for (const expiration of [
        "12/31/2025 23:59:59",
        "01/01/2026 00:00:00",
        "01/01/2026 00:59:59",
        "01/01/2026 01:00:00",
        "not-a-date",
        "02/30/2026 00:00:00",
        "02/29/2027 00:00:00",
        "02/30/2028 00:00:00",
        "02/29/2100 00:00:00",
        "04/31/2026 00:00:00",
        "00/15/2027 00:00:00",
        "13/01/2026 00:00:00",
        "01/00/2027 00:00:00",
        "01/32/2026 00:00:00",
        "01/02/2026 24:00:00",
        "01/02/2026 00:60:00",
        "01/02/2026 00:00:60",
        undefined,
      ]) {
        const fake = environment();
        fake.seedCompleteInstance(manifest, "old");
        const oldGroups = [...fake.groups.values()];
        if (expiration === undefined) {
          delete oldGroups[0].tags.DeleteAfter;
        } else {
          oldGroups[0].tags.DeleteAfter = expiration;
        }
        if (state === "Ready") {
          readyRecord(fake, "old");
        } else if (state === "Preparing") {
          preparingRecord(fake, "old", 0);
        }

        const result = await provisionWithDependencies(manifestPath, manifest, fake.createDependencies("replacement"));

        expect(output(result).fixtureInstanceId).not.toBe("old");
        expect(fake.deploymentCount).toBe(2);
        expect(oldGroups[0].tags.DeleteAfter).toBe(expiration);
        expect(oldGroups.every((group) => fake.groups.has(group.name))).toBe(true);
        expect(writes(fake).at(-1)?.expiresAt).toBe("2026-01-01T23:00:00.000Z");
      }
    },
  );

  it.each([
    ["02/28/2027 00:00:00", "2027-02-27T23:00:00.000Z"],
    ["02/29/2028 00:00:00", "2028-02-28T23:00:00.000Z"],
    ["02/29/2400 00:00:00", "2400-02-28T23:00:00.000Z"],
    ["04/30/2026 00:00:00", "2026-04-29T23:00:00.000Z"],
    ["12/31/2026 23:59:59", "2026-12-31T22:59:59.000Z"],
  ])("preserves valid expiration %s", async (expiration, reuseDeadline) => {
    const fake = environment();
    fake.seedCompleteInstance(manifest, "existing");
    for (const group of fake.groups.values()) {
      group.tags.DeleteAfter = expiration;
    }
    readyRecord(fake, "existing");

    const result = await provisionWithDependencies(manifestPath, manifest, fake.createDependencies("valid-date"));

    expect(output(result).fixtureInstanceId).toBe("existing");
    expect(fake.deploymentCount).toBe(0);
    expect([...fake.groups.values()].every((group) => group.tags.DeleteAfter === expiration)).toBe(true);
    expect(writes(fake).at(-1)?.expiresAt).toBe(reuseDeadline);
  });

  it.each(["Ready", "Empty", "Preparing"] as const)("reuses a component just outside the one-hour margin from %s", async (state) => {
    const fake = environment();
    fake.seedCompleteInstance(manifest, "existing");
    [...fake.groups.values()][0].tags.DeleteAfter = "01/01/2026 01:00:01";
    if (state === "Ready") {
      readyRecord(fake, "existing");
    } else if (state === "Preparing") {
      preparingRecord(fake, "existing", 0);
    }

    const result = await provisionWithDependencies(manifestPath, manifest, fake.createDependencies("reuse"));

    expect(output(result).fixtureInstanceId).toBe("existing");
    expect(fake.deploymentCount).toBe(0);
    expect(writes(fake).at(-1)?.expiresAt).toBe("2026-01-01T00:00:01.000Z");
    expect(mutations(fake)).toHaveLength(0);
  });

  it.each([0, 60 * 60 * 1000])("reuses until the one-hour margin and provisions a new instance %i ms after the reuse deadline", async (delay) => {
    const fake = environment();
    const first = await provisionWithDependencies(manifestPath, manifest, fake.createDependencies("first"));
    const oldGroups = output(first).resourceGroups;
    fake.advance(23 * 60 * 60 * 1000 - 1);
    const reused = await provisionWithDependencies(manifestPath, manifest, fake.createDependencies("reuse"));
    expect(output(reused)).toEqual(output(first));
    expect(fake.deploymentCount).toBe(2);
    expect(writes(fake).at(-1)?.expiresAt).toBe("2026-01-01T23:00:00.000Z");
    fake.advance(1 + delay);

    const second = await provisionWithDependencies(manifestPath, manifest, fake.createDependencies("second"));

    expect(output(second).fixtureInstanceId).not.toBe(output(first).fixtureInstanceId);
    expect(fake.deploymentCount).toBe(4);
    for (const name of oldGroups) {
      expect(fake.groups.get(name)?.tags.DeleteAfter).toBe("01/02/2026 00:00:00");
    }
    expect(writes(fake).at(-1)?.expiresAt).toBe(new Date(fake.nowMs + 23 * 60 * 60 * 1000).toISOString());
  });
});

describe("publication and lease handling", () => {
  it("returns the published instance when releasing the lease fails afterwards", async () => {
    const fake = environment();
    fake.fail({ actor: "release", operation: "release", error: new Error("release failed") });

    const result = await provisionWithDependencies(manifestPath, manifest, fake.createDependencies("release"));

    expect(writes(fake).at(-1)?.state).toBe("Ready");
    expect(output(result).fixtureInstanceId).toBe(result.context.runId);
    expect(fake.logs.filter((entry) => entry.level === "error" && entry.message.includes("after publishing"))).toHaveLength(1);
  });

  it("stops after lease loss during completion without further ARM mutations or Ready", async () => {
    const fake = environment();
    fake.onOperation({ actor: "owner", operation: "group update --name", invocation: 1, run: () => fake.expireLease() });

    await expect(provisionWithDependencies(
      manifestPath,
      manifest,
      fake.createDependencies("owner"),
    )).rejects.toThrow("Stale lease");

    expect(writes(fake).map((record) => record.state)).toEqual(["Preparing"]);
    expect(azCommands(fake).filter((args) => args[1] === "update")).toHaveLength(2);
    expect(azCommands(fake).filter((args) => args[1] === "update" && args.includes("tags.DeleteAfter"))).toHaveLength(0);
  });

  it("rejects a stale owner's final Ready write and preserves the newer record", async () => {
    const fake = environment();
    fake.onOperation({ actor: "owner", operation: "write", invocation: 2, run: () => fake.expireLease() });

    await expect(provisionWithDependencies(
      manifestPath,
      manifest,
      fake.createDependencies("owner"),
    )).rejects.toThrow("Stale lease");

    expect(fake.staleWriteRejections).toBe(1);
    expect(fake.coordination).toMatchObject({ state: "Preparing" });
  });

  it("lets a replacement recover after lease loss during deployment and never mixes instances", async () => {
    const fake = environment();
    fake.onOperation({ actor: "owner", operation: "deployment group create", invocation: 1, run: () => fake.expireLease() });

    await expect(provisionWithDependencies(
      manifestPath,
      manifest,
      fake.createDependencies("owner"),
    )).rejects.toThrow("Stale lease");
    const abandoned = [...fake.groups.keys()];
    expect(abandoned).toHaveLength(1);

    const result = await provisionWithDependencies(
      manifestPath,
      manifest,
      fake.createDependencies("replacement"),
    );
    const parsed = output(result);

    expect(azCommands(fake).some((args) => args[0] === "group" && args[1] === "delete")).toBe(false);
    expect([...fake.groups.keys()]).toEqual(expect.arrayContaining(abandoned));
    expect(parsed.fixtureInstanceId).not.toBe("owner-uuid-2");
    for (const name of parsed.resourceGroups) {
      expect(fake.groups.get(name)?.tags).toMatchObject({ FixtureInstanceId: parsed.fixtureInstanceId, Completed: "True" });
      expect(abandoned).not.toContain(name);
    }
    expect(writes(fake).map((record) => record.state)).toEqual(["Preparing", "Preparing", "Ready"]);
  });
});

describe("crash recovery and retry spacing", () => {
  it("waits for nextAttemptNotBefore and starts exactly one replacement attempt", async () => {
    const fake = environment();
    preparingRecord(fake, "dead", 200);
    const start = fake.nowMs;

    const result = await provisionWithDependencies(manifestPath, manifest, fake.createDependencies("replacement"));

    expect(fake.nowMs - start).toBeGreaterThanOrEqual(200);
    expect(fake.deploymentCount).toBe(2);
    expect(output(result).fixtureInstanceId).not.toBe("dead");
    expect(writes(fake).map((record) => record.state)).toEqual(["Preparing", "Ready"]);
  });

  it("fails without ARM mutations when the retry time is beyond the acquisition budget", async () => {
    const fake = environment();
    preparingRecord(fake, "dead", 20_000);

    await expect(provisionWithDependencies(
      manifestPath,
      manifest,
      fake.createDependencies("late"),
    )).rejects.toThrow("cannot be retried within the acquisition budget");
    expect(mutations(fake)).toHaveLength(0);
  });

  it("leaves incomplete groups for external cleanup and replaces the instance", async () => {
    const fake = environment();
    fake.seedCompleteInstance(manifest, "old");
    const [storage, search] = [...fake.groups.values()];
    storage.tags.Completed = "False";
    fake.groups.delete(search.name);
    preparingRecord(fake, "old", 0);

    const result = await provisionWithDependencies(manifestPath, manifest, fake.createDependencies("recover"));
    const parsed = output(result);

    expect(fake.groups.has(storage.name)).toBe(true);
    expect(azCommands(fake).some((args) => args[0] === "group" && args[1] === "delete")).toBe(false);
    expect(fake.deploymentCount).toBe(2);
    expect(parsed.resourceGroups).not.toContain(storage.name);
    for (const name of parsed.resourceGroups) {
      expect(fake.groups.get(name)?.tags.FixtureInstanceId).toBe(parsed.fixtureInstanceId);
    }
  });

  it("lets many waiting actors share one replacement attempt after a failed attempt", async () => {
    const fake = environment();
    fake.fail({ actor: "broken", operation: "deployment group create", error: new Error("deployment failed") });
    await expect(provisionWithDependencies(
      manifestPath,
      manifest,
      fake.createDependencies("broken"),
    )).rejects.toThrow("deployment failed");

    const results = await Promise.all(Array.from({ length: 20 }, (_, index) =>
      provisionWithDependencies(manifestPath, manifest, fake.createDependencies(`waiter-${index}`))));

    expect(new Set(results.map((result) => output(result).fixtureInstanceId)).size).toBe(1);
    expect(writes(fake).filter((record) => record.state === "Preparing")).toHaveLength(2);
    const readyRecords = writes(fake).filter((record) => record.state === "Ready");
    expect(new Set(readyRecords.map((record) => record.instanceId)).size).toBe(1);
    expect(new Set(readyRecords.map((record) => record.expiresAt)).size).toBe(1);
    expect(fake.deploymentCount).toBe(2);
    expect(fake.maximumActiveLeases).toBe(1);
  });

  it("pins every contender to the same deterministic duplicate when none is recorded", async () => {
    const fake = environment();
    fake.seedCompleteInstance(manifest, "b");
    fake.seedCompleteInstance(manifest, "a");

    const results = await Promise.all(["x", "y", "z"].map((actor) =>
      provisionWithDependencies(manifestPath, manifest, fake.createDependencies(actor))));

    expect(results.map((result) => output(result).fixtureInstanceId)).toEqual(["a", "a", "a"]);
    expect(azCommands(fake).filter((args) => args[1] === "create" || args[1] === "delete")).toHaveLength(0);
  });
});

describe("additional failure modes", () => {
  it("rejects malformed ownership tags without mutating", async () => {
    const fake = environment();
    fake.seedCompleteInstance(manifest, "x");
    delete [...fake.groups.values()][0].tags.FixtureInstanceId;

    await expect(provisionWithDependencies(
      manifestPath,
      manifest,
      fake.createDependencies("tags"),
    )).rejects.toThrow("malformed ownership tags");
    expect(mutations(fake)).toHaveLength(0);
  });

  it("rejects two groups for the same instance and component", async () => {
    const fake = environment();
    fake.seedCompleteInstance(manifest, "x");
    fake.seedCompleteInstance(manifest, "x", "x-copy");

    await expect(provisionWithDependencies(
      manifestPath,
      manifest,
      fake.createDependencies("duplicates"),
    )).rejects.toThrow("multiple groups for component");
    expect(mutations(fake)).toHaveLength(0);
  });

  it.each([
    ["Completed=False", (tags: Record<string, string>) => { tags.Completed = "False"; }],
    ["wrong instance", (tags: Record<string, string>) => { tags.FixtureInstanceId = "other"; }],
    ["wrong component", (tags: Record<string, string>) => { tags.FixtureComponent = "other"; }],
    ["wrong version", (tags: Record<string, string>) => { tags.FixtureVersion = "1"; }],
    ["wrong manifest", (tags: Record<string, string>) => { tags.ManifestId = "other"; }],
  ])("rejects a Ready group with %s and asks for manual repair", async (_name, corrupt) => {
    const fake = environment();
    fake.seedCompleteInstance(manifest, "x");
    corrupt([...fake.groups.values()][0].tags);
    readyRecord(fake, "x");

    await expect(provisionWithDependencies(
      manifestPath,
      manifest,
      fake.createDependencies("inconsistent"),
    )).rejects.toThrow("manual repair is required");
    expect(mutations(fake)).toHaveLength(0);
    expect(fake.deploymentCount).toBe(0);
  });

  it("rejects a Ready record without an instance ID or a component", async () => {
    const fake = environment();
    fake.coordination = { state: "Ready", manifestId: manifest.id, manifestVersion: manifest.version, resourceGroups: {} };
    await expect(provisionWithDependencies(
      manifestPath,
      manifest,
      fake.createDependencies("no-instance"),
    )).rejects.toThrow("has no instance ID");

    fake.coordination = { state: "Ready", manifestId: manifest.id, manifestVersion: manifest.version, instanceId: "x", resourceGroups: {} };
    await expect(provisionWithDependencies(
      manifestPath,
      manifest,
      fake.createDependencies("no-component"),
    )).rejects.toThrow("is missing component");
  });

  it("never publishes Ready when writing the record fails after deployment", async () => {
    const fake = environment();
    const message = "write failed";
    fake.fail({ actor: "broken", operation: "write", error: new Error(message), invocation: 2 });

    await expect(provisionWithDependencies(
      manifestPath,
      manifest,
      fake.createDependencies("broken"),
    )).rejects.toThrow(message);
    expect(writes(fake).some((record) => record.state === "Ready")).toBe(false);
    expect(fake.logs.some((entry) => entry.level === "error" && entry.message.includes(message))).toBe(true);
  });

  it("stops after the first failed component and does not deploy the rest", async () => {
    const fake = environment();
    fake.fail({ actor: "broken", operation: "deployment group create", error: new Error("deployment failed") });

    await expect(provisionWithDependencies(
      manifestPath,
      manifest,
      fake.createDependencies("broken"),
    )).rejects.toThrow("deployment failed");

    expect(fake.deploymentCount).toBe(0);
    expect(fake.groups.size).toBe(1);
    expect(fake.postProvisionRuns).toHaveLength(0);
    expect(azCommands(fake).filter((args) => args[1] === "update")).toHaveLength(0);
  });
});

describe("injected time budget", () => {
  it("fails before issuing an Azure step once the provisioning budget is exhausted", async () => {
    const fake = environment();
    fake.onOperation({ actor: "slow", operation: "deployment group create", invocation: 1, run: () => fake.advance(5_000) });

    await expect(provisionWithDependencies(
      manifestPath,
      manifest,
      fake.createDependencies("slow"),
    )).rejects.toThrow("Time budget was exhausted before az deployment group create");

    expect(fake.deploymentCount).toBe(0);
    expect(writes(fake).map((record) => record.state)).toEqual(["Preparing"]);
  });

  it("fails before the post-provision script when the budget is spent", async () => {
    const fake = environment();
    fake.onOperation({ actor: "slow", operation: "post-provision", run: () => fake.advance(5_000) });

    await expect(provisionWithDependencies(
      manifestPath,
      manifest,
      fake.createDependencies("slow"),
    )).rejects.toThrow("Time budget was exhausted before post-provision script");
    expect(writes(fake).some((record) => record.state === "Ready")).toBe(false);
  });

  it("starts the provisioning budget only after the lease is acquired", async () => {
    const fake = environment();
    const holder = fake.createDependencies("holder").createResourceLock("storage", "fixtures", "blob", fake.nowMs + 1_000);
    await holder.initialize({ state: "Empty" });
    const lease = await holder.acquire();
    const follower = provisionWithDependencies(manifestPath, manifest, fake.createDependencies("follower"));
    await Promise.resolve();

    fake.advance(8_000);
    await lease.release();

    await expect(follower).resolves.toBeDefined();
    expect(fake.deploymentCount).toBe(2);
  });

  it("does not spend provisioning budget deleting abandoned groups", async () => {
    const fake = environment();
    fake.seedCompleteInstance(manifest, "abandoned");
    for (const group of fake.groups.values()) {
      group.tags.Completed = "False";
    }
    await expect(provisionWithDependencies(
      manifestPath,
      manifest,
      fake.createDependencies("late"),
    )).resolves.toBeDefined();
    expect(azCommands(fake).some((args) => args[0] === "group" && args[1] === "delete")).toBe(false);
  });
});

describe("Azure CLI read command contract", () => {
  it("uses exact discovery and Ready-validation argument vectors", async () => {
    const fake = environment();
    fake.seedCompleteInstance(manifest, "x");
    readyRecord(fake, "x");
    const storage = `storage-${manifest.version}-x`;

    await provisionWithDependencies(manifestPath, manifest, fake.createDependencies("reader"));

    const commands = azCommands(fake);
    expect(commands).toContainEqual(["group", "exists", "--name", storage, "-o", "tsv"]);
    expect(commands).toContainEqual(["group", "show", "--name", storage, "--query", "tags", "-o", "json"]);
    expect(commands).not.toContainEqual(["group", "show", "--name", storage, "--query", "tags.DeleteAfter", "-o", "tsv"]);

    const discovering = environment();
    discovering.seedCompleteInstance(manifest, "y");
    await provisionWithDependencies(manifestPath, manifest, discovering.createDependencies("discover"));
    expect(azCommands(discovering)).toContainEqual([
      "group", "list", "--tag", "FixtureId=storage-fixture", "--query", "[].{name:name,tags:tags}", "-o", "json",
    ]);
  });
});
