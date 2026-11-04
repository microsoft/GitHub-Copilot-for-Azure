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

async function request(appHostName: string, path: string, functionKey: string): Promise<{
  status: number;
  body: string;
  correlationId: string | null;
  resolvedIp: string | null;
}> {
  const response = await fetch(`https://${appHostName}/api/${path}?code=${encodeURIComponent(functionKey)}`, {
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

async function waitForTelemetry(applicationInsightsId: string, correlationId: string): Promise<void> {
  const queryUrl = `https://management.azure.com${applicationInsightsId}/query?api-version=2018-04-20`;
  await retry(
    "waiting for the successful blob-read trace in Application Insights",
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
    180_000,
    15_000,
  );
}

const functionAppName = findResourceName("Microsoft.Web/sites", "fnrt-app-");
const hostStorageName = findResourceName("Microsoft.Storage/storageAccounts", "fnrthost");
const testStorageName = findResourceName("Microsoft.Storage/storageAccounts", "fnrtdata");
const routeTableName = findResourceName("Microsoft.Network/routeTables", "fnrt-routes-");
const privateEndpointName = findResourceName("Microsoft.Network/privateEndpoints", "fnrt-storage-pe-");
const applicationInsightsName = findResourceName("Microsoft.Insights/components", "fnrt-insights-");

async function main(): Promise<void> {
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
    "{defaultHostName:defaultHostName,enabled:enabled,publicNetworkAccess:publicNetworkAccess,state:state}",
    "-o",
    "json",
  ])) as {
    defaultHostName?: string;
    enabled?: boolean;
    publicNetworkAccess?: string;
    state?: string;
  };
  if (!functionAppStatus.defaultHostName) {
    throw new Error("The Function App does not have a default host name.");
  }
  if (functionAppStatus.publicNetworkAccess === "Disabled") {
    throw new Error("The Function App public endpoint is disabled.");
  }
  log(
    `Warming ${functionAppStatus.defaultHostName}; state=${functionAppStatus.state ?? "unknown"}, `
    + `enabled=${String(functionAppStatus.enabled)}, publicNetworkAccess=${functionAppStatus.publicNetworkAccess ?? "unknown"}.`
  );
  await retry(
    "waiting for the health endpoint to return 200",
    () => request(functionAppStatus.defaultHostName!, "health", functionKey),
    (response) => response.status === 200,
    600_000,
  );

  const baseline = await retry(
    "waiting for the managed-identity blob read to succeed through the private endpoint",
    () => request(functionAppStatus.defaultHostName!, "read-blob", functionKey),
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
  await waitForTelemetry(applicationInsightsId, baseline.correlationId);

  log(`Adding a blackhole route only for private endpoint ${privateEndpointIp}/32.`);
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
    "storage-path",
    "--address-prefix",
    `${privateEndpointIp}/32`,
    "--next-hop-type",
    "None",
    "-o",
    "none",
  ]);

  const failedRead = await retry(
    "waiting for the routed blob read to fail with 503 while DNS remains correct",
    () => request(functionAppStatus.defaultHostName!, "read-blob", functionKey),
    (response) => response.status === 503 && response.resolvedIp === privateEndpointIp,
    240_000,
    15_000,
  );
  const healthAfterFault = await request(functionAppStatus.defaultHostName, "health", functionKey);
  if (healthAfterFault.status !== 200) {
    throw new Error(`The health endpoint returned ${healthAfterFault.status} after fault injection.`);
  }
  if (!failedRead.correlationId) {
    throw new Error("The failed blob read did not return a correlation ID.");
  }

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

  log("Fixture is ready: health is 200, storage DNS still resolves privately, and read-blob is 503.");
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
