import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const AZ_COMMAND = process.platform === "win32" ? "az.cmd" : "az";
const appDir = resolve(__dirname, "app");
const separatorIndex = process.argv.indexOf("--resource-groups");
const resourceGroups = separatorIndex === -1 ? [] : process.argv.slice(separatorIndex + 1);

if (resourceGroups.length !== 1) {
  throw new Error("Exactly one resource group must follow --resource-groups");
}

const resourceGroup = resourceGroups[0];
const temporaryDirectory = mkdtempSync(join(tmpdir(), "functions-vnet-routing-"));

export type FaultMode =
  | "route-blackhole"
  | "ambiguous-route"
  | "dns-unlinked"
  | "snat-pressure"
  | "nat-capacity";

function log(message: string): void {
  console.error(`[functions-vnet-routing] ${message}`);
}

function runAz(args: string[], timeout = 120_000): string {
  try {
    return execFileSync(AZ_COMMAND, args, {
      encoding: "utf8",
      shell: process.platform === "win32",
      timeout,
    }).trim();
  } catch (error) {
    const commandError = error as Error & { stdout?: string; stderr?: string };
    const details = [commandError.stderr, commandError.stdout]
      .filter((value): value is string => Boolean(value?.trim()))
      .join("\n");
    throw new Error(`az ${args.join(" ")} failed${details ? `:\n${details}` : ""}`, { cause: error });
  }
}

function findResourceName(resourceType: string, prefix: string): string {
  const name = runAz([
    "resource",
    "list",
    "--resource-group",
    resourceGroup,
    "--resource-type",
    resourceType,
    "--query",
    `[?starts_with(name, '${prefix}')].name | [0]`,
    "-o",
    "tsv",
  ]);
  if (!name) {
    throw new Error(`No ${resourceType} resource beginning with ${prefix} was found.`);
  }
  return name;
}

function findResourceId(resourceType: string, name: string): string {
  return runAz([
    "resource",
    "show",
    "--resource-group",
    resourceGroup,
    "--resource-type",
    resourceType,
    "--name",
    name,
    "--query",
    "id",
    "-o",
    "tsv",
  ]);
}

function createBlackholeRoute(
  routeTableName: string,
  name: string,
  addressPrefix: string,
): void {
  runAz([
    "network",
    "route-table",
    "route",
    "create",
    "--resource-group",
    resourceGroup,
    "--route-table-name",
    routeTableName,
    "--name",
    name,
    "--address-prefix",
    addressPrefix,
    "--next-hop-type",
    "None",
    "-o",
    "none",
  ]);
}

function mergeTags(resourceId: string, tags: string[]): void {
  runAz([
    "tag",
    "update",
    "--resource-id",
    resourceId,
    "--operation",
    "Merge",
    "--tags",
    ...tags,
    "-o",
    "none",
  ]);
}

async function retry<T>(
  description: string,
  operation: () => Promise<T>,
  isComplete: (result: T) => boolean,
  timeoutMs: number,
  delayMs = 10_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let lastResult: T | undefined;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      lastResult = await operation();
      if (isComplete(lastResult)) {
        return lastResult;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
  }

  if (lastError instanceof Error) {
    const cause = (lastError as Error & { cause?: unknown }).cause;
    const causeText = cause instanceof Error
      ? `; cause: ${cause.message}${"code" in cause ? ` (${String(cause.code)})` : ""}`
      : "";
    throw new Error(`Timed out while ${description}: ${lastError.message}${causeText}`, { cause: lastError });
  }
  throw new Error(`Timed out while ${description}; last result was ${JSON.stringify(lastResult)}`);
}

async function request(
  appHostName: string,
  path: string,
  functionKey: string,
  query: Record<string, string> = {},
): Promise<{
  status: number;
  body: string;
  correlationId: string | null;
  resolvedIp: string | null;
}> {
  const url = new URL(`https://${appHostName}/api/${path}`);
  url.searchParams.set("code", functionKey);
  for (const [name, value] of Object.entries(query)) {
    url.searchParams.set(name, value);
  }
  const response = await fetch(url, {
    signal: AbortSignal.timeout(20_000),
  });
  return {
    status: response.status,
    body: await response.text(),
    correlationId: response.headers.get("x-correlation-id"),
    resolvedIp: response.headers.get("x-resolved-ip"),
  };
}

async function seedBlob(storageAccountName: string, seedPath: string): Promise<void> {
  await retry(
    "waiting for the fixture identity's test-storage role assignment",
    async () => {
      runAz([
        "storage",
        "blob",
        "upload",
        "--account-name",
        storageAccountName,
        "--container-name",
        "testdata",
        "--name",
        "sample.txt",
        "--file",
        seedPath,
        "--auth-mode",
        "login",
        "--overwrite",
        "true",
        "-o",
        "none",
      ]);
      return true;
    },
    (uploaded) => uploaded,
    180_000,
  );
}

async function waitForTelemetry(
  applicationInsightsId: string,
  correlationId: string,
  description: string,
  timeoutMs = 360_000,
): Promise<void> {
  const queryUrl = `https://management.azure.com${applicationInsightsId}/query?api-version=2018-04-20`;
  await retry(
    `waiting for ${description} in Application Insights`,
    async () => {
      const output = runAz([
        "rest",
        "--method",
        "post",
        "--url",
        queryUrl,
        "--body",
        JSON.stringify({
          query: `traces | where timestamp > ago(15m) | where message contains "${correlationId}" | take 1`,
        }),
        "-o",
        "json",
      ]);
      const result = JSON.parse(output) as { tables?: Array<{ rows?: unknown[][] }> };
      return (result.tables?.[0]?.rows?.length ?? 0) > 0;
    },
    (found) => found,
    timeoutMs,
    15_000,
  );
}

const functionAppName = findResourceName("Microsoft.Web/sites", "fnrt-app-");
const hostStorageName = findResourceName("Microsoft.Storage/storageAccounts", "fnrthost");
const testStorageName = findResourceName("Microsoft.Storage/storageAccounts", "fnrtdata");
const routeTableName = findResourceName("Microsoft.Network/routeTables", "fnrt-routes-");
const privateEndpointName = findResourceName("Microsoft.Network/privateEndpoints", "fnrt-storage-pe-");
const applicationInsightsName = findResourceName("Microsoft.Insights/components", "fnrt-insights-");

export async function provisionFixture(faultMode: FaultMode): Promise<void> {
try {
  const privateEndpointNicId = await retry(
    "waiting for the test storage private endpoint NIC",
    async () => runAz([
      "network",
      "private-endpoint",
      "show",
      "--resource-group",
      resourceGroup,
      "--name",
      privateEndpointName,
      "--query",
      "networkInterfaces[0].id",
      "-o",
      "tsv",
    ]),
    (nicId) => nicId.length > 0,
    120_000,
  );
  const privateEndpointIp = await retry(
    "waiting for the test storage private endpoint IP address",
    async () => runAz([
      "network",
      "nic",
      "show",
      "--ids",
      privateEndpointNicId,
      "--query",
      "ipConfigurations[0].privateIPAddress",
      "-o",
      "tsv",
    ]),
    (ipAddress) => ipAddress.length > 0,
    120_000,
  );

  const zipPath = join(temporaryDirectory, "function-app.zip");
  if (process.platform === "win32") {
    execFileSync("tar.exe", ["-a", "-c", "-f", zipPath, "."], {
      cwd: appDir,
      stdio: "inherit",
      timeout: 60_000,
    });
  } else {
    execFileSync("zip", ["-q", "-r", zipPath, "."], {
      cwd: appDir,
      stdio: "inherit",
      timeout: 60_000,
    });
  }

  log(`Deploying the diagnostic app to ${functionAppName}.`);
  await retry(
    "deploying the diagnostic Function app",
    async () => {
      runAz([
        "functionapp",
        "deployment",
        "source",
        "config-zip",
        "--resource-group",
        resourceGroup,
        "--name",
        functionAppName,
        "--src",
        zipPath,
        "--build-remote",
        "true",
        "-o",
        "none",
      ], 300_000);
      return true;
    },
    (deployed) => deployed,
    600_000,
    15_000,
  );

  const seedPath = join(temporaryDirectory, "sample.txt");
  writeFileSync(seedPath, "Flex VNet private endpoint baseline is healthy.\n", "utf8");
  log(`Seeding ${testStorageName}/testdata/sample.txt through Entra authentication.`);
  await seedBlob(testStorageName, seedPath);

  runAz([
    "storage",
    "account",
    "update",
    "--resource-group",
    resourceGroup,
    "--name",
    testStorageName,
    "--public-network-access",
    "Disabled",
    "-o",
    "none",
  ]);

  const functionKey = await retry(
    "waiting for a function host key",
    async () => {
      const output = runAz([
        "functionapp",
        "keys",
        "list",
        "--resource-group",
        resourceGroup,
        "--name",
        functionAppName,
        "-o",
        "json",
      ]);
      const keys = JSON.parse(output) as {
        functionKeys?: Record<string, string>;
        masterKey?: string;
      };
      return keys.functionKeys?.default ?? keys.masterKey ?? "";
    },
    (key) => key.length > 0,
    180_000,
  );

  const functionAppStatus = JSON.parse(runAz([
    "functionapp",
    "show",
    "--resource-group",
    resourceGroup,
    "--name",
    functionAppName,
    "--query",
    "{hostName:hostNames[0],enabled:enabled,publicNetworkAccess:publicNetworkAccess,state:state}",
    "-o",
    "json",
  ])) as {
    hostName?: string;
    enabled?: boolean;
    publicNetworkAccess?: string;
    state?: string;
  };
  const functionAppHostName = functionAppStatus.hostName || `${functionAppName}.azurewebsites.net`;
  if (functionAppStatus.publicNetworkAccess === "Disabled") {
    throw new Error("The Function App public endpoint is disabled.");
  }
  log(
    `Warming ${functionAppHostName}; state=${functionAppStatus.state ?? "unknown"}, `
    + `enabled=${String(functionAppStatus.enabled)}, publicNetworkAccess=${functionAppStatus.publicNetworkAccess ?? "unknown"}.`
  );
  await retry(
    "waiting for the health endpoint to return 200",
    () => request(functionAppHostName, "health", functionKey),
    (response) => response.status === 200,
    600_000,
  );

  const baseline = await retry(
    "waiting for the managed-identity blob read to succeed through the private endpoint",
    () => request(functionAppHostName, "read-blob", functionKey),
    (response) => response.status === 200
      && response.body.includes("Flex VNet private endpoint baseline is healthy.")
      && response.resolvedIp === privateEndpointIp,
    480_000,
  );
  if (!baseline.correlationId) {
    throw new Error("The successful blob read did not return a correlation ID.");
  }

  const applicationInsightsId = runAz([
    "resource",
    "show",
    "--resource-group",
    resourceGroup,
    "--resource-type",
    "Microsoft.Insights/components",
    "--name",
    applicationInsightsName,
    "--query",
    "id",
    "-o",
    "tsv",
  ]);
  await waitForTelemetry(
    applicationInsightsId,
    baseline.correlationId,
    "the successful blob-read trace",
  );

  if (faultMode === "snat-pressure") {
    const outboundBaseline = await request(
      functionAppHostName,
      "outbound-api",
      functionKey,
      { load: "baseline" },
    );
    if (outboundBaseline.status !== 200 || !outboundBaseline.correlationId) {
      throw new Error("The outbound API baseline did not return a correlated 200.");
    }

    const outboundPressure = await request(
      functionAppHostName,
      "outbound-api",
      functionKey,
      { load: "pressure" },
    );
    if (outboundPressure.status !== 503 || !outboundPressure.correlationId) {
      throw new Error("The outbound API pressure window did not return a correlated 503.");
    }

    const outboundRecovery = await request(
      functionAppHostName,
      "outbound-api",
      functionKey,
      { load: "recovery" },
    );
    if (outboundRecovery.status !== 200 || !outboundRecovery.correlationId) {
      throw new Error("The outbound API recovery window did not return a correlated 200.");
    }

    await waitForTelemetry(
      applicationInsightsId,
      outboundBaseline.correlationId,
      "the outbound baseline trace",
    );
    await waitForTelemetry(
      applicationInsightsId,
      outboundPressure.correlationId,
      "the outbound connection-pressure trace",
    );
    await waitForTelemetry(
      applicationInsightsId,
      outboundRecovery.correlationId,
      "the outbound recovery trace",
    );
    log("Seeded baseline, connection-pressure, and recovery telemetry for the public partner API.");
  }

  if (faultMode === "nat-capacity") {
    const outboundBaseline = await request(
      functionAppHostName,
      "outbound-api",
      functionKey,
      { load: "baseline" },
    );
    if (outboundBaseline.status !== 200 || !outboundBaseline.correlationId) {
      throw new Error("The capacity fixture baseline did not return a correlated 200.");
    }

    const capacityPressure = await request(
      functionAppHostName,
      "outbound-api",
      functionKey,
      { load: "capacity-pressure" },
    );
    if (capacityPressure.status !== 503 || !capacityPressure.correlationId) {
      throw new Error("The persistent capacity-pressure window did not return a correlated 503.");
    }

    await waitForTelemetry(
      applicationInsightsId,
      outboundBaseline.correlationId,
      "the capacity fixture baseline trace",
    );
    await waitForTelemetry(
      applicationInsightsId,
      capacityPressure.correlationId,
      "the persistent outbound-capacity trace",
    );

    const healthDuringPressure = await request(functionAppHostName, "health", functionKey);
    if (healthDuringPressure.status !== 200) {
      throw new Error(`The health endpoint returned ${healthDuringPressure.status} during capacity pressure.`);
    }
    await retry(
      "confirming private blob access remains healthy during public outbound-capacity pressure",
      () => request(functionAppHostName, "read-blob", functionKey),
      (response) => response.status === 200
        && response.body.includes("Flex VNet private endpoint baseline is healthy.")
        && response.resolvedIp === privateEndpointIp,
      120_000,
    );

    const hostPublicNetworkAccess = runAz([
      "storage",
      "account",
      "show",
      "--resource-group",
      resourceGroup,
      "--name",
      hostStorageName,
      "--query",
      "publicNetworkAccess",
      "-o",
      "tsv",
    ]);
    if (hostPublicNetworkAccess !== "Enabled") {
      throw new Error("Host/deployment storage connectivity changed unexpectedly.");
    }

    log(
      "Fixture nat-capacity is ready: application connection reuse is high, concurrency is bounded, "
      + "public dependency calls still fail under load, and private storage remains healthy.",
    );
    return;
  }

  if (faultMode === "ambiguous-route") {
    log("Adding harmless maintenance changes before the actual route fault.");
    mergeTags(findResourceId("Microsoft.Web/sites", functionAppName), [
      "MaintenanceWindow=completed",
      "DeploymentRing=stable",
    ]);
    mergeTags(findResourceId("Microsoft.Storage/storageAccounts", testStorageName), [
      "DataClassification=test",
      "MaintenanceWindow=completed",
    ]);
    createBlackholeRoute(routeTableName, "monitoring-egress", "192.0.2.10/32");
  }

  if (
    faultMode === "route-blackhole"
    || faultMode === "ambiguous-route"
    || faultMode === "snat-pressure"
  ) {
    log(`Adding a blackhole route only for private endpoint ${privateEndpointIp}/32.`);
    createBlackholeRoute(routeTableName, "storage-path", `${privateEndpointIp}/32`);
  } else {
    log("Adding an unrelated route, then unlinking only the test-storage private DNS zone.");
    createBlackholeRoute(routeTableName, "monitoring-egress", "192.0.2.10/32");
    const privateDnsZoneName = "privatelink.blob.core.windows.net";
    const privateDnsLinkName = runAz([
      "network",
      "private-dns",
      "link",
      "vnet",
      "list",
      "--resource-group",
      resourceGroup,
      "--zone-name",
      privateDnsZoneName,
      "--query",
      "[0].name",
      "-o",
      "tsv",
    ]);
    if (!privateDnsLinkName) {
      throw new Error("The test-storage private DNS VNet link was not found.");
    }
    runAz([
      "network",
      "private-dns",
      "link",
      "vnet",
      "delete",
      "--resource-group",
      resourceGroup,
      "--zone-name",
      privateDnsZoneName,
      "--name",
      privateDnsLinkName,
      "--yes",
    ]);
  }

  const failedRead = await retry(
    "waiting for the selected fault to produce a 503",
    () => request(functionAppHostName, "read-blob", functionKey),
    (response) => response.status === 503 && (
      faultMode === "dns-unlinked"
        ? response.resolvedIp !== privateEndpointIp
        : response.resolvedIp === privateEndpointIp
    ),
    240_000,
    15_000,
  );
  const healthAfterFault = await request(functionAppHostName, "health", functionKey);
  if (healthAfterFault.status !== 200) {
    throw new Error(`The health endpoint returned ${healthAfterFault.status} after fault injection.`);
  }
  if (!failedRead.correlationId) {
    throw new Error("The failed blob read did not return a correlation ID.");
  }
  await waitForTelemetry(
    applicationInsightsId,
    failedRead.correlationId,
    "the failed blob-read trace",
  );

  const hostPublicNetworkAccess = runAz([
    "storage",
    "account",
    "show",
    "--resource-group",
    resourceGroup,
    "--name",
    hostStorageName,
    "--query",
    "publicNetworkAccess",
    "-o",
    "tsv",
  ]);
  if (hostPublicNetworkAccess !== "Enabled") {
    throw new Error("Host/deployment storage connectivity changed unexpectedly.");
  }

  log(
    `Fixture ${faultMode} is ready: health is 200, read-blob is 503, and storage DNS `
    + (
      faultMode === "dns-unlinked"
        ? "no longer resolves to the private endpoint."
        : "still resolves privately."
    )
    + (
      faultMode === "snat-pressure"
        ? " Baseline, pressure, and recovery telemetry is available for the public partner API."
        : ""
    )
  );
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
}
