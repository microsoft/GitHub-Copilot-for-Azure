import { execFileSync, spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

type Finding = { code: string; severity: string; detail: string };
type Operation = { operation: string; verdict: string; matchingRoles: { role: string; scopeType: string }[] };
type AccessReport = {
  status: string;
  target: { kind: string; keyAuth: string; customSubdomain: string };
  coverage: { assignmentCount: number; principalCount: number; scopeTypes: Record<string, number> };
  operations: Operation[];
  findings: Finding[];
};
type NetworkReport = {
  status: string;
  account: Record<string, unknown>;
  clientIp: string;
  hosts: { label: string; result: string }[];
  findings: Finding[];
};
type HarReport = {
  counts: { entries: number; kept: number; skippedOtherHosts: number; byStatusClass: Record<string, number> };
  entries: Record<string, unknown>[];
  findings: Finding[];
};

const outputScripts = "../../../output/azure-skills/skills/azure-ai/scripts/";
const accessScript = process.env.FOUNDRY_ACCESS_CHECKER_PATH ?? fileURLToPath(new URL(`${outputScripts}check-foundry-tools-access.mjs`, import.meta.url));
const networkScript = process.env.FOUNDRY_NETWORK_CHECKER_PATH ?? fileURLToPath(new URL(`${outputScripts}check-foundry-tools-network.mjs`, import.meta.url));
const harScript = process.env.HAR_SANITIZER_PATH ?? fileURLToPath(new URL(`${outputScripts}sanitize-har.mjs`, import.meta.url));
const jsonFileScript = fileURLToPath(new URL(`${outputScripts}json-file.mjs`, import.meta.url));

const access = (await import(pathToFileURL(accessScript).href)) as {
  extractAssignments: (json: unknown) => unknown[];
  extractDefinitions: (json: unknown) => unknown[];
  evaluateAccess: (opts: Record<string, unknown>) => AccessReport;
  classifyScope: (scope: string, accountId: string) => { type: string; applies: boolean };
};
const network = (await import(pathToFileURL(networkScript).href)) as {
  evaluateNetwork: (opts: Record<string, unknown>) => NetworkReport;
  classifyAddress: (ip: string) => string;
  ipv4InRule: (ip: string, rule: string) => boolean;
};
const har = (await import(pathToFileURL(harScript).href)) as {
  summarizeHar: (json: unknown, opts?: Record<string, unknown>) => HarReport;
  templatePath: (path: string) => string;
};
const jsonFile = (await import(pathToFileURL(jsonFileScript).href)) as {
  readJsonFile: (path: string, maxBytes: number) => unknown;
};

const isWindows = process.platform === "win32";
const SUB = "/subscriptions/00000000-0000-0000-0000-000000000000";
const ACCOUNT = `${SUB}/resourceGroups/rg-synthetic/providers/Microsoft.CognitiveServices/accounts/synthetic-ai`;
const SECRET = "SYNTHETIC_SECRET_DO_NOT_EMIT";

// Synthetic role definitions that mirror the public built-in role shapes relevant to these checks.
const definitions = [
  {
    name: "53ca6127-db72-4b80-b1b0-d745d6d5456d",
    roleName: "Foundry User",
    permissions: [{ actions: ["Microsoft.CognitiveServices/*/read", "Microsoft.CognitiveServices/accounts/listkeys/action"], notActions: [], dataActions: ["Microsoft.CognitiveServices/*"], notDataActions: [] }],
  },
  {
    name: "379c52cb-64de-498c-8b5b-c6170d6c49d4",
    roleName: "Cognitive Services Content Understanding Reader",
    permissions: [{
      actions: ["Microsoft.CognitiveServices/*/read"],
      notActions: [],
      dataActions: [
        "Microsoft.CognitiveServices/accounts/MultiModalIntelligence/analyzers/read",
        "Microsoft.CognitiveServices/accounts/MultiModalIntelligence/analyzers:analyze/action",
        "Microsoft.CognitiveServices/accounts/MultiModalIntelligence/analyzerresults/read",
      ],
      notDataActions: [],
    }],
  },
  {
    name: "59a2dba3-6303-4fd8-9a2e-8cbb4bdda972",
    roleName: "Cognitive Services Content Understanding Contributor",
    permissions: [{
      actions: ["Microsoft.CognitiveServices/*/read"],
      notActions: [],
      dataActions: ["Microsoft.CognitiveServices/accounts/MultiModalIntelligence/*"],
      notDataActions: ["Microsoft.CognitiveServices/accounts/MultiModalIntelligence/analyzers/delete"],
    }],
  },
  { name: "8e3af657-a8ff-443c-a75c-2fe8c4bcb635", roleName: "Owner", permissions: [{ actions: ["*"], notActions: [], dataActions: [], notDataActions: [] }] },
];

const assignment = (scope: string, guid: string, roleName: string, principalId = "11111111-1111-1111-1111-111111111111") => ({
  scope,
  roleDefinitionId: `${SUB}/providers/Microsoft.Authorization/roleDefinitions/${guid}`,
  roleDefinitionName: roleName,
  principalId,
  principalType: "User",
});
const account = (overrides: Record<string, unknown> = {}) => ({
  id: ACCOUNT,
  kind: "AIServices",
  properties: { customSubDomainName: "synthetic-ai", disableLocalAuth: true, ...overrides },
});
const verdictOf = (report: AccessReport, op: string) => report.operations.find((o) => o.operation === op)?.verdict;

describe("check-foundry-tools-access", () => {
  it("flags Foundry User assigned only at Foundry project scope for DI and CU", () => {
    const assignments = access.extractAssignments([
      assignment(`${ACCOUNT}/projects/p1`, "53ca6127-db72-4b80-b1b0-d745d6d5456d", "Foundry User"),
      assignment(SUB, "8e3af657-a8ff-443c-a75c-2fe8c4bcb635", "Owner"),
    ]);
    const report = access.evaluateAccess({ assignments, definitions: access.extractDefinitions(definitions), account: account() });
    expect(verdictOf(report, "cu-analyze")).toBe("blocked_project_scope_only");
    expect(verdictOf(report, "di-analyze")).toBe("blocked_project_scope_only");
    expect(verdictOf(report, "list-keys")).toBe("allowed");
    expect(report.status).toBe("failed_preflight");
    expect(report.target.keyAuth).toBe("disabled");
    const codes = report.findings.map((f) => f.code);
    expect(codes).toContain("PROJECT_SCOPE_ONLY");
    expect(codes).toContain("LOCAL_AUTH_DISABLED");
    expect(JSON.stringify(report)).not.toMatch(/synthetic-ai|00000000-0000|11111111-1111/);
  });

  it("allows DI and CU when Foundry User is inherited from the resource group", () => {
    const assignments = access.extractAssignments({ value: [{ id: "x", properties: assignment(`${SUB}/resourceGroups/rg-synthetic`, "53ca6127-db72-4b80-b1b0-d745d6d5456d", "Foundry User") }] });
    const report = access.evaluateAccess({ assignments, definitions: access.extractDefinitions(definitions), account: account(), operations: ["cu-analyze", "di-analyze", "cu-delete-result"] });
    expect(report.operations.every((o) => o.verdict === "allowed")).toBe(true);
    expect(report.operations[0].matchingRoles[0]).toEqual({ role: "Foundry User", scopeType: "resource-group" });
  });

  it("separates CU Reader (no Delete Result) from CU Contributor and leaves DI blocked", () => {
    const reader = access.evaluateAccess({
      assignments: access.extractAssignments([assignment(ACCOUNT, "379c52cb-64de-498c-8b5b-c6170d6c49d4", "Cognitive Services Content Understanding Reader")]),
      definitions: access.extractDefinitions(definitions),
      account: account(),
    });
    expect(verdictOf(reader, "cu-analyze")).toBe("allowed");
    expect(verdictOf(reader, "cu-delete-result")).toBe("blocked_no_data_action");
    expect(verdictOf(reader, "cu-author")).toBe("blocked_no_data_action");
    expect(verdictOf(reader, "di-analyze")).toBe("blocked_no_data_action");

    const contributor = access.evaluateAccess({
      assignments: access.extractAssignments([assignment(ACCOUNT, "59a2dba3-6303-4fd8-9a2e-8cbb4bdda972", "Cognitive Services Content Understanding Contributor")]),
      definitions: access.extractDefinitions(definitions),
      account: account(),
      operations: ["cu-delete-result", "cu-author"],
    });
    expect(contributor.operations.map((o) => o.verdict)).toEqual(["allowed", "allowed"]);
  });

  it("reports Owner-only callers as having no data action and keeps unknown roles unknown", () => {
    const owner = access.evaluateAccess({
      assignments: access.extractAssignments([assignment(SUB, "8e3af657-a8ff-443c-a75c-2fe8c4bcb635", "Owner")]),
      definitions: access.extractDefinitions(definitions),
      account: account({ disableLocalAuth: false }),
      operations: ["di-analyze"],
    });
    expect(verdictOf(owner, "di-analyze")).toBe("blocked_no_data_action");
    expect(owner.findings.map((f) => f.code)).toContain("NO_DATA_ACTION");

    const unknown = access.evaluateAccess({
      assignments: access.extractAssignments([assignment(ACCOUNT, "99999999-9999-9999-9999-999999999999", "Custom AI Role")]),
      definitions: [],
      resourceId: ACCOUNT,
      operations: ["cu-analyze"],
    });
    expect(verdictOf(unknown, "cu-analyze")).toBe("unknown_definitions_missing");
    expect(unknown.status).toBe("unknown");
    expect(unknown.findings.map((f) => f.code)).toContain("PARENT_SCOPES_NOT_SEEN");
  });

  it("accepts Az PowerShell shapes and classifies scopes", () => {
    const assignments = access.extractAssignments([{ Scope: ACCOUNT, RoleDefinitionId: "53ca6127-db72-4b80-b1b0-d745d6d5456d", RoleDefinitionName: "Foundry User", ObjectId: "u1", ObjectType: "User" }]);
    const defs = access.extractDefinitions([{ Name: "Foundry User", Id: "53ca6127-db72-4b80-b1b0-d745d6d5456d", Actions: [], NotActions: [], DataActions: ["Microsoft.CognitiveServices/*"], NotDataActions: [] }]);
    const report = access.evaluateAccess({ assignments, definitions: defs, resourceId: ACCOUNT, operations: ["di-build"] });
    expect(verdictOf(report, "di-build")).toBe("allowed");
    expect(access.classifyScope(`${ACCOUNT}/projects/p`, ACCOUNT).type).toBe("foundry-project");
    expect(access.classifyScope(`${SUB}/resourceGroups/other`, ACCOUNT).applies).toBe(false);
  });

  it("does not grant access from an unverified management-group ancestor", () => {
    const scope = "/providers/Microsoft.Management/managementGroups/unverified-group";
    const report = access.evaluateAccess({
      assignments: access.extractAssignments([
        assignment(scope, "53ca6127-db72-4b80-b1b0-d745d6d5456d", "Foundry User"),
      ]),
      definitions: access.extractDefinitions(definitions),
      account: account(),
      operations: ["di-analyze", "cu-analyze"],
    });
    expect(report.operations.map((o) => o.verdict)).toEqual([
      "unknown_management_group_ancestry",
      "unknown_management_group_ancestry",
    ]);
    expect(report.findings.map((f) => f.code)).toContain("MANAGEMENT_GROUP_ANCESTRY_UNKNOWN");
    expect(access.classifyScope(scope, ACCOUNT).applies).toBe(false);
  });

  it("requires a target resource", () => {
    expect(() => access.evaluateAccess({ assignments: [], definitions: [] })).toThrow("TARGET_RESOURCE_REQUIRED");
  });
});

describe("check-foundry-tools-network", () => {
  it("detects a host that resolves publicly while a private endpoint is approved and public access is disabled", () => {
    const report = network.evaluateNetwork({
      account: account({ publicNetworkAccess: "Disabled", privateEndpointConnections: [{ properties: { privateLinkServiceConnectionState: { status: "Approved" } } }] }),
      dns: [{ label: "cognitiveservices", result: "private" }, { label: "openai", result: "private" }, { label: "services.ai", result: "public" }],
    });
    expect(report.status).toBe("failed_preflight");
    const finding = report.findings.find((f) => f.code === "HOST_RESOLVES_PUBLIC");
    expect(finding?.severity).toBe("error");
    expect(finding?.detail).toContain("services.ai");
  });

  it("checks IP rules without echoing addresses", () => {
    const report = network.evaluateNetwork({
      account: account({ publicNetworkAccess: "Enabled", networkAcls: { defaultAction: "Deny", ipRules: [{ value: "203.0.113.0/24" }, { value: "198.51.100.7/32" }], virtualNetworkRules: [], bypass: "AzureServices" } }),
      clientIp: "198.51.100.9",
    });
    expect(report.clientIp).toBe("not_covered");
    const codes = report.findings.map((f) => f.code);
    expect(codes).toContain("CLIENT_IP_NOT_ALLOWED");
    expect(codes).toContain("IP_RULE_SMALL_PREFIX");
    expect(JSON.stringify(report)).not.toMatch(/198\.51\.100|203\.0\.113|synthetic-ai/);
    expect(network.evaluateNetwork({ account: account({ networkAcls: { defaultAction: "Deny", ipRules: [{ value: "203.0.113.0/24" }] } }), clientIp: "203.0.113.50" }).clientIp).toBe("covered");
  });

  it("flags disabled public access without an approved private endpoint and classifies addresses", () => {
    const report = network.evaluateNetwork({ account: account({ publicNetworkAccess: "Disabled", privateEndpointConnections: [{ properties: { privateLinkServiceConnectionState: { status: "Pending" } } }] }) });
    const codes = report.findings.map((f) => f.code);
    expect(codes).toContain("NO_APPROVED_PRIVATE_ENDPOINT");
    expect(codes).toContain("PRIVATE_ENDPOINT_PENDING");
    expect(network.classifyAddress("10.1.2.3")).toBe("private");
    expect(network.classifyAddress("192.0.2.10")).toBe("public");
    expect(network.classifyAddress("fd00::1")).toBe("private");
    expect(network.ipv4InRule("10.0.0.5", "10.0.0.0/8")).toBe(true);
    expect(network.ipv4InRule("198.51.100.9", "198.51.100.9/")).toBe(false);
    expect(network.ipv4InRule("198.51.100.9", "198.51.100.9/33")).toBe(false);
    expect(network.ipv4InRule("198.51.100.9", "198.51.100.9/not-a-prefix")).toBe(false);
    expect(network.ipv4InRule("10.0.0.5", "not-an-ip")).toBe(false);
  });

  it("does not treat client IP as proof that a private request used the public path", () => {
    const report = network.evaluateNetwork({
      account: account({
        publicNetworkAccess: "Disabled",
        privateEndpointConnections: [{ properties: { privateLinkServiceConnectionState: { status: "Approved" } } }],
      }),
      clientIp: "198.51.100.9",
      dns: [
        { label: "cognitiveservices", result: "private", tls: "handshake_ok" },
        { label: "openai", result: "private", tls: "handshake_ok" },
        { label: "services.ai", result: "private", tls: "handshake_ok" },
      ],
    });
    expect(report.status).toBe("passed_local_checks");
    expect(report.findings.find((f) => f.code === "CLIENT_IP_PUBLIC_PATH_NOT_PROVEN")?.severity).toBe("info");
  });
});

describe("sanitize-har", () => {
  const sample = {
    log: {
      entries: [
        {
          startedDateTime: "2026-01-01T00:00:00.000Z",
          time: 120.4,
          request: {
            method: "GET",
            url: `https://synthetic-ai.services.ai.azure.com/contentunderstanding/defaults?api-version=2025-11-01&sig=${SECRET}`,
            headers: [{ name: "Authorization", value: `Bearer ${SECRET}` }, { name: "Cookie", value: SECRET }],
          },
          response: {
            status: 401,
            headers: [{ name: "apim-request-id", value: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" }, { name: "WWW-Authenticate", value: `Bearer error="invalid_token", error_description="${SECRET}"` }],
            content: { mimeType: "application/json", text: JSON.stringify({ error: { code: "PermissionDenied", message: SECRET } }) },
          },
          serverIPAddress: "10.0.0.5",
        },
        {
          startedDateTime: "2026-01-01T00:00:01.000Z",
          time: 80,
          request: { method: "POST", url: "https://synthetic-ai.cognitiveservices.azure.com/documentintelligence/documentModels/prebuilt-layout:analyze?api-version=2024-11-30", headers: [{ name: "Ocp-Apim-Subscription-Key", value: SECRET }], postData: { text: SECRET } },
          response: { status: 202, headers: [{ name: "Operation-Location", value: "https://synthetic-ai.cognitiveservices.azure.com/documentintelligence/documentModels/prebuilt-layout/analyzeResults/12345678-1234-1234-1234-123456789abc?api-version=2024-11-30" }], content: {} },
        },
        { startedDateTime: "2026-01-01T00:00:02.000Z", time: 0, request: { method: "GET", url: `https://syntheticstore.blob.core.windows.net/train/${SECRET}.pdf?sig=${SECRET}`, headers: [] }, response: { status: 0, headers: [], content: {} } },
        { startedDateTime: "2026-01-01T00:00:03.000Z", time: 5, request: { method: "GET", url: "https://cdn.example.com/app.js", headers: [] }, response: { status: 200, headers: [], content: {} } },
      ],
    },
  };

  it("keeps correlation IDs and error codes but drops secrets, names, bodies and IPs", () => {
    const report = har.summarizeHar(sample);
    const text = JSON.stringify(report);
    expect(text).not.toContain(SECRET);
    expect(text).not.toMatch(/synthetic-ai|syntheticstore|10\.0\.0\.5/);
    expect(report.counts).toMatchObject({ entries: 4, kept: 3, skippedOtherHosts: 1 });
    expect(report.entries[0]).toMatchObject({ host: "<resource>.services.ai.azure.com", path: "/contentunderstanding/defaults", apiVersion: "2025-11-01", status: 401, errorCodes: ["PermissionDenied"], wwwAuthenticateError: "invalid_token", authScheme: "bearer" });
    expect(report.entries[1]).toMatchObject({ path: "/documentintelligence/documentModels/{id}:analyze", keyHeaderPresent: true, ids: { "operation-location.resultId": "12345678-1234-1234-1234-123456789abc" } });
    expect(report.findings.map((f) => f.code)).toContain("NO_RESPONSE_ENTRIES");
    expect(har.templatePath("/contentunderstanding/analyzers/my-private-analyzer:analyze")).toBe("/contentunderstanding/analyzers/{id}:analyze");
    expect(har.templatePath("/train/prebuilt-Jane-Smith-medical.pdf")).toBe("/train/{id}");
  });

  it("rejects non-HAR JSON", () => {
    expect(() => har.summarizeHar({ foo: 1 })).toThrow("NOT_A_HAR");
  });

  it("does not expose arbitrary response codes, path actions or methods", () => {
    const unsafe = {
      log: {
        entries: [
          {
            request: {
              method: `CUSTOM-${SECRET}`,
              url: `https://synthetic-ai.services.ai.azure.com/contentunderstanding/analyzers/private-client:${SECRET}`,
            },
            response: {
              status: 200,
              headers: [{ name: "WWW-Authenticate", value: `Bearer error="${SECRET}"` }],
              content: { mimeType: "application/json", text: JSON.stringify({ code: SECRET }) },
            },
          },
          {
            request: {
              method: "POST",
              url: "https://synthetic-ai.services.ai.azure.com/contentunderstanding/analyzers/prebuilt-read:analyze",
            },
            response: {
              status: 401,
              content: { mimeType: "application/json", text: JSON.stringify({ error: { code: "PermissionDenied", message: SECRET } }) },
            },
          },
          {
            request: {
              method: "GET",
              url: `https://syntheticstore.blob.core.windows.net/train/prebuilt-${SECRET}.json`,
            },
            response: {
              status: 200,
              content: { mimeType: "application/json", text: JSON.stringify({ error: { code: SECRET, value: SECRET } }) },
            },
          },
        ],
      },
    };
    const report = har.summarizeHar(unsafe);
    expect(JSON.stringify(report)).not.toContain(SECRET);
    expect(report.entries[0].path).toBe("/contentunderstanding/analyzers/{id}");
    expect(report.entries[0].method).toBe("UNKNOWN");
    expect(report.entries[0].errorCodes).toBeUndefined();
    expect(report.entries[0].wwwAuthenticateError).toBeUndefined();
    expect(report.entries[1]).toMatchObject({ errorCodes: ["PermissionDenied"] });
    expect(report.entries[2].path).toBe("/train/{id}");
    expect(report.entries[2].errorCodes).toBeUndefined();
  });
});

it("reads UTF-16 JSON exports from Windows PowerShell 5.1", async () => {
  const dir = await mkdtemp(join(tmpdir(), "foundry-tools-json-"));
  try {
    const path = join(dir, "export.json");
    await writeFile(path, Buffer.concat([
      Buffer.from([0xff, 0xfe]),
      Buffer.from(JSON.stringify({ value: "ok" }), "utf16le"),
    ]));
    expect(jsonFile.readJsonFile(path, 1024)).toEqual({ value: "ok" });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

it("checks JSON file type and size on the opened file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "foundry-tools-json-guard-"));
  try {
    const directoryPath = join(dir, "not-a-file");
    await mkdir(directoryPath);
    expect(() => jsonFile.readJsonFile(directoryPath, 1024)).toThrow("NOT_A_FILE");

    const largePath = join(dir, "large.json");
    await writeFile(largePath, JSON.stringify({ value: "too-large" }));
    expect(() => jsonFile.readJsonFile(largePath, 8)).toThrow("FILE_TOO_LARGE");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

function resolveExecutable(command: string): string | undefined {
  try {
    return execFileSync(isWindows ? "where.exe" : "which", [command], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim().split(/\r?\n/)[0] || undefined;
  } catch {
    return undefined;
  }
}

function envWithPath(path: string): NodeJS.ProcessEnv {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => k.toLowerCase() !== "path"));
  return { ...env, PATH: path };
}

const launchers = [
  { name: "Bash", executable: isWindows ? undefined : resolveExecutable("bash"), ext: "sh", args: (file: string, ...rest: string[]) => [file, ...rest] },
  { name: "PowerShell", executable: resolveExecutable(isWindows ? "powershell" : "pwsh"), ext: "ps1", args: (file: string, ...rest: string[]) => ["-NoProfile", "-File", file, ...rest] },
];
const scripts = [accessScript, networkScript, harScript];

for (const launcher of launchers) {
  for (const script of scripts) {
    const base = script.replace(/\.mjs$/, "");
    it.skipIf(!launcher.executable)(`${launcher.name} launcher for ${base.split(/[\\/]/).pop()} enforces Node.js 22+ and runs --help`, async () => {
      const dir = await mkdtemp(join(tmpdir(), "foundry-tools-launcher-"));
      try {
        const file = `${base}.${launcher.ext}`;
        const noNodeEnv = isWindows ? [dir, join(process.env.SystemRoot ?? "C:\\Windows", "System32")].join(delimiter) : dir;
        const missing = spawnSync(launcher.executable as string, launcher.args(file, "--help"), { encoding: "utf8", env: envWithPath(noNodeEnv) });
        expect(missing.status).toBe(3);
        expect(JSON.parse(missing.stderr).error).toBe("NODE_REQUIRED");
        if (isWindows) {
          await writeFile(join(dir, "node.cmd"), "@echo v20.11.0\r\n");
        } else {
          await writeFile(join(dir, "node"), "#!/bin/sh\necho v20.11.0\n");
          await chmod(join(dir, "node"), 0o755);
        }
        const oldNode = spawnSync(launcher.executable as string, launcher.args(file, "--help"), { encoding: "utf8", env: envWithPath(noNodeEnv) });
        expect(oldNode.status).toBe(3);
        expect(JSON.parse(oldNode.stderr).error).toBe("NODE_VERSION_UNSUPPORTED");
        const ok = spawnSync(launcher.executable as string, launcher.args(file, "--help"), {
          encoding: "utf8",
          env: envWithPath([dirname(process.execPath), process.env.PATH ?? ""].join(delimiter)),
        });
        expect(ok.status).toBe(0);
        expect(ok.stdout).toContain(`${base.split(/[\\/]/).pop()}.mjs`);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });
  }
}
