/**
 * Provision azure fixtures for an integration test.
 */

import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

type JsonValue = string | number | boolean | JsonValue[] | { [key: string]: JsonValue };

type BicepParameterConfig = {
  /**
   * The name of the parameter.
   */
  key: string;

  /**
   * If no value is provided, the script will attempt to resolve the value using the key.
   * See resolveBicepParameter for how they are resolved.
   */
  value?: JsonValue;
}

type BicepConfig = {
  /**
   * Unique identifier of the fixture.
   */
  fixtureId: string;

  /**
   * Path to a Bicep template.
   * The path is relative to the location of the manifest file.
   * The template is deployed at resource group scope into a resource group
   * the script creates beforehand.
   */
  path: string;

  /**
   * Azure region.
   */
  location: string;

  /**
   * Base name of the resource group.
   * The final computed resource group name may contain a random suffix.
   */
  resourceGroupNameBase: string;

  /**
   * The parameter values for the Bicep template.
   * The location parameter is always computed and provided.
   */
  parameters: BicepParameterConfig[];
};

type PostProvisionScriptConfig = {
  /**
   * Path to the data plane script.
   * The path is relative to the location of the manifest file.
   */
  path: string;
}

/**
 * Manifest for provisioning the Azure fixture for integration test.
 */
type FixtureManifest = {
  type: "readOnly" | "readWrite";

  version: number;

  schemaVersion: number;

  /**
   * A human facing description of the Azure fixtures.
   * This description will not be used by the provisioning script.
   */
  description: string;

  /**
   * Bicep templates to provision.
   * The templates will be provisioned to each resource group computed
   * from resourceGroupNameBases in the given order.
   */
  bicepConfigs: BicepConfig[];

  /**
   * Whether to add a pseudo-random suffix when computing the resource group name.
   * Fixtures provisioned in the same run share the same random suffix.
   * False by default for readOnly fixtures.
   * True by default for readWrite fixtures.
   */
  useRandomSuffix?: boolean;

  /**
   * Number of seconds for the resource to live.
   * Only applies to fixtures that aren't persisted.
   * A DeleteAfter tag will be computed and set on the resource group.
   * 24 hours by default.
   */
  timeToLiveSec?: number;

  /**
   * Additional post-provision scripts to run after provisioning the fixtures.
   * Post-provision scripts are given the computed resource group names.
   * --resource-groups <rg-1> <rg-2> ... <rg-n>
   * 
   * The post-provision scripts will be executed via tsx and must be written in Typescript.
   */
  postProvisionScripts?: PostProvisionScriptConfig[];

  timeoutSec?: number;
};

/**
 * Run-scoped values available to substitution tokens in Bicep parameters.
 */
export type FixtureRunContext = {
  /**
   * Correlates every resource group and log line of a single provisioning run. 
   **/
  runId: string;

  /** 
   * Shared by all fixtures provisioned in the same run. Empty when useRandomSuffix is false.
   **/
  suffix: string;

  subscriptionId: string;

  tenantId: string;

  /** 
   * Computed resource group name, keyed by resourceGroupNameBase.
   **/
  resourceGroupNames: Record<string, string>;

  /**
   * Object ID of the identity the agent runs as, which is not always the identity
   * running the provisioning. Resolved lazily so fixtures that never reference it
   * do not require directory read permission.
   */
  testPrincipalId: string;
};

function resolveBicepParameter(context: FixtureRunContext, parameterConfig: BicepParameterConfig): JsonValue {
  if (parameterConfig.value !== undefined) {
    return parameterConfig.value;
  }

  const value = (context as Record<string, JsonValue | undefined>)[parameterConfig.key];
  if (value === undefined) {
    throw new Error(`Unable to resolve Bicep parameter ${parameterConfig.key}`);
  }
  return value;
}

const AZ_COMMAND = process.platform === "win32" ? "az.cmd" : "az";

const NPX_COMMAND = process.platform === "win32" ? "npx.cmd" : "npx";

const DEFAULT_TIME_TO_LIVE_SEC = 24 * 60 * 60; // 24 hours

const READ_ONLY_LOCK_NAME = "fixture-readonly";

const FIXTURE_VERSION_TAG = "FixtureVersion";

const FIXTURE_ID_TAG = "FixtureId";

/** Formats as "MM/DD/YYYY HH:mm:ss" in UTC, the form the cleanup script expects. */
function formatDeleteAfter(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const day = `${pad(date.getUTCMonth() + 1)}/${pad(date.getUTCDate())}/${date.getUTCFullYear()}`;
  const time = `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
  return `${day} ${time}`;
}

type AzureAccount = {
  id: string;
  tenantId: string;
  user?: { name?: string; type?: string };
};

function runAz(args: string[]): string {
  return execFileSync(AZ_COMMAND, args, { encoding: "utf8" }).trim();
}

/**
 * The signed-in identity is a user locally and a federated service principal in CI,
 * which are looked up through different Graph commands.
 */
function getTestPrincipalId(account: AzureAccount): string {
  if (account.user?.type === "servicePrincipal" && account.user.name) {
    return runAz(["ad", "sp", "show", "--id", account.user.name, "--query", "id", "-o", "tsv"]);
  }
  return runAz(["ad", "signed-in-user", "show", "--query", "id", "-o", "tsv"]);
}

type FixtureResourceGroup = {
  name: string;
  tags: Record<string, string>;
};

/** Finds every resource group previously provisioned for a fixture, whatever its name. */
function findFixtureResourceGroups(fixtureId: string): FixtureResourceGroup[] {
  const groups = JSON.parse(
    runAz([
      "group",
      "list",
      "--tag",
      `${FIXTURE_ID_TAG}=${fixtureId}`,
      "--query",
      "[].{name:name, tags:tags}",
      "-o",
      "json",
    ]),
  ) as { name: string; tags: Record<string, string> | null }[];

  return groups.map((group) => ({ name: group.name, tags: group.tags ?? {} }));
}

/**
 * Starts deleting a stale read-only fixture and returns without waiting. The lock
 * has to go first because a ReadOnly lock blocks deleting the group it protects.
 */
function deleteLockedResourceGroup(resourceGroupName: string) {
  const locks = JSON.parse(
    runAz(["lock", "list", "--resource-group", resourceGroupName, "--query", "[].name", "-o", "json"]),
  ) as string[];

  if (locks.includes(READ_ONLY_LOCK_NAME)) {
    runAz(["lock", "delete", "--name", READ_ONLY_LOCK_NAME, "--resource-group", resourceGroupName, "-o", "none"]);
  }

  runAz(["group", "delete", "--name", resourceGroupName, "--yes", "--no-wait", "-o", "none"]);
}

type PruneResult = {
  /** The existing group already at or above the requested version, if any. */
  upToDate?: FixtureResourceGroup;

  /** Names of the groups whose deletion was scheduled. */
  staleNames: string[];
};

/**
 * Schedules deletion of every fixture resource group older than the given version and
 * returns the one already at or above it, if any.
 */
function pruneFixtureResourceGroups(fixtureId: string, version: number): PruneResult {
  let upToDate: FixtureResourceGroup | undefined;
  const staleNames: string[] = [];

  for (const group of findFixtureResourceGroups(fixtureId)) {
    const provisionedVersion = Number(group.tags[FIXTURE_VERSION_TAG]);

    if (Number.isFinite(provisionedVersion) && version <= provisionedVersion) {
      upToDate = group;
      continue;
    }

    console.log(`Deleting stale resource group ${group.name} for fixture ${fixtureId}.`);
    // Deleting a resource group can take a significantly long time until completion.
    // Azure also reserves the name of the deleted resource group for some time so we cannot provision
    // a new resource group using the same name immediately.
    // Modify the resource group name after each manifest version update to mitigate this limitation.
    deleteLockedResourceGroup(group.name);
    staleNames.push(group.name);
  }

  return { upToDate, staleNames };
}

function computeRunContext(manifest: FixtureManifest): FixtureRunContext {
  const account = JSON.parse(runAz(["account", "show", "-o", "json"])) as AzureAccount;

  const useRandomSuffix = manifest.useRandomSuffix ?? manifest.type === "readWrite";
  const suffix = useRandomSuffix ? randomBytes(3).toString("hex") : "";

  const resourceGroupNames: Record<string, string> = {};
  for (const { resourceGroupNameBase } of manifest.bicepConfigs) {
    resourceGroupNames[resourceGroupNameBase] = suffix
      ? `${resourceGroupNameBase}-${suffix}`
      : resourceGroupNameBase;
  }

  return {
    runId: randomUUID(),
    suffix,
    subscriptionId: account.id,
    tenantId: account.tenantId,
    resourceGroupNames,
    testPrincipalId: getTestPrincipalId(account),
  };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1) {
    console.error("Usage: tsx provision-fixture.ts <manifest-path>");
    process.exit(2);
  }

  const manifestPath = resolve(args[0]);
  // Un-validated cast. Schema validation happens before provisioning.
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as FixtureManifest;

  const context = computeRunContext(manifest);
  const manifestDir = dirname(manifestPath);

  for (const bicepConfig of manifest.bicepConfigs) {
    await provision(context, manifest, bicepConfig, manifestDir);
  }

  runPostProvisionScripts(context, manifest, manifestDir);
}

function runPostProvisionScripts(context: FixtureRunContext, manifest: FixtureManifest, manifestDir: string) {
  const resourceGroupNames = Object.values(context.resourceGroupNames);

  for (const scriptConfig of manifest.postProvisionScripts ?? []) {
    execFileSync(
      NPX_COMMAND,
      ["tsx", resolve(manifestDir, scriptConfig.path), "--resource-groups", ...resourceGroupNames],
      { stdio: "inherit" },
    );
  }
}

function provision(
  context: FixtureRunContext,
  manifest: FixtureManifest,
  bicepConfig: BicepConfig,
  manifestDir: string,
) {
  const resourceGroupName = context.resourceGroupNames[bicepConfig.resourceGroupNameBase];
  if (!resourceGroupName) {
    throw new Error(`No resource group name was computed for base ${bicepConfig.resourceGroupNameBase}`);
  }

  const shouldPersist = manifest.type === "readOnly";

  if (manifest.type === "readOnly") {
    const { upToDate, staleNames } = pruneFixtureResourceGroups(bicepConfig.fixtureId, manifest.version);

    if (upToDate) {
      console.log(
        `Fixture ${bicepConfig.fixtureId} already exists in resource group ${upToDate.name} ` +
        `at version ${upToDate.tags[FIXTURE_VERSION_TAG]}.`,
      );
      return;
    }

    if (staleNames.includes(resourceGroupName)) {
      throw new Error(
        `Resource group ${resourceGroupName} is being deleted and its name stays reserved for a while. ` +
        `Change resourceGroupNameBase for fixture ${bicepConfig.fixtureId} or wait for some time and then re-run.`,
      );
    }
  }

  const timeToLiveSec = manifest.timeToLiveSec ?? DEFAULT_TIME_TO_LIVE_SEC;
  const tags = [
    `${FIXTURE_ID_TAG}=${bicepConfig.fixtureId}`,
    `${FIXTURE_VERSION_TAG}=${manifest.version}`,
    shouldPersist
      ? "DoNotDelete=true"
      : `DeleteAfter=${formatDeleteAfter(new Date(Date.now() + timeToLiveSec * 1000))}`,
  ];

  runAz([
    "group",
    "create",
    "--name",
    resourceGroupName,
    "--location",
    bicepConfig.location,
    "--tags",
    ...tags,
    "-o",
    "none",
  ]);

  const parameters = new Map<string, JsonValue>();
  for (const parameterConfig of bicepConfig.parameters) {
    parameters.set(parameterConfig.key, resolveBicepParameter(context, parameterConfig));
  }
  // Set last so computed values win over anything the manifest declared.
  parameters.set("location", bicepConfig.location);

  const parameterArgs = [...parameters].map(
    ([key, value]) => `${key}=${typeof value === "string" ? value : JSON.stringify(value)}`,
  );

  const deploymentName = `${basename(bicepConfig.path, ".bicep")}-${context.runId.slice(0, 8)}`;

  runAz([
    "deployment",
    "group",
    "create",
    "--name",
    deploymentName,
    "--resource-group",
    resourceGroupName,
    "--template-file",
    resolve(manifestDir, bicepConfig.path),
    "--parameters",
    ...parameterArgs,
    "-o",
    "none",
  ]);

  // ReadOnly lock the resource group when we expect the agent to only read from it.
  if (manifest.type === "readOnly") {
    runAz([
      "lock",
      "create",
      "--name",
      READ_ONLY_LOCK_NAME,
      "--lock-type",
      "ReadOnly",
      "--resource-group",
      resourceGroupName,
      "-o",
      "none",
    ]);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});