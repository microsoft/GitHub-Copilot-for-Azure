/**
 * Provision azure fixtures for an integration test.
 */

import { execFileSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { basename, dirname, resolve } from "node:path";

import {
  type BicepConfig,
  type BicepParameterConfig,
  FIXTURE_ID_TAG,
  FIXTURE_VERSION_TAG,
  type StimuliFixtureManifest,
  type JsonValue,
  type ProvisionScriptOutput,
  findFixtureResourceGroups,
  runAz,
  runBudget,
  type RunBudget,
  type WorkflowFixtureManifest,
} from "./fixture-common.ts";
import { ResourceLock, type ResourceLockLease } from "./resource-lock.ts";

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
const COMPLETED_TAG = "Completed";
const WORKFLOW_FIXTURE_ID_TAG = "WorkflowFixtureId";
const FIXTURE_INSTANCE_ID_TAG = "FixtureInstanceId";
const FIXTURE_COMPONENT_TAG = "FixtureComponent";
const DELETE_AFTER_TAG = "DeleteAfter";
const READY_RETENTION_MS = 48 * 60 * 60 * 1000; // 48 hours
const LEASE_ACQUISITION_BUDGET_MS = 30 * 1000; // 30 seconds
const STORAGE_ACCOUNT_ENV = "AZURE_FIXTURE_COORDINATION_STORAGE_ACCOUNT";
const STORAGE_CONTAINER_ENV = "AZURE_FIXTURE_COORDINATION_CONTAINER";

/**
 * Each provision script run must finish in 10 minutes.
 */
const TOTAL_BUDGET_MS = 10 * 60 * 1000;
const PROVISIONING_RETRY_DELAY_MS = 2 * TOTAL_BUDGET_MS;

export type WorkflowResourceLockLease = Pick<
  ResourceLockLease,
  "assertHealthy" | "read" | "write" | "renew" | "release"
>;

export interface IResourceLock {
  initialize(initialValue: unknown): Promise<void>;
  acquire(deadline: number): Promise<WorkflowResourceLockLease>;
};

export type WorkflowProvisioningDependencies = {
  now(): number;
  sleep(ms: number): Promise<void>;
  immediate(): Promise<void>;
  randomUUID(): string;
  randomSuffix(): string;
  runAz(args: string[], options?: { subjectToBudget?: boolean }): string;
  runPostProvisionScript(
    context: FixtureRunContext,
    manifest: WorkflowFixtureManifest,
    manifestDir: string,
  ): string | undefined;
  createResourceLock(account: string, container: string, blob: string): IResourceLock;
  log: Pick<Console, "log" | "warn" | "error">;
  /** Budget the injected command runners are measured against; defaults to the process-wide budget. */
  budget: RunBudget;
  environment: NodeJS.ProcessEnv;
  processId: number;
  leaseAcquisitionBudgetMs: number;
  totalBudgetMs: number;
  provisioningRetryDelayMs: number;
  readyRetentionMs: number;
};

function defaultWorkflowDependencies(): WorkflowProvisioningDependencies {
  return {
    now: Date.now,
    sleep: (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms)),
    immediate: () => new Promise<void>((resolvePromise) => setImmediate(resolvePromise)),
    randomUUID,
    randomSuffix: () => randomBytes(3).toString("hex"),
    runAz,
    runPostProvisionScript: runPostProvisionScripts,
    createResourceLock: (account, container, blob) => new ResourceLock(account, container, blob),
    log: console,
    budget: runBudget,
    environment: process.env,
    processId: process.pid,
    leaseAcquisitionBudgetMs: LEASE_ACQUISITION_BUDGET_MS,
    totalBudgetMs: TOTAL_BUDGET_MS,
    provisioningRetryDelayMs: PROVISIONING_RETRY_DELAY_MS,
    readyRetentionMs: READY_RETENTION_MS,
  };
}

/** Formats as "MM/DD/YYYY HH:mm:ss" in UTC, the form the cleanup script expects. */
function formatDeleteAfter(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const day = `${pad(date.getUTCMonth() + 1)}/${pad(date.getUTCDate())}/${date.getUTCFullYear()}`;
  const time = `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
  return `${day} ${time}`;
}

/** Parses the cleanup script's UTC "MM/DD/YYYY HH:mm:ss" format; returns NaN when malformed. */
function parseDeleteAfter(value: string): number {
  const match = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    return Number.NaN;
  }
  const [month, day, year, hour, minute, second] = match.slice(1).map(Number);
  return Date.UTC(year, month - 1, day, hour, minute, second);
}

/** Values containing spaces need explicit quotes only when az runs through a shell (Windows). */
function shellQuote(value: string): string {
  return process.platform === "win32" ? `"${value}"` : value;
}

function deleteAfterTag(date: Date): string {
  return shellQuote(`${DELETE_AFTER_TAG}=${formatDeleteAfter(date)}`);
}

type FixtureManifestBase = Pick<StimuliFixtureManifest, "version" | "bicepConfigs" | "postProvisionScript"> & {
  persist?: boolean;
};

function computeResourceGroupName(manifest: FixtureManifestBase, bicepConfig: BicepConfig, suffix: string): string {
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
function getTestPrincipalId(account: AzureAccount, runCommand: WorkflowProvisioningDependencies["runAz"] = runAz): string {
  // The signed-in identity is a user locally and a federated service principal in CI.
  // They need different commands to get the principal ID.
  if (account.user?.type === "servicePrincipal" && account.user.name) {
    return runCommand(["ad", "sp", "show", "--id", account.user.name, "--query", "id", "-o", "tsv"]);
  }
  return runCommand(["ad", "signed-in-user", "show", "--query", "id", "-o", "tsv"]);
}

function computeRunContext(
  manifest: FixtureManifestBase,
  dependencies?: Pick<WorkflowProvisioningDependencies, "runAz" | "randomSuffix" | "randomUUID">,
): FixtureRunContext {
  const runCommand = dependencies?.runAz ?? runAz;
  const account = JSON.parse(runCommand(["account", "show", "-o", "json"])) as AzureAccount;
  const suffix = dependencies?.randomSuffix() ?? randomBytes(3).toString("hex");

  const resourceGroupNames: Record<string, string> = {};
  for (const bicepConfig of manifest.bicepConfigs) {
    resourceGroupNames[bicepConfig.resourceGroupNameBase] = computeResourceGroupName(manifest, bicepConfig, suffix);
  }

  return {
    runId: dependencies?.randomUUID() ?? randomUUID(),
    suffix,
    subscriptionId: account.id,
    tenantId: account.tenantId,
    resourceGroupNames,
    testPrincipalId: getTestPrincipalId(account, runCommand),
  };
}

function discoverPersistentFixtures(context: FixtureRunContext, manifest: StimuliFixtureManifest): boolean {
  const discoveredResourceGroups = new Map<string, string>();

  for (const bicepConfig of manifest.bicepConfigs) {
    const matchingGroups = findFixtureResourceGroups(bicepConfig.fixtureId)
      .filter((group) => group.tags[FIXTURE_VERSION_TAG] === String(manifest.version));
    const incompleteGroups = matchingGroups.filter(
      (group) => group.tags[COMPLETED_TAG]?.toLowerCase() !== "true",
    );

    if (incompleteGroups.length > 0) {
      throw new Error(
        `Persistent fixture ${bicepConfig.fixtureId} has partially provisioned resource group(s): ${incompleteGroups.map((group) => group.name).join(", ")}`,
      );
    }

    if (matchingGroups.length > 1) {
      throw new Error(
        `Persistent fixture ${bicepConfig.fixtureId} has multiple provisioned resource groups: ${matchingGroups.map((group) => group.name).join(", ")}`,
      );
    }

    if (matchingGroups.length === 1) {
      discoveredResourceGroups.set(bicepConfig.resourceGroupNameBase, matchingGroups[0].name);
    }
  }

  if (discoveredResourceGroups.size === 0) {
    return false;
  }

  if (discoveredResourceGroups.size !== manifest.bicepConfigs.length) {
    const missingFixtureIds = manifest.bicepConfigs
      .filter((config) => !discoveredResourceGroups.has(config.resourceGroupNameBase))
      .map((config) => config.fixtureId);
    throw new Error(
      `Persistent fixture is only partially provisioned; missing completed resource group(s) for: ${missingFixtureIds.join(", ")}`,
    );
  }

  for (const [resourceGroupNameBase, resourceGroupName] of discoveredResourceGroups) {
    context.resourceGroupNames[resourceGroupNameBase] = resourceGroupName;
  }
  return true;
}

function runPostProvisionScripts(context: FixtureRunContext, manifest: FixtureManifestBase, manifestDir: string): string | undefined {
  const resourceGroupNames = Object.values(context.resourceGroupNames);

  if (manifest.postProvisionScript) {
    const scriptConfig = manifest.postProvisionScript;
    const step = `post-provision script ${scriptConfig.path}`;
    try {
      const stdout = execFileSync(
        NPX_COMMAND,
        ["-y", "tsx", resolve(manifestDir, scriptConfig.path), "--resource-groups", ...resourceGroupNames],
        { encoding: "utf8", timeout: runBudget.remainingMs(step), killSignal: "SIGKILL", shell: true }
      );
      return stdout;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ETIMEDOUT") {
        throw new Error(`Provisioning time budget was exhausted during ${step}`, { cause: error });
      }
      throw error;
    }
  }
  return;
}

export function runPostTestScript(context: FixtureRunContext, manifest: StimuliFixtureManifest, manifestDir: string): string | undefined {
  const resourceGroupNames = Object.values(context.resourceGroupNames);

  if (manifest.postTestScript) {
    const scriptConfig = manifest.postTestScript;
    const stdout = execFileSync(
      NPX_COMMAND,
      ["-y", "tsx", resolve(manifestDir, scriptConfig.path), "--resource-groups", ...resourceGroupNames],
      { encoding: "utf8", killSignal: "SIGKILL", shell: true }
    );
    return stdout;
  }
}

function provision(
  context: FixtureRunContext,
  manifest: FixtureManifestBase,
  bicepConfig: BicepConfig,
  manifestDir: string,
  additionalTags: string[] = [],
  runCommand: WorkflowProvisioningDependencies["runAz"] = runAz,
  now: () => number = Date.now,
) {
  const resourceGroupName = context.resourceGroupNames[bicepConfig.resourceGroupNameBase];
  if (!resourceGroupName) {
    throw new Error(`No resource group name was computed for base ${bicepConfig.resourceGroupNameBase}`);
  }

  // Callers may supply their own DeleteAfter; emitting two would make the winner undefined.
  const overridesDeleteAfter = additionalTags.some((tag) => tag.replace(/^"/, "").startsWith(`${DELETE_AFTER_TAG}=`));
  const retentionTag = manifest.persist
    ? "DoNotDelete=True"
    : overridesDeleteAfter ? undefined : deleteAfterTag(new Date(now() + DEFAULT_TIME_TO_LIVE_SEC * 1000));
  const tags = [
    `${FIXTURE_ID_TAG}=${bicepConfig.fixtureId}`,
    `${FIXTURE_VERSION_TAG}=${manifest.version}`,
    ...(retentionTag ? [retentionTag] : []),
    "Completed=False",
    ...additionalTags,
  ];

  // Create resource group
  runCommand([
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

  if (!bicepConfig.path) {
    if (bicepConfig.parameters?.length) {
      throw new Error(`Bicep parameters require a template path for ${bicepConfig.resourceGroupNameBase}`);
    }
    return;
  }

  const parameters = new Map<string, JsonValue>();
  for (const parameterConfig of bicepConfig.parameters ?? []) {
    parameters.set(parameterConfig.key, resolveBicepParameter(context, parameterConfig));
  }
  // Set last so computed values win over anything the manifest declared.
  parameters.set("location", bicepConfig.location);

  const parameterArgs = [...parameters].map(
    ([key, value]) => `${key}=${typeof value === "string" ? value : JSON.stringify(value)}`,
  );

  const deploymentName = `${basename(bicepConfig.path, ".bicep")}-${context.runId.slice(0, 8)}`;

  runCommand([
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
}

function markFixturesCompleted(
  context: FixtureRunContext,
  runCommand: WorkflowProvisioningDependencies["runAz"] = runAz,
) {
  for (const resourceGroupName of Object.values(context.resourceGroupNames)) {
    runCommand([
      "group",
      "update",
      "--name",
      resourceGroupName,
      "--set",
      `tags.${COMPLETED_TAG}=True`,
      "-o",
      "none",
    ]);
  }
}

export type ProvisionManifestOutput = {
  context: FixtureRunContext,
  output: string
};

type CoordinationState = "Empty" | "Preparing" | "Ready";

type CoordinationRecord = {
  state: CoordinationState;
  manifestId: string;
  manifestVersion: number;
  instanceId?: string;
  ownerWorkflowRunId?: string;
  resourceGroups: Record<string, string>;
  nextAttemptNotBefore?: string;
  expiresAt?: string;
};

function requiredEnvironment(name: string, environment: NodeJS.ProcessEnv = process.env): string {
  const value = environment[name]?.trim();
  if (!value) {
    throw new Error(`Environment variable ${name} is required to provision workflow fixtures`);
  }
  return value;
}

function coordinationBlobName(context: FixtureRunContext, manifest: WorkflowFixtureManifest): string {
  const identity = `${context.tenantId}/${context.subscriptionId}/${manifest.id}/${manifest.version}`;
  return `workflow-fixtures/${createHash("sha256").update(identity).digest("hex")}.json`;
}

function errorText(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }
  const stderr = (error as Error & { stderr?: string | Buffer }).stderr;
  return `${error.message}\n${stderr?.toString() ?? ""}`;
}

function parseCoordinationRecord(
  value: unknown,
  manifest: WorkflowFixtureManifest,
): CoordinationRecord {
  if (!value || typeof value !== "object" || !("state" in value)) {
    throw new Error(`Workflow fixture coordination record is malformed for ${manifest.id}`);
  }
  const candidate = value as Partial<CoordinationRecord>;
  if (!["Empty", "Preparing", "Ready"].includes(candidate.state ?? "")) {
    throw new Error(`Workflow fixture coordination record has unsupported state ${String(candidate.state)}`);
  }
  if (candidate.state !== "Empty"
    && (candidate.manifestId !== manifest.id || candidate.manifestVersion !== manifest.version)) {
    throw new Error(`Workflow fixture coordination record identity does not match ${manifest.id}@${manifest.version}`);
  }
  return {
    state: candidate.state as CoordinationState,
    manifestId: manifest.id,
    manifestVersion: manifest.version,
    instanceId: candidate.instanceId,
    ownerWorkflowRunId: candidate.ownerWorkflowRunId,
    resourceGroups: candidate.resourceGroups ?? {},
    nextAttemptNotBefore: candidate.nextAttemptNotBefore,
    expiresAt: candidate.expiresAt,
  };
}

function groupNameFromId(resourceGroupId: string): string {
  const name = resourceGroupId.split("/").filter(Boolean).at(-1);
  if (!name) {
    throw new Error(`Invalid resource group ID in workflow fixture record: ${resourceGroupId}`);
  }
  return name;
}

function resourceGroupId(context: FixtureRunContext, name: string): string {
  return `/subscriptions/${context.subscriptionId}/resourceGroups/${name}`;
}

function verifyAndSelectRecordedFixture(
  context: FixtureRunContext,
  manifest: WorkflowFixtureManifest,
  record: CoordinationRecord,
  runCommand: WorkflowProvisioningDependencies["runAz"] = runAz,
): boolean {
  if (!record.instanceId) {
    throw new Error(`Ready workflow fixture ${manifest.id} has no instance ID`);
  }
  context.runId = record.instanceId;
  for (const config of manifest.bicepConfigs) {
    const id = record.resourceGroups[config.resourceGroupNameBase];
    if (!id) {
      throw new Error(`Ready workflow fixture ${manifest.id} is missing component ${config.resourceGroupNameBase}`);
    }
    const name = groupNameFromId(id);
    const exists = runCommand(["group", "exists", "--name", name, "-o", "tsv"]).toLowerCase() === "true";
    if (!exists) {
      throw new Error(`Ready workflow fixture ${manifest.id} references missing resource group ${name}; manual repair is required`);
    }
    const tags = JSON.parse(runCommand(["group", "show", "--name", name, "--query", "tags", "-o", "json"])) as Record<string, string>;
    if (tags[WORKFLOW_FIXTURE_ID_TAG] !== manifest.id
      || tags[FIXTURE_VERSION_TAG] !== String(manifest.version)
      || tags[FIXTURE_INSTANCE_ID_TAG] !== record.instanceId
      || tags[FIXTURE_COMPONENT_TAG] !== config.resourceGroupNameBase
      || tags[COMPLETED_TAG]?.toLowerCase() !== "true") {
      throw new Error(`Ready workflow fixture resource group ${name} has inconsistent ownership tags; manual repair is required`);
    }
    context.resourceGroupNames[config.resourceGroupNameBase] = name;
  }
  return true;
}

function refreshExpiration(
  context: FixtureRunContext,
  runCommand: WorkflowProvisioningDependencies["runAz"] = runAz,
  now: () => number = Date.now,
  retentionMs = READY_RETENTION_MS,
): string {
  const expiresAt = new Date(now() + retentionMs);
  let latest = expiresAt.getTime();
  for (const name of Object.values(context.resourceGroupNames)) {
    const current = runCommand(["group", "show", "--name", name, "--query", `tags.${DELETE_AFTER_TAG}`, "-o", "tsv"]);
    const currentExpiration = parseDeleteAfter(current);
    if (!Number.isFinite(currentExpiration) || currentExpiration < expiresAt.getTime()) {
      runCommand(["group", "update", "--name", name, "--set", shellQuote(`tags.${DELETE_AFTER_TAG}=${formatDeleteAfter(expiresAt)}`), "-o", "none"]);
    } else {
      latest = Math.max(latest, currentExpiration);
    }
  }
  return new Date(latest).toISOString();
}

type DiscoveredInstance = {
  instanceId: string;
  groups: Map<string, { name: string; completed: boolean }>;
  complete: boolean;
};

function discoverWorkflowFixtures(
  manifest: WorkflowFixtureManifest,
  runCommand: WorkflowProvisioningDependencies["runAz"] = runAz,
): DiscoveredInstance[] {
  const groupsByInstance = new Map<string, Map<string, { name: string; completed: boolean }>>();
  for (const config of manifest.bicepConfigs) {
    const groups = JSON.parse(runCommand([
      "group",
      "list",
      "--tag",
      `${FIXTURE_ID_TAG}=${config.fixtureId}`,
      "--query",
      "[].{name:name,tags:tags}",
      "-o",
      "json",
    ])) as { name: string; tags: Record<string, string> | null }[];
    for (const rawGroup of groups) {
      const group = { name: rawGroup.name, tags: rawGroup.tags ?? {} };
      if (group.tags[WORKFLOW_FIXTURE_ID_TAG] !== manifest.id
        || group.tags[FIXTURE_VERSION_TAG] !== String(manifest.version)) {
        continue;
      }
      const instanceId = group.tags[FIXTURE_INSTANCE_ID_TAG];
      const component = group.tags[FIXTURE_COMPONENT_TAG];
      if (!instanceId || !component || !manifest.bicepConfigs.some((item) => item.resourceGroupNameBase === component)) {
        throw new Error(`Workflow fixture resource group ${group.name} has malformed ownership tags`);
      }
      const groups = groupsByInstance.get(instanceId) ?? new Map<string, { name: string; completed: boolean }>();
      const existing = groups.get(component);
      if (existing && existing.name !== group.name) {
        throw new Error(`Workflow fixture instance ${instanceId} has multiple groups for component ${component}`);
      }
      groups.set(component, {
        name: group.name,
        completed: group.tags[COMPLETED_TAG]?.toLowerCase() === "true",
      });
      groupsByInstance.set(instanceId, groups);
    }
  }
  return [...groupsByInstance].map(([instanceId, groups]) => ({
    instanceId,
    groups,
    complete: manifest.bicepConfigs.every((config) => groups.get(config.resourceGroupNameBase)?.completed === true),
  })).sort((left, right) => left.instanceId.localeCompare(right.instanceId));
}

function selectDiscoveredFixture(
  context: FixtureRunContext,
  manifest: WorkflowFixtureManifest,
  instances: DiscoveredInstance[],
  preferredInstanceId?: string,
  logger: Pick<Console, "warn"> = console,
): DiscoveredInstance | undefined {
  const complete = instances.filter((instance) => instance.complete);
  const selected = complete.find((instance) => instance.instanceId === preferredInstanceId) ?? complete[0];
  if (!selected) {
    return undefined;
  }
  if (complete.length > 1) {
    logger.warn(`Workflow fixture ${manifest.id} has duplicate complete instances; selecting ${selected.instanceId}`);
  }
  context.runId = selected.instanceId;
  for (const [component, group] of selected.groups) {
    context.resourceGroupNames[component] = group.name;
  }
  return selected;
}

function recordResourceGroups(context: FixtureRunContext): Record<string, string> {
  return Object.fromEntries(
    Object.entries(context.resourceGroupNames).map(([component, name]) => [component, resourceGroupId(context, name)]),
  );
}

function workflowOutput(
  context: FixtureRunContext,
  manifest: WorkflowFixtureManifest,
): ProvisionManifestOutput {
  const output: ProvisionScriptOutput = {
    resourceGroups: Object.values(context.resourceGroupNames),
    fixtureId: manifest.id,
    fixtureVersion: manifest.version,
    fixtureInstanceId: context.runId,
    resourceGroupIdsByComponent: recordResourceGroups(context),
  };
  return { context, output: JSON.stringify(output, null, 2) };
}

export function provisionStimuliManifest(manifestPath: string, manifest: StimuliFixtureManifest): ProvisionManifestOutput {
  try {
    runBudget.set(TOTAL_BUDGET_MS);

    const context = computeRunContext(manifest);
    const manifestDir = dirname(manifestPath);

    const fixturesAlreadyProvisioned = manifest.persist && discoverPersistentFixtures(context, manifest);
    if (!fixturesAlreadyProvisioned) {
      for (const bicepConfig of manifest.bicepConfigs) {
        provision(context, manifest, bicepConfig, manifestDir);
      }
      markFixturesCompleted(context);
    }

    runPostProvisionScripts(context, manifest, manifestDir);

    // Write output
    const output: ProvisionScriptOutput = {
      resourceGroups: Object.values(context.resourceGroupNames)
    };
    return {
      context: context,
      output: JSON.stringify(output, null, 2)
    };
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    throw error;
  }
}

export function provisionWorkflowManifest(
  manifestPath: string,
  manifest: WorkflowFixtureManifest,
): Promise<ProvisionManifestOutput> {
  return provisionWorkflowManifestWithDependencies(manifestPath, manifest, defaultWorkflowDependencies());
}

export async function provisionWorkflowManifestWithDependencies(
  manifestPath: string,
  manifest: WorkflowFixtureManifest,
  dependencies: WorkflowProvisioningDependencies,
): Promise<ProvisionManifestOutput> {
  const accountName = requiredEnvironment(STORAGE_ACCOUNT_ENV, dependencies.environment);
  const containerName = requiredEnvironment(STORAGE_CONTAINER_ENV, dependencies.environment);
  const acquisitionDeadline = dependencies.now() + dependencies.leaseAcquisitionBudgetMs;
  const ownerWorkflowRunId = dependencies.environment.GITHUB_RUN_ID
    ? `${dependencies.environment.GITHUB_RUN_ID}:${dependencies.environment.GITHUB_RUN_ATTEMPT ?? "1"}`
    : `local:${dependencies.processId}:${dependencies.randomUUID()}`;
  let lease: WorkflowResourceLockLease | undefined;
  // After "Ready" is durably written the instance is valid; a release failure must not discard it.
  const releaseAfterPublish = async () => {
    const held = lease;
    lease = undefined;
    try {
      await held?.release();
    } catch (releaseError) {
      dependencies.log.error(`Failed to release workflow fixture lease after publishing: ${errorText(releaseError)}`);
    }
  };
  try {
    dependencies.budget.set(dependencies.leaseAcquisitionBudgetMs + dependencies.totalBudgetMs);
    let context = computeRunContext(manifest, dependencies);
    const blobName = coordinationBlobName(context, manifest);
    const lock = dependencies.createResourceLock(accountName, containerName, blobName);
    await lock.initialize({ state: "Empty" });

    while (true) {
      dependencies.budget.set(Math.max(1, acquisitionDeadline - dependencies.now()));
      lease = await lock.acquire(acquisitionDeadline);
      dependencies.budget.set(dependencies.totalBudgetMs);
      dependencies.log.log(`Acquired workflow fixture lease for ${manifest.id}@${manifest.version}; owner ${ownerWorkflowRunId}`);

      const record = parseCoordinationRecord(await lease.read(), manifest);
      if (record.state === "Ready") {
        verifyAndSelectRecordedFixture(context, manifest, record, dependencies.runAz);
        lease.assertHealthy();
        const expiresAt = refreshExpiration(
          context,
          dependencies.runAz,
          dependencies.now,
          dependencies.readyRetentionMs,
        );
        await lease.renew();
        await lease.write({ ...record, expiresAt });
        await releaseAfterPublish();
        return workflowOutput(context, manifest);
      }

      // It's possible that a complete instance of fixture had been created but that run failed to update the record.
      // Explicitly discover and fix the record if it's the case.
      const instances = discoverWorkflowFixtures(manifest, dependencies.runAz);
      const selected = selectDiscoveredFixture(context, manifest, instances, record.instanceId, dependencies.log);
      if (selected) {
        // Groups are only tagged Completed after post-provision succeeds, so a complete instance needs neither again.
        await lease.renew();
        lease.assertHealthy();
        const expiresAt = refreshExpiration(
          context,
          dependencies.runAz,
          dependencies.now,
          dependencies.readyRetentionMs,
        );
        const readyRecord: CoordinationRecord = {
          state: "Ready",
          manifestId: manifest.id,
          manifestVersion: manifest.version,
          instanceId: context.runId,
          ownerWorkflowRunId,
          resourceGroups: recordResourceGroups(context),
          expiresAt,
        };
        await lease.write(readyRecord);
        await releaseAfterPublish();
        return workflowOutput(context, manifest);
      }

      const retryAt = record.nextAttemptNotBefore ? Date.parse(record.nextAttemptNotBefore) : Number.NaN;
      if (Number.isFinite(retryAt) && retryAt > dependencies.now()) {
        await lease.release();
        lease = undefined;
        const waitMs = retryAt - dependencies.now();
        if (dependencies.now() + waitMs >= acquisitionDeadline) {
          throw new Error(`Workflow fixture ${manifest.id} cannot be retried within the acquisition budget`);
        }
        await dependencies.sleep(waitMs);
        context = computeRunContext(manifest, dependencies);
        continue;
      }

      const preparingRecord: CoordinationRecord = {
        state: "Preparing",
        manifestId: manifest.id,
        manifestVersion: manifest.version,
        instanceId: context.runId,
        ownerWorkflowRunId,
        resourceGroups: recordResourceGroups(context),
        nextAttemptNotBefore: new Date(dependencies.now() + dependencies.provisioningRetryDelayMs).toISOString(),
      };
      await lease.write(preparingRecord);
      dependencies.log.log(`Provisioning workflow fixture ${manifest.id} instance ${context.runId}`);

      for (const config of manifest.bicepConfigs) {
        lease.assertHealthy();
        provision(context, manifest, config, dirname(manifestPath), [
          `${WORKFLOW_FIXTURE_ID_TAG}=${manifest.id}`,
          `${FIXTURE_INSTANCE_ID_TAG}=${context.runId}`,
          `${FIXTURE_COMPONENT_TAG}=${config.resourceGroupNameBase}`,
          deleteAfterTag(new Date(dependencies.now() + dependencies.readyRetentionMs)),
        ], dependencies.runAz, dependencies.now);
        await dependencies.immediate();
        lease.assertHealthy();
      }
      dependencies.runPostProvisionScript(context, manifest, dirname(manifestPath));
      await lease.renew();
      lease.assertHealthy();
      markFixturesCompleted(context, dependencies.runAz);
      lease.assertHealthy();
      const expiresAt = refreshExpiration(
        context,
        dependencies.runAz,
        dependencies.now,
        dependencies.readyRetentionMs,
      );
      const readyRecord: CoordinationRecord = {
        state: "Ready",
        manifestId: manifest.id,
        manifestVersion: manifest.version,
        instanceId: context.runId,
        ownerWorkflowRunId,
        resourceGroups: recordResourceGroups(context),
        expiresAt,
      };
      await lease.write(readyRecord);
      await releaseAfterPublish();
      return workflowOutput(context, manifest);
    }
  } catch (error) {
    dependencies.log.error(error instanceof Error ? error.message : error);
    throw error;
  } finally {
    if (lease) {
      try {
        await lease.release();
      } catch (releaseError) {
        dependencies.log.error(`Failed to release workflow fixture lease: ${errorText(releaseError)}`);
      }
    }
  }
}