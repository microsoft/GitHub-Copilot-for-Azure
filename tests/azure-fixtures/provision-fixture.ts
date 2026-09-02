/**
 * Provision azure fixtures for an integration test.
 */

import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { basename, dirname, resolve } from "node:path";

import {
  BicepConfig,
  BicepParameterConfig,
  FIXTURE_ID_TAG,
  FIXTURE_STATE_PROVISIONING,
  FIXTURE_STATE_TAG,
  FIXTURE_VERSION_TAG,
  FixtureManifest,
  JsonValue,
  ProvisionScriptOutput,
  readManifest,
  remainingMs,
  runAz,
  setBudget,
} from "./fixture-common.ts";

/**
 * Run-scoped values available to substitution tokens in Bicep parameters.
 */
export type FixtureRunContext = {
  /**
   * Unique UUID for the run.
   **/
  runId: string;

  /** 
   * A randomly generated suffix for resource group names when needed.
   **/
  suffix: string;

  subscriptionId: string;

  tenantId: string;

  /** 
   * Computed resource group name, keyed by resourceGroupNameBase.
   **/
  resourceGroupNames: Record<string, string>;

  /**
   * Object ID of the identity the agent runs as.
   */
  testPrincipalId: string;
};

type PostProvisionScriptOutput = {
  path: string;
  stdout: string;
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

const NPX_COMMAND = process.platform === "win32" ? "npx.cmd" : "npx";
const DEFAULT_TIME_TO_LIVE_SEC = 3 * 60 * 60; // 3 hours

/**
 * Each provision script run must finish in 10 minutes.
 */
const TOTAL_BUDGET_MS = 10 * 60 * 1000;

/** Formats as "MM/DD/YYYY HH:mm:ss" in UTC, the form the cleanup script expects. */
function formatDeleteAfter(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const day = `${pad(date.getUTCMonth() + 1)}/${pad(date.getUTCDate())}/${date.getUTCFullYear()}`;
  const time = `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
  return `${day} ${time}`;
}

function computeResourceGroupName(manifest: FixtureManifest, bicepConfig: BicepConfig, suffix: string): string {
  return `${bicepConfig.resourceGroupNameBase}-${manifest.version}-${suffix}`;
}

type AzureAccount = {
  id: string;
  tenantId: string;
  user?: { name?: string; type?: string };
};

/**
 * Get the test principal ID using AZ CLI.
 */
function getTestPrincipalId(account: AzureAccount): string {
  // The signed-in identity is a user locally and a federated service principal in CI.
  // They need different commands to get the principal ID.
  if (account.user?.type === "servicePrincipal" && account.user.name) {
    return runAz(["ad", "sp", "show", "--id", account.user.name, "--query", "id", "-o", "tsv"]);
  }
  return runAz(["ad", "signed-in-user", "show", "--query", "id", "-o", "tsv"]);
}

function computeRunContext(manifest: FixtureManifest): FixtureRunContext {
  const account = JSON.parse(runAz(["account", "show", "-o", "json"])) as AzureAccount;
  const suffix = randomBytes(3).toString("hex");

  const resourceGroupNames: Record<string, string> = {};
  for (const bicepConfig of manifest.bicepConfigs) {
    resourceGroupNames[bicepConfig.resourceGroupNameBase] = computeResourceGroupName(manifest, bicepConfig, suffix);
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

function runPostProvisionScripts(context: FixtureRunContext, manifest: FixtureManifest, manifestDir: string): PostProvisionScriptOutput[] {
  const resourceGroupNames = Object.values(context.resourceGroupNames);

  const output: PostProvisionScriptOutput[] = [];
  for (const scriptConfig of manifest.postProvisionScripts ?? []) {
    const step = `post-provision script ${scriptConfig.path}`;
    try {
      const stdout = execFileSync(
        NPX_COMMAND,
        ["tsx", resolve(manifestDir, scriptConfig.path), "--resource-groups", ...resourceGroupNames],
        { encoding: "utf8", timeout: remainingMs(step), killSignal: "SIGKILL" }
      );
      output.push({ path: scriptConfig.path, stdout: stdout });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ETIMEDOUT") {
        throw new Error(`Provisioning budget of ${TOTAL_BUDGET_MS / 1000}s was exhausted during ${step}`, { cause: error });
      }
      throw error;
    }
  }
  return output;
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

  const tags = [
    `${FIXTURE_ID_TAG}=${bicepConfig.fixtureId}`,
    `${FIXTURE_VERSION_TAG}=${manifest.version}`,
    `${FIXTURE_STATE_TAG}=${FIXTURE_STATE_PROVISIONING}`,
    `DeleteAfter=${formatDeleteAfter(new Date(Date.now() + DEFAULT_TIME_TO_LIVE_SEC * 1000))}`,
  ];

  // Create resource group
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

  // Clearing FixtureState marks the fixture complete. A run that fails or times out
  // leaves the tag behind so a future run treats the fixture as stale and re-provisions it.
  runAz([
    "group",
    "update",
    "--name",
    resourceGroupName,
    "--remove",
    `tags.${FIXTURE_STATE_TAG}`,
    "-o",
    "none",
  ]);
}

function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1) {
    console.error("Usage: tsx provision-fixture.ts <manifest-path>");
    process.exit(2);
  }

  try {
    setBudget(TOTAL_BUDGET_MS);

    const manifestPath = resolve(args[0]);
    const manifest = readManifest(manifestPath);

    const context = computeRunContext(manifest);
    const manifestDir = dirname(manifestPath);

    for (const bicepConfig of manifest.bicepConfigs) {
      provision(context, manifest, bicepConfig, manifestDir);
    }

    runPostProvisionScripts(context, manifest, manifestDir);

    // Write output
    const output: ProvisionScriptOutput = {
      resourceGroups: Object.values(context.resourceGroupNames)
    };
    process.stdout.write(JSON.stringify(output, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
