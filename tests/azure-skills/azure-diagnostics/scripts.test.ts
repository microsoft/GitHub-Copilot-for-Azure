import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const scriptsDirectory = fileURLToPath(new URL(
  "../../../plugins/azure-skills/skills/azure-diagnostics/scripts/",
  import.meta.url,
));

const scriptNames = [
  "aks-baseline",
  "appservice-diagnostics",
  "containerapp-diagnostics",
  "pod-evidence",
  "run-ig",
  "test-messaging-connectivity",
] as const;

const azureScriptNames = [
  "aks-baseline",
  "appservice-diagnostics",
  "containerapp-diagnostics",
] as const;

const readOnlyScriptNames = scriptNames.filter(name => name !== "run-ig");
type AzureScriptName = typeof azureScriptNames[number];

function readScript(name: string, extension: "sh" | "ps1"): string {
  return fs.readFileSync(`${scriptsDirectory}/${name}.${extension}`, "utf8");
}

function runWithStubbedCommands(name: AzureScriptName, exitCode: number) {
  const bashStubDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "diagnostics-bash-stubs-"),
  );
  const powershellStubDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "diagnostics-powershell-stubs-"),
  );
  const bashStub = "#!/usr/bin/env bash\nexit \"${STUB_EXIT_CODE:-0}\"\n";
  const cmdStub = "@exit /b %STUB_EXIT_CODE%\r\n";
  for (const command of ["az", "kubectl"]) {
    fs.writeFileSync(
      path.join(bashStubDirectory, command),
      bashStub,
      { mode: 0o755 },
    );
    const powershellStub = path.join(powershellStubDirectory, command);
    if (process.platform === "win32") {
      fs.writeFileSync(`${powershellStub}.cmd`, cmdStub);
    } else {
      fs.writeFileSync(powershellStub, bashStub, { mode: 0o755 });
    }
  }

  const bashArgs = name === "aks-baseline"
    ? ["-g", "test-rg", "-n", "test-cluster"]
    : ["--name", "test-app", "--resource-group", "test-rg"];
  const powershellArgs = name === "aks-baseline"
    ? ["-ResourceGroup", "test-rg", "-Cluster", "test-cluster"]
    : ["-Name", "test-app", "-ResourceGroup", "test-rg"];
  const commonEnv = {
    ...process.env,
    STUB_EXIT_CODE: `${exitCode}`,
  };
  const toBashPath = (value: string) => process.platform === "win32"
    ? value
      .replace(/^([A-Za-z]):/, (_, drive: string) => `/${drive.toLowerCase()}`)
      .replaceAll("\\", "/")
    : value;
  const bashPath = process.platform === "win32"
    ? `${toBashPath(bashStubDirectory)}:/usr/bin:/bin`
    : `${bashStubDirectory}:${process.env.PATH ?? ""}`;
  const bashEnv = { ...commonEnv, PATH: bashPath };
  const powershellEnv = {
    ...commonEnv,
    PATH: `${powershellStubDirectory}${path.delimiter}${process.env.PATH ?? ""}`,
  };

  try {
    const bashExecutable = process.platform === "win32"
      ? path.join(process.env.ProgramFiles ?? "C:\\Program Files", "Git", "bin", "bash.exe")
      : "bash";
    const bash = spawnSync(
      bashExecutable,
      [toBashPath(`${scriptsDirectory}/${name}.sh`), ...bashArgs],
      { encoding: "utf8", env: bashEnv },
    );
    const powershell = process.platform === "win32" ? "powershell" : "pwsh";
    const ps = spawnSync(
      powershell,
      ["-NoProfile", "-File", `${scriptsDirectory}/${name}.ps1`, ...powershellArgs],
      { encoding: "utf8", env: powershellEnv },
    );
    return { bash, powershell: ps };
  } finally {
    fs.rmSync(bashStubDirectory, { recursive: true, force: true });
    fs.rmSync(powershellStubDirectory, { recursive: true, force: true });
  }
}

describe("Azure Diagnostics script contracts", () => {
  test.each(scriptNames)("%s ships paired Bash and PowerShell scripts", (name) => {
    const bash = readScript(name, "sh");
    const powershell = readScript(name, "ps1");

    expect(bash).toMatch(/^#!\/usr\/bin\/env bash/);
    expect(bash).toMatch(/set -[a-z]*uo pipefail/);
    expect(bash).not.toMatch(/\beval\s/);
    expect(powershell).not.toContain("[Parameter(Mandatory");
  });

  test.each(readOnlyScriptNames)("%s remains read-only", (name) => {
    const scripts = `${readScript(name, "sh")}\n${readScript(name, "ps1")}`;
    const mutatingCommand =
      /\b(?:kubectl\s+(?:apply|create|debug|delete|patch|replace|scale|set|taint|label|annotate|edit|drain|cordon|uncordon)|az\s+\S+(?:\s+\S+)?\s+(?:create|update|delete|set))\b/i;

    expect(scripts).not.toMatch(mutatingCommand);
  });

  test("run-ig explicitly marks and previews its privileged operation", () => {
    const bash = readScript("run-ig", "sh");
    const powershell = readScript("run-ig", "ps1");

    expect(bash).toContain("requires explicit user approval");
    expect(bash).toContain("kubectl debug --profile=sysadmin");
    expect(bash).toContain("--dry-run");
    expect(powershell).toContain("requires explicit user approval");
    expect(powershell).toContain("'debug', '--profile=sysadmin'");
    expect(powershell).toContain("[switch]$DryRun");
  });

  test.each(azureScriptNames)("%s forwards an explicit subscription", (name) => {
    const bash = readScript(name, "sh");
    const powershell = readScript(name, "ps1");

    expect(bash).toContain("--subscription");
    expect(powershell).toContain("--subscription");
  });

  test.each(azureScriptNames)("%s uses the documented argument-error contract", (name) => {
    const bash = readScript(name, "sh");
    const powershell = readScript(name, "ps1");

    expect(bash).toContain("Exit codes: 0 = completed, 1 = collection failure, 2 = invalid arguments.");
    expect(bash).toMatch(/-h\|--help\).+(?:exit|usage) 0/);
    expect(bash).toMatch(/(?:Unknown|unknown).+(?:exit|usage) 2/s);
    expect(powershell).toContain("Exit codes: 0 = completed, 1 = collection failure, 2 = invalid arguments.");
    expect(powershell).toMatch(/(?:Usage|Missing required)[\s\S]+exit 2|Show-Usage 2/);
  });

  test.each(azureScriptNames)("%s reports native collection failures", (name) => {
    const result = runWithStubbedCommands(name, 1);
    expect(result.bash.status).toBe(1);
    expect(result.powershell.status).toBe(1);
  });

  test.each(azureScriptNames)("%s exits zero after successful collection", (name) => {
    const result = runWithStubbedCommands(name, 0);
    expect(result.bash.status).toBe(0);
    expect(result.powershell.status).toBe(0);
  });
});
