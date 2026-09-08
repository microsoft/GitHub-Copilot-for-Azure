import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type FakeConfig = {
  extensions?: string[];
  quotaNames?: string[];
  quotas?: Record<string, { limit: number; usage: number }>;
  quotaListFailure?: { code: number; stderr: string };
  graphCount?: number;
};

type Result = {
  status: number | null;
  stdout: string;
  stderr: string;
  calls: string[][];
};

const testDirectory = dirname(fileURLToPath(import.meta.url));
const testsRoot = resolve(testDirectory, "..", "..");
const repoRoot = resolve(testsRoot, "..");
const scriptRoot = join(
  repoRoot,
  "plugins",
  "azure-skills",
  "skills",
  "azure-prepare",
  "scripts",
);
const workRoot = join(testsRoot, ".check-quota-test-work");

const shellCandidates = [
  { name: "Bash", command: "bash", script: "check-quota.sh" },
  { name: "PowerShell", command: "pwsh", script: "check-quota.ps1" },
  { name: "Windows PowerShell", command: "powershell", script: "check-quota.ps1" },
] as const;

const available = shellCandidates.filter(({ command }) => {
  const probe = spawnSync(command, command === "bash" ? ["--version"] : ["-NoProfile", "-Command", "exit 0"]);
  return probe.status === 0;
});
const variants = available.filter(
  (candidate, index) =>
    candidate.script === "check-quota.sh" ||
    available.findIndex((item) => item.script === candidate.script) === index,
);

function slash(path: string): string {
  return path.replaceAll("\\", "/");
}

function writeFakeAz(directory: string): string {
  const fakeBin = join(directory, "bin");
  mkdirSync(fakeBin);
  const implementation = String.raw`
const fs = require("node:fs");
const config = JSON.parse(fs.readFileSync(process.env.AZ_FAKE_CONFIG, "utf8"));
const args = process.argv.slice(2);
fs.appendFileSync(process.env.AZ_FAKE_LOG, JSON.stringify(args) + "\n");
const fail = (failure) => {
  process.stderr.write(failure.stderr + "\n");
  process.exit(failure.code);
};
if (args[0] === "extension" && args[1] === "list") {
  const extension = args.join(" ").includes("resource-graph") ? "resource-graph" : "quota";
  if ((config.extensions || []).includes(extension)) process.stdout.write(extension + "\n");
} else if (args[0] === "extension" && args[1] === "add") {
  process.stdout.write("");
} else if (args[0] === "account" && args[1] === "show") {
  process.stdout.write("sub-test\n");
} else if (args[0] === "quota" && args[1] === "list") {
  if (config.quotaListFailure) fail(config.quotaListFailure);
  process.stdout.write((config.quotaNames || Object.keys(config.quotas || {})).join("\n") + "\n");
} else if (args[0] === "quota" && args[1] === "show") {
  const name = args[args.indexOf("--resource-name") + 1];
  process.stdout.write(String(config.quotas[name].limit) + "\n");
} else if (args[0] === "quota" && args[1] === "usage" && args[2] === "show") {
  const name = args[args.indexOf("--resource-name") + 1];
  process.stdout.write(String(config.quotas[name].usage) + "\n");
} else if (args[0] === "graph" && args[1] === "query") {
  process.stdout.write(String(config.graphCount) + "\n");
} else {
  process.stderr.write("Unexpected fake az invocation: " + args.join(" ") + "\n");
  process.exit(91);
}
`;
  writeFileSync(join(fakeBin, "fake-az.cjs"), implementation);
  const bashLauncher = join(fakeBin, "az");
  writeFileSync(
    bashLauncher,
    "#!/usr/bin/env bash\nexec node \"$(dirname \"$0\")/fake-az.cjs\" \"$@\"\n",
  );
  chmodSync(bashLauncher, 0o755);
  writeFileSync(join(fakeBin, "az.cmd"), "@node \"%~dp0fake-az.cjs\" %*\r\n");
  return fakeBin;
}

function runVariant(
  variant: (typeof variants)[number],
  directory: string,
  requirements: string,
  config: FakeConfig,
): Result {
  const requirementsPath = join(directory, "requirements.json");
  const configPath = join(directory, "fake-config.json");
  const logPath = join(directory, `az-${variant.name}.log`);
  writeFileSync(requirementsPath, requirements);
  writeFileSync(configPath, JSON.stringify(config));
  writeFileSync(logPath, "");

  const scriptPath = join(scriptRoot, variant.script);
  const args =
    variant.script === "check-quota.sh"
      ? [
        slash(scriptPath),
        "--region",
        "eastus",
        "--requirements-file",
        slash(requirementsPath),
        "--subscription-id",
        "sub-test",
      ]
      : [
        "-NoProfile",
        "-File",
        scriptPath,
        "-Region",
        "eastus",
        "-RequirementsFile",
        requirementsPath,
        "-SubscriptionId",
        "sub-test",
      ];
  const result = spawnSync(variant.command, args, {
    cwd: directory,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${join(directory, "bin")}${delimiter}${process.env.PATH ?? ""}`,
      AZ_FAKE_CONFIG: configPath,
      AZ_FAKE_LOG: logPath,
    },
  });
  return {
    status: result.status,
    stdout: result.stdout.replaceAll("\r\n", "\n"),
    stderr: result.stderr.replaceAll("\r\n", "\n"),
    calls: readFileSync(logPath, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as string[]),
  };
}

function runAll(requirements: string, config: FakeConfig): Result[] {
  const directory = mkdtempSync(join(workRoot, "case-"));
  writeFakeAz(directory);
  return variants.map((variant) => runVariant(variant, directory, requirements, config));
}

function expectParity(results: Result[]): void {
  expect(results).not.toHaveLength(0);
  for (const result of results.slice(1)) {
    expect(result.status).toBe(results[0].status);
    expect(result.stdout).toBe(results[0].stdout);
  }
}

beforeAll(() => {
  mkdirSync(workRoot, { recursive: true });
});

afterAll(() => {
  rmSync(workRoot, { recursive: true, force: true });
});

describe("azure-prepare quota scripts", () => {
  test("discovers supported quotas and aggregates PASS and 80% NEAR-LIMIT rows", () => {
    const results = runAll(
      JSON.stringify([
        { provider: "Microsoft.Compute", resourceName: "standardDSv3Family", requested: 2 },
        { provider: "Microsoft.Compute", resourceName: "standardFSv2Family", requested: 3 },
      ]),
      {
        extensions: ["quota"],
        quotaNames: ["standardDSv3Family", "standardFSv2Family"],
        quotas: {
          standardDSv3Family: { limit: 10, usage: 2 },
          standardFSv2Family: { limit: 10, usage: 5 },
        },
      },
    );

    expectParity(results);
    expect(results[0]).toMatchObject({ status: 0 });
    expect(results[0].stdout).toContain(
      "Microsoft.Compute\tstandardDSv3Family\teastus\t2\t2\t10\t4\t8\tPASS\tQuotaAPI",
    );
    expect(results[0].stdout).toContain(
      "Microsoft.Compute\tstandardFSv2Family\teastus\t3\t5\t10\t8\t5\tNEAR-LIMIT\tQuotaAPI",
    );
    expect(results[0].stdout).toContain("Overall\tNEAR-LIMIT");
    for (const result of results) {
      expect(result.calls.filter((call) => call[0] === "quota" && call[1] === "list")).toHaveLength(2);
    }
  });

  test("returns exit 1 and an INSUFFICIENT aggregate when capacity is exceeded", () => {
    const results = runAll(
      JSON.stringify([
        { provider: "Microsoft.Compute", resourceName: "standardDSv3Family", requested: 3 },
      ]),
      {
        extensions: ["quota"],
        quotas: { standardDSv3Family: { limit: 10, usage: 8 } },
      },
    );

    expectParity(results);
    expect(results[0].status).toBe(1);
    expect(results[0].stdout).toContain("\t11\t2\tINSUFFICIENT\tQuotaAPI");
    expect(results[0].stdout).toContain("Overall\tINSUFFICIENT");
  });

  test("uses Resource Graph only for a BadRequest quota failure", () => {
    const results = runAll(
      JSON.stringify([
        {
          provider: "Microsoft.Network",
          resourceName: "publicIPAddresses",
          requested: 2,
          resourceType: "microsoft.network/publicipaddresses",
          documentedLimit: 10,
        },
      ]),
      {
        extensions: ["quota", "resource-graph"],
        quotaListFailure: { code: 1, stderr: "ERROR: BadRequest from quota provider" },
        graphCount: 3,
      },
    );

    expectParity(results);
    expect(results[0].status).toBe(0);
    expect(results[0].stdout).toContain(
      "Microsoft.Network\tpublicIPAddresses\teastus\t2\t3\t10\t5\t7\tPASS\tResourceGraph",
    );
    expect(results[0].stdout).toContain("Overall\tPASS");
    for (const result of results) {
      expect(result.calls.some((call) => call[0] === "graph" && call[1] === "query")).toBe(true);
    }
  });

  test.each([
    ["malformed JSON", "{"],
    [
      "invalid field type",
      JSON.stringify([
        { provider: "Microsoft.Compute", resourceName: "standardDSv3Family", requested: "2" },
      ]),
    ],
  ])("returns exit 2 for %s", (_name, requirements) => {
    const results = runAll(requirements, { extensions: ["quota"] });

    expect(results).not.toHaveLength(0);
    for (const result of results) {
      expect(result.status).toBe(2);
    }
  });

  test("returns exit 1 without fallback for a non-BadRequest CLI failure", () => {
    const results = runAll(
      JSON.stringify([
        {
          provider: "Microsoft.Network",
          resourceName: "publicIPAddresses",
          requested: 2,
          resourceType: "microsoft.network/publicipaddresses",
          documentedLimit: 10,
        },
      ]),
      {
        extensions: ["quota", "resource-graph"],
        quotaListFailure: { code: 7, stderr: "ERROR: AuthorizationFailed" },
        graphCount: 3,
      },
    );

    expectParity(results);
    expect(results[0].status).toBe(1);
    expect(results[0].stdout).not.toContain("ResourceGraph");
    for (const result of results) {
      expect(result.stderr).toContain("AuthorizationFailed");
      expect(result.calls.some((call) => call[0] === "graph")).toBe(false);
    }
  });
});
