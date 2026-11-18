import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const skill = path.basename(path.dirname(fileURLToPath(import.meta.url)));
const scripts = fileURLToPath(new URL(`../../../plugins/azure-skills/skills/${skill}/scripts/`, import.meta.url));
const bash = process.platform === "win32"
  ? path.join(process.env.ProgramFiles ?? "C:\\Program Files", "Git", "bin", "bash.exe")
  : "bash";
const ps = process.platform === "win32" ? "powershell" : "pwsh";
const quotePS = (value: string) => `'${value.replaceAll("'", "''")}'`;
const bashPath = (value: string) => process.platform === "win32"
  ? value.replace(/^([A-Za-z]):/, (_, drive: string) => `/${drive.toLowerCase()}`).replaceAll("\\", "/")
  : value;

function run(shell: "bash" | "powershell", show: number, failures: number, error: string, missing = false) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "appservice-retry-"));
  const calls = path.join(temp, "calls");
  const delays = path.join(temp, "delays");
  const marker = path.join(temp, "injected");
  const payload = shell === "bash"
    ? 'rg; touch "$RETRY_MARKER"; $(touch "$RETRY_MARKER")'
    : 'rg; Set-Content "$env:RETRY_MARKER" injected; $(Set-Content "$env:RETRY_MARKER" injected)';
  const env = {
    ...process.env, RETRY_CALLS: shell === "bash" ? bashPath(calls) : calls,
    RETRY_DELAYS: shell === "bash" ? bashPath(delays) : delays,
    RETRY_MARKER: shell === "bash" ? bashPath(marker) : marker,
    RETRY_SHOW: `${show}`, RETRY_FAILURES: `${failures}`, RETRY_ERROR: error,
  };
  const bashDriver = `
az() {
  printf '%s\\n' "$*" >> "$RETRY_CALLS"
  if [ "$2" = show ]; then return "$RETRY_SHOW"; fi
  local count
  count=$(grep -c '^group create ' "$RETRY_CALLS")
  if [ "$count" -le "$RETRY_FAILURES" ]; then printf '%s\\n' "$RETRY_ERROR" >&2; return 1; fi
  return 0
}
sleep() { printf '%s\\n' "$1" >> "$RETRY_DELAYS"; }
source "$1" ${missing ? "" : '--show group show -n "$2" --create group create -n "$2"'}
`;
  const psDriver = `
$global:creates = 0
function global:az {
  Add-Content -LiteralPath $env:RETRY_CALLS -Value ([string]::Join(' ', $args))
  if ($args[1] -eq 'show') { $global:LASTEXITCODE = [int]$env:RETRY_SHOW; return }
  $global:creates++
  $global:LASTEXITCODE = 0
  if ($global:creates -le [int]$env:RETRY_FAILURES) {
    Write-Error $env:RETRY_ERROR -ErrorAction Continue
    $global:LASTEXITCODE = 1
  }
}
function global:Start-Sleep { param($Seconds) Add-Content -LiteralPath $env:RETRY_DELAYS -Value $Seconds }
& ${quotePS(path.join(scripts, "retry-az-create.ps1"))} ${missing ? "" : `-ShowArguments @('group','show','-n',${quotePS(payload)}) -CreateArguments @('group','create','-n',${quotePS(payload)})`}
exit $LASTEXITCODE
`;
  try {
    const result = shell === "bash"
      ? spawnSync(bash, ["-c", bashDriver, "--", bashPath(path.join(scripts, "retry-az-create.sh")), payload], { env, encoding: "utf8" })
      : spawnSync(ps, ["-NoProfile", "-Command", psDriver], { env, encoding: "utf8" });
    expect(result.error).toBeUndefined();
    return {
      status: result.status,
      calls: fs.existsSync(calls) ? fs.readFileSync(calls, "utf8").trim().split(/\r?\n/) : [],
      delays: fs.existsSync(delays) ? fs.readFileSync(delays, "utf8").trim().split(/\r?\n/) : [],
      injected: fs.existsSync(marker), payload,
    };
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

describe.each(["bash", "powershell"] as const)("%s resource creation retries", (shell) => {
  test.each([
    { show: 0, failures: 9, error: "BadRequest", status: 0, calls: 1, delays: [] },
    { show: 1, failures: 0, error: "", status: 0, calls: 2, delays: [] },
    { show: 1, failures: 9, error: "QuotaExceeded: usage 429, limit 429", status: 1, calls: 2, delays: [] },
    { show: 1, failures: 9, error: "AuthorizationFailed: HTTP 503", status: 1, calls: 2, delays: [] },
    { show: 1, failures: 9, error: "HTTP 403: usage 429", status: 1, calls: 2, delays: [] },
    { show: 1, failures: 9, error: "BadRequest", status: 1, calls: 2, delays: [] },
    { show: 1, failures: 2, error: "ServiceUnavailable HTTP 503", status: 0, calls: 6, delays: ["5", "15"] },
    { show: 1, failures: 9, error: "TooManyRequests HTTP 429", status: 1, calls: 6, delays: ["5", "15"] },
  ])("handles $error (show=$show, failures=$failures)", ({ show, failures, error, status, calls, delays }) => {
    const result = run(shell, show, failures, error);
    expect(result.status).toBe(status);
    expect(result.calls).toHaveLength(calls);
    expect(result.delays).toEqual(delays);
    expect(result.calls.every(call => call.includes(result.payload))).toBe(true);
    expect(result.injected).toBe(false);
  });

  test("rejects missing arguments without prompting", () => {
    const result = run(shell, 1, 0, "", true);
    expect(result.status).toBe(2);
  });
});
