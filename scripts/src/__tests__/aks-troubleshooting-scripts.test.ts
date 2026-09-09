import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

type ScriptCase = {
  args: (artifactsDir: string) => string[];
  name: string;
  path: string;
};

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const SCRIPT_ROOT = join(
  REPO_ROOT,
  "plugins",
  "aks-skills",
  "skills",
  "aks-troubleshooting",
  "scripts",
);
const REQUIRED_TOOLS = ["az", "kubectl", "jq"] as const;
const EXPECTED_ERRORS: Record<(typeof REQUIRED_TOOLS)[number], string> = {
  az: "Azure CLI (az) is required. Install it from https://aka.ms/installazurecli and retry.",
  kubectl: "kubectl is required. Install it from https://kubernetes.io/docs/tasks/tools/ and retry.",
  jq: "jq is required. Install it from https://jqlang.github.io/jq/download/ and retry.",
};
const SCRIPT_CASES: ScriptCase[] = [
  {
    args: () => ["test-rg", "test-aks", "test-context"],
    name: "cluster-snapshot.sh",
    path: join(SCRIPT_ROOT, "cluster-snapshot.sh"),
  },
  {
    args: artifactsDir => [
      "test-namespace",
      "test-pod",
      "test-rg",
      "test-aks",
      "test-context",
      artifactsDir,
    ],
    name: "pod-deep-dive.sh",
    path: join(SCRIPT_ROOT, "pod-deep-dive.sh"),
  },
];

let testDir: string | undefined;

function createTestDir(): string {
  testDir = mkdtempSync(join(tmpdir(), "aks-troubleshooting-scripts-"));
  return testDir;
}

function writeExecutable(path: string, content: string): void {
  writeFileSync(path, content);
  chmodSync(path, 0o755);
}

function createRequiredToolStubs(binDir: string, missing?: string): void {
  for (const tool of REQUIRED_TOOLS) {
    if (tool === missing) {
      continue;
    }
    writeExecutable(
      join(binDir, tool),
      "#!/bin/sh\nprintf '%s\\n' \"$0 $*\" >> \"$ACTIVITY_LOG\"\nexit 0\n",
    );
  }
}

function createFunctionalToolStubs(binDir: string): void {
  writeExecutable(
    join(binDir, "az"),
    [
      "#!/bin/sh",
      "printf '%s\\n' \"az $*\" >> \"$ACTIVITY_LOG\"",
      "printf '%s\\n' '{\"fqdn\":\"test-aks.example\",\"privateFqdn\":\"\",\"provisioningState\":\"Succeeded\",\"powerState\":{\"code\":\"Running\"},\"kubernetesVersion\":\"1.33.0\",\"networkProfile\":{\"networkPlugin\":\"azure\",\"networkPolicy\":\"cilium\"},\"agentPoolProfiles\":[]}'",
      "",
    ].join("\n"),
  );
  writeExecutable(
    join(binDir, "kubectl"),
    [
      "#!/bin/sh",
      "printf '%s\\n' \"kubectl $*\" >> \"$ACTIVITY_LOG\"",
      "case \" $* \" in",
      "  *' config view '*) printf '%s\\n' \"${MOCK_KUBE_SERVER:-https://test-aks.example:443}\" ;;",
      "  *' logs '*) printf '%s\\n' 'token=supersecret' ;;",
      "  *' -o json '*) printf '%s\\n' '{\"items\":[],\"spec\":{\"containers\":[]}}' ;;",
      "  *) printf '%s\\n' 'mock kubectl output' ;;",
      "esac",
      "",
    ].join("\n"),
  );
  writeExecutable(
    join(binDir, "jq"),
    [
      "#!/bin/sh",
      "printf '%s\\n' \"jq $*\" >> \"$ACTIVITY_LOG\"",
      "input=$(/bin/cat)",
      "case \"$*\" in",
      "  *'.fqdn // empty'*) printf '%s\\n' 'test-aks.example' ;;",
      "  *'.privateFqdn // empty'*) : ;;",
      "  *) printf '%s\\n' \"$input\" ;;",
      "esac",
      "",
    ].join("\n"),
  );
}

afterEach(() => {
  if (testDir) {
    rmSync(testDir, { recursive: true, force: true });
    testDir = undefined;
  }
});

describe("AKS troubleshooting script preflight", () => {
  it.each(
    SCRIPT_CASES.flatMap(script =>
      REQUIRED_TOOLS.map(tool => ({ script, tool })),
    ),
  )("$script.name reports missing $tool before resource or artifact activity", ({ script, tool }) => {
    const root = createTestDir();
    const binDir = join(root, "bin");
    const activityLog = join(root, "activity.log");
    const artifactsDir = join(root, "artifacts");
    mkdirSync(binDir);
    createRequiredToolStubs(binDir, tool);

    const result = spawnSync("/bin/sh", [script.path, ...script.args(artifactsDir)], {
      encoding: "utf8",
      env: {
        ...process.env,
        ACTIVITY_LOG: activityLog,
        PATH: binDir,
      },
    });

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(2);
    expect(result.stderr.trim()).toBe(EXPECTED_ERRORS[tool]);
    expect(existsSync(activityLog)).toBe(false);
    expect(existsSync(artifactsDir)).toBe(false);
  });

  it.each(SCRIPT_CASES)("$name preserves successful target proof", script => {
    const root = createTestDir();
    const binDir = join(root, "bin");
    const activityLog = join(root, "activity.log");
    const artifactsDir = join(root, "artifacts");
    mkdirSync(binDir);
    createFunctionalToolStubs(binDir);

    const result = spawnSync("/bin/sh", [script.path, ...script.args(artifactsDir)], {
      encoding: "utf8",
      env: {
        ...process.env,
        ACTIVITY_LOG: activityLog,
        PATH: `${binDir}:${process.env.PATH ?? ""}`,
      },
    });

    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      "targetProof=matched cluster=test-rg/test-aks context=test-context",
    );
    expect(readFileSync(activityLog, "utf8")).toContain("az aks show");
    expect(readFileSync(activityLog, "utf8")).toContain("kubectl --context test-context");
    if (script.name === "pod-deep-dive.sh") {
      expect(result.stdout).toContain("token=[REDACTED]");
    }
  });

  it.each(SCRIPT_CASES)("$name preserves target mismatch rejection", script => {
    const root = createTestDir();
    const binDir = join(root, "bin");
    const activityLog = join(root, "activity.log");
    const artifactsDir = join(root, "artifacts");
    mkdirSync(binDir);
    createFunctionalToolStubs(binDir);

    const result = spawnSync("/bin/sh", [script.path, ...script.args(artifactsDir)], {
      encoding: "utf8",
      env: {
        ...process.env,
        ACTIVITY_LOG: activityLog,
        MOCK_KUBE_SERVER: "https://different-cluster.example:443",
        PATH: `${binDir}:${process.env.PATH ?? ""}`,
      },
    });

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(2);
    expect(result.stderr.trim()).toBe(
      "kube context does not target the named AKS cluster",
    );
    expect(result.stdout).not.toContain("targetProof=matched");
  });
});
