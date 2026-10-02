import {
  commandName,
  runProcess,
  type ProcessResult,
} from "./process.ts";
import type { SkillImprovementRunSpec } from "./config.ts";

const KUSTO_API_VERSION = "2024-04-13";
const KUSTO_TOKEN_RESOURCE = "https://api.kusto.windows.net";

type KustoResource = NonNullable<
  NonNullable<SkillImprovementRunSpec["resources"]>["kusto"]
>;

type ClusterProperties = {
  state?: string;
  provisioningState?: string;
  uri?: string;
};

type ClusterResource = {
  properties?: ClusterProperties;
};

export type ManagedResourceRuntime = {
  runProcess: (
    command: string,
    args: string[],
    options: { cwd: string; timeoutMs?: number },
  ) => Promise<ProcessResult>;
  fetch: typeof fetch;
  sleep: (milliseconds: number) => Promise<void>;
  now: () => number;
};

const defaultRuntime: ManagedResourceRuntime = {
  runProcess,
  fetch,
  sleep: async milliseconds => {
    await new Promise(resolve => setTimeout(resolve, milliseconds));
  },
  now: Date.now,
};

export function kustoResourceId(resource: KustoResource): string {
  return [
    "",
    "subscriptions",
    resource.subscriptionId,
    "resourceGroups",
    resource.resourceGroup,
    "providers",
    "Microsoft.Kusto",
    "clusters",
    resource.clusterName,
  ].join("/");
}

function managementUrl(resource: KustoResource, operation?: "start" | "stop"): string {
  const suffix = operation ? `/${operation}` : "";
  return `https://management.azure.com${kustoResourceId(resource)}${suffix}?api-version=${KUSTO_API_VERSION}`;
}

async function getCluster(
  resource: KustoResource,
  cwd: string,
  runtime: ManagedResourceRuntime,
): Promise<ClusterResource> {
  const result = await runtime.runProcess(commandName("az"), [
    "resource",
    "show",
    "--ids",
    kustoResourceId(resource),
    "--api-version",
    KUSTO_API_VERSION,
    "--output",
    "json",
    "--only-show-errors",
  ], { cwd });
  return JSON.parse(result.stdout) as ClusterResource;
}

async function invokeClusterOperation(
  resource: KustoResource,
  operation: "start" | "stop",
  cwd: string,
  runtime: ManagedResourceRuntime,
): Promise<void> {
  await runtime.runProcess(commandName("az"), [
    "rest",
    "--method",
    "post",
    "--url",
    managementUrl(resource, operation),
    "--output",
    "none",
    "--only-show-errors",
  ], { cwd });
}

async function waitForRunningCluster(
  resource: KustoResource,
  cwd: string,
  runtime: ManagedResourceRuntime,
): Promise<ClusterResource> {
  const deadline = runtime.now() + resource.startupTimeoutMinutes * 60_000;
  let startRequested = false;
  while (runtime.now() < deadline) {
    const cluster = await getCluster(resource, cwd, runtime);
    const state = cluster.properties?.state;
    if (
      state === "Running"
      && cluster.properties?.provisioningState === "Succeeded"
    ) {
      return cluster;
    }
    if (state === "Stopped" && !startRequested) {
      console.log(`Starting managed Kusto cluster ${resource.clusterName}...`);
      await invokeClusterOperation(resource, "start", cwd, runtime);
      startRequested = true;
    } else if (state === "Stopping") {
      startRequested = false;
    } else if (
      state !== "Starting"
      && state !== "Creating"
      && state !== "Updating"
      && state !== "Running"
      && state !== "Stopped"
    ) {
      throw new Error(
        `Managed Kusto cluster ${resource.clusterName} has unsupported state ${state ?? "unknown"}.`
      );
    }
    await runtime.sleep(30_000);
  }
  throw new Error(
    `Managed Kusto cluster ${resource.clusterName} did not reach Running within `
    + `${resource.startupTimeoutMinutes} minutes.`
  );
}

async function healthCheck(
  resource: KustoResource,
  cluster: ClusterResource,
  cwd: string,
  runtime: ManagedResourceRuntime,
): Promise<void> {
  const uri = cluster.properties?.uri;
  if (!uri) {
    throw new Error(
      `Managed Kusto cluster ${resource.clusterName} did not expose a query URI.`
    );
  }
  const tokenResult = await runtime.runProcess(commandName("az"), [
    "account",
    "get-access-token",
    "--subscription",
    resource.subscriptionId,
    "--resource",
    KUSTO_TOKEN_RESOURCE,
    "--query",
    "accessToken",
    "--output",
    "tsv",
    "--only-show-errors",
  ], { cwd });
  const response = await runtime.fetch(`${uri.replace(/\/$/, "")}/v1/rest/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenResult.stdout.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      db: resource.databaseName,
      csl: "print Health=1",
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Managed Kusto health query failed with HTTP ${response.status}: ${body}`
    );
  }
  console.log(
    `Managed Kusto cluster ${resource.clusterName}/${resource.databaseName} is ready.`
  );
}

export async function prepareManagedResources(
  spec: SkillImprovementRunSpec,
  cwd: string,
  runtime: ManagedResourceRuntime = defaultRuntime,
): Promise<void> {
  const resource = spec.resources?.kusto;
  if (!resource?.startBeforeRun) {
    return;
  }
  const cluster = await waitForRunningCluster(resource, cwd, runtime);
  await healthCheck(resource, cluster, cwd, runtime);
}

export async function cleanupManagedResources(
  spec: SkillImprovementRunSpec,
  cwd: string,
  runtime: ManagedResourceRuntime = defaultRuntime,
): Promise<void> {
  const resource = spec.resources?.kusto;
  if (!resource?.stopAfterRun) {
    return;
  }
  const cluster = await getCluster(resource, cwd, runtime);
  const state = cluster.properties?.state;
  if (state === "Stopped" || state === "Stopping") {
    console.log(`Managed Kusto cluster ${resource.clusterName} is already ${state}.`);
    return;
  }
  console.log(`Stopping managed Kusto cluster ${resource.clusterName}...`);
  await invokeClusterOperation(resource, "stop", cwd, runtime);
}
