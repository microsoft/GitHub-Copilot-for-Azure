import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const scriptsDirectory = fileURLToPath(new URL(
  "../plugins/azure-skills/skills/azure-diagnostics/scripts/",
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

function readScript(name: string, extension: "sh" | "ps1"): string {
  return fs.readFileSync(`${scriptsDirectory}/${name}.${extension}`, "utf8");
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

  test.each(scriptNames)("%s remains read-only", (name) => {
    const scripts = `${readScript(name, "sh")}\n${readScript(name, "ps1")}`;
    const mutatingCommand =
      /\b(?:kubectl\s+(?:apply|create|delete|patch|replace|scale|set|taint|label|annotate|edit|drain|cordon|uncordon)|az\s+\S+(?:\s+\S+)?\s+(?:create|update|delete|set))\b/i;

    expect(scripts).not.toMatch(mutatingCommand);
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
});
