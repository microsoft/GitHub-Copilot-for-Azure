import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

type ApiRequest = {
  method: string;
  uri: string;
  authorization: string;
  body: string;
  contentType: string;
  maximumRetryCount: number;
};

type RetentionTestOptions = {
  environmentToken?: string;
  tokenOverride?: string;
  existingLeaseIds?: number[];
  responseShape?: "array" | "wrapped";
  failureMethod?: "Get" | "Delete" | "Post";
};

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const SCRIPT_PATH = join(REPO_ROOT, "eng", "common", "scripts", "Add-RetentionLease.ps1");
const TEMPLATE_PATH = join(
  REPO_ROOT, "eng", "common", "pipelines", "templates", "steps", "retain-run.yml",
);
const TEST_TOKEN = "retention-regression-token";
const REQUESTS_PREFIX = "RETENTION_TEST_REQUESTS=";
const BASE_URI = "https://dev.azure.com/azure-sdk/internal/_apis/build/retention/leases";

const harness = `
Set-StrictMode -Version Latest
$global:retentionTestOptions = $env:RETENTION_TEST_OPTIONS | ConvertFrom-Json
$global:retentionTestRequests = [System.Collections.Generic.List[object]]::new()

function Invoke-RestMethod {
    [CmdletBinding()]
    param(
        [string] $Method,
        [string] $Uri,
        [hashtable] $Headers,
        [string] $Body,
        [string] $ContentType,
        [int] $MaximumRetryCount
    )

    $global:retentionTestRequests.Add([ordered]@{
        method = $Method
        uri = $Uri
        authorization = $Headers.Authorization
        body = $Body
        contentType = $ContentType
        maximumRetryCount = $MaximumRetryCount
    })

    if ($Method -eq $global:retentionTestOptions.failureMethod) {
        throw "Mock retention API failure during $Method."
    }

    switch ($Method) {
        'Get' {
            $leases = @($global:retentionTestOptions.existingLeaseIds | ForEach-Object {
                [pscustomobject]@{ leaseId = $_ }
            })
            if ($global:retentionTestOptions.responseShape -eq 'wrapped') {
                return [pscustomobject]@{ value = $leases }
            }
            return ,$leases
        }
        'Delete' { return }
        'Post' {
            if (-not $Body.TrimStart().StartsWith('[')) {
                throw 'Retention API requires a JSON array.'
            }
            $leases = @([pscustomobject]@{ leaseId = 123 })
            if ($global:retentionTestOptions.responseShape -eq 'wrapped') {
                return [pscustomobject]@{ value = $leases }
            }
            return ,$leases
        }
        default { throw "Unexpected retention API method '$Method'." }
    }
}

$arguments = @{
    Organization = 'azure-sdk'
    Project = 'internal'
    DefinitionId = 8402
    RunId = 6912809
}
if ($null -ne $global:retentionTestOptions.tokenOverride) {
    $arguments.AccessToken = $global:retentionTestOptions.tokenOverride
}

$global:LASTEXITCODE = 0
& $env:RETENTION_TEST_SCRIPT @arguments
$exitCode = $LASTEXITCODE
Write-Output ('${REQUESTS_PREFIX}' + (
    ConvertTo-Json -InputObject $global:retentionTestRequests.ToArray() -Depth 5 -Compress
))
exit $exitCode
`;

function runRetentionScript(options: RetentionTestOptions = {}) {
  const { environmentToken = TEST_TOKEN, ...mockOptions } = options;
  const result = spawnSync("pwsh", ["-NoProfile", "-NonInteractive", "-Command", harness], {
    encoding: "utf8",
    timeout: 20_000,
    env: {
      ...process.env,
      SYSTEM_ACCESSTOKEN: environmentToken,
      SYSTEMACCESSTOKEN: "",
      RETENTION_TEST_SCRIPT: SCRIPT_PATH,
      RETENTION_TEST_OPTIONS: JSON.stringify({
        tokenOverride: null,
        existingLeaseIds: [],
        responseShape: "array",
        failureMethod: null,
        ...mockOptions,
      }),
    },
  });

  expect(result.error).toBeUndefined();
  const requestsLine = result.stdout.split(/\r?\n/).find(line => line.startsWith(REQUESTS_PREFIX));
  if (!requestsLine) {
    throw new Error(`Retention harness did not capture requests: ${result.stderr || result.stdout}`);
  }
  const requests = JSON.parse(requestsLine.slice(REQUESTS_PREFIX.length)) as ApiRequest[];
  return { ...result, requests };
}

describe("pipeline retention leases", () => {
  beforeAll(() => {
    const result = spawnSync("pwsh", [
      "-NoProfile", "-NonInteractive", "-Command", "$PSVersionTable.PSVersion.Major",
    ], { encoding: "utf8" });
    expect(result.error, "Retention regression tests require PowerShell 7 on PATH.").toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(Number(result.stdout.trim())).toBeGreaterThanOrEqual(7);
  });

  it("reads the token environment variable mapped by the shared pipeline template", () => {
    const template = readFileSync(TEMPLATE_PATH, "utf8");
    const script = readFileSync(SCRIPT_PATH, "utf8");
    const mappedVariable = template.match(/^\s+(\w+): \$\(System\.AccessToken\)$/m)?.[1];
    const consumedVariable = script.match(/\[string\] \$AccessToken = \$env:(\w+)/)?.[1];
    expect(mappedVariable).toBe("SYSTEM_ACCESSTOKEN");
    expect(consumedVariable).toBe(mappedVariable);
  });

  it.each(["array", "wrapped"] as const)(
    "creates a single-lease JSON array using the mapped token with %s API responses",
    responseShape => {
      const result = runRetentionScript({ responseShape });
      expect(result.status, result.stderr).toBe(0);
      expect(result.requests.map(request => request.method)).toEqual(["Get", "Post"]);
      expect(result.requests[0].uri).toBe(
        `${BASE_URI}?ownerId=azure-sdk-pipeline-automation` +
        "&definitionId=8402&runId=6912809&api-version=6.0-preview.1",
      );
      const request = result.requests[1];
      expect(request.uri).toBe(`${BASE_URI}?api-version=6.0-preview.1`);
      expect(request.contentType).toBe("application/json");
      expect(JSON.parse(request.body)).toEqual([{
        definitionId: 8402,
        runId: 6912809,
        ownerId: "azure-sdk-pipeline-automation",
        daysValid: 731,
      }]);
      for (const apiRequest of result.requests) {
        expect(apiRequest.authorization).toBe(
          `Basic ${Buffer.from(`nobody:${TEST_TOKEN}`).toString("base64")}`,
        );
        expect(apiRequest.maximumRetryCount).toBe(3);
      }
      expect(result.stdout).toContain("Retained pipeline run '6912809' for 731 days with lease '123'.");
    },
  );

  it("allows an explicit token to override the environment token", () => {
    const tokenOverride = "explicit-regression-token";
    const result = runRetentionScript({ tokenOverride });
    expect(result.status, result.stderr).toBe(0);
    for (const request of result.requests) {
      expect(request.authorization).toBe(
        `Basic ${Buffer.from(`nobody:${tokenOverride}`).toString("base64")}`,
      );
    }
  });

  it.each(["array", "wrapped"] as const)(
    "replaces existing leases before creating a new lease with %s API responses",
    responseShape => {
      const result = runRetentionScript({ existingLeaseIds: [41, 42], responseShape });
      expect(result.status, result.stderr).toBe(0);
      expect(result.requests.map(request => request.method)).toEqual(["Get", "Delete", "Delete", "Post"]);
      expect(result.requests[1].uri).toBe(`${BASE_URI}?ids=41&api-version=6.0-preview.1`);
      expect(result.requests[2].uri).toBe(`${BASE_URI}?ids=42&api-version=6.0-preview.1`);
    },
  );

  it.each(["", "   "])("rejects a missing or blank mapped token (%j) without API calls", environmentToken => {
    const result = runRetentionScript({ environmentToken });
    expect(result.status).toBe(2);
    expect(result.requests).toEqual([]);
    expect(result.stderr).toContain("AccessToken are required.");
    expect(result.stdout).not.toContain("Retained pipeline run");
  });

  it.each(["Get", "Delete", "Post"] as const)(
    "reports a %s API failure without claiming the run was retained",
    failureMethod => {
      const result = runRetentionScript({ existingLeaseIds: [41], failureMethod });
      expect(result.status).toBe(1);
      const expectedMethods = {
        Get: ["Get"],
        Delete: ["Get", "Delete"],
        Post: ["Get", "Delete", "Post"],
      };
      expect(result.requests.map(request => request.method)).toEqual(expectedMethods[failureMethod]);
      expect(result.stderr).toContain(`Mock retention API failure during ${failureMethod}.`);
      expect(result.stdout).not.toContain("Retained pipeline run");
    },
  );
});
