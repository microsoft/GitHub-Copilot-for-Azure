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

function runWithStubbedCommands(name: AzureScriptName, exitCode: number, failCommand = "") {
  const bashStubDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "diagnostics-bash-stubs-"),
  );
  const powershellStubDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "diagnostics-powershell-stubs-"),
  );
  const bashStub = `#!/usr/bin/env bash
printf '%s\\n' "$*" >&2
if [[ -z "$STUB_FAIL_COMMAND" || "$*" == "$STUB_FAIL_COMMAND"* ]]; then
  exit "$STUB_EXIT_CODE"
fi
exit 0
`;
  const cmdStub = [
    "@echo off",
    "echo %* >&2",
    'if "%STUB_FAIL_COMMAND%"=="" exit /b %STUB_EXIT_CODE%',
    'echo %* | findstr /b /l /c:"%STUB_FAIL_COMMAND%" >nul',
    "if not errorlevel 1 exit /b %STUB_EXIT_CODE%",
    "exit /b 0",
    "",
  ].join("\r\n");
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
  bashArgs.push("--subscription", "test-sub");
  powershellArgs.push("-Subscription", "test-sub");
  const commonEnv = {
    ...process.env,
    STUB_EXIT_CODE: `${exitCode}`,
    STUB_FAIL_COMMAND: failCommand,
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

  test("App Service uses the supported command and accepts empty deployment history", () => {
    const result = runWithStubbedCommands("appservice-diagnostics", 0);
    for (const shell of Object.values(result)) {
      expect(shell.status).toBe(0);
      expect(shell.stderr).toMatch(
        /webapp log deployment list -n test-app -g test-rg --subscription test-sub --query "?\[:3\]\.\{id:id, status:status, time:end_time\}"? -o table/,
      );
      expect(shell.stdout).toContain("=== Diagnostics collection complete for test-app ===");
      expect(shell.stdout).not.toContain("=== Diagnostics collection incomplete for test-app ===");
    }
  });

  test.each([
    ["app config", "webapp show", "(failed to read app config)"],
    ["deployments", "webapp log deployment list", "(failed to list deployments)"],
    ["app settings", "webapp config appsettings list", "(failed to list app settings)"],
    ["custom domains", "webapp config hostname list", "(failed to list custom domains)"],
    ["all sections", "", "(failed to list deployments)"],
  ])("App Service reports incomplete collection when %s fails", (_, failCommand, failureMessage) => {
    const result = runWithStubbedCommands("appservice-diagnostics", 1, failCommand);
    for (const shell of Object.values(result)) {
      expect(shell.status).toBe(1);
      expect(shell.stdout).toContain("=== Diagnostics collection incomplete for test-app ===");
      expect(shell.stdout).not.toContain("=== Diagnostics collection complete for test-app ===");
      expect(shell.stderr).toContain(failureMessage);
      expect(shell.stderr).toMatch(
        /webapp show[\s\S]*webapp log deployment list[\s\S]*webapp config appsettings list[\s\S]*webapp config hostname list/,
      );
    }
  });
});
