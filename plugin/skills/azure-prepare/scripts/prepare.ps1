#requires -Version 7.0
<#
.SYNOPSIS
    State-machine driver for the azure-prepare skill.

.DESCRIPTION
    Drives the "prepare an app for Azure deployment" workflow as a deterministic
    state machine. The script owns <RepoPath>/.azure-prepare/prepare-info.json and
    advances the workflow as far as it can PROGRAMMATICALLY on each invocation. When
    it needs information only the language model (LM) can provide, it writes null
    placeholder keys under `input.*`, prints a NEXT ACTION block describing exactly
    what to collect, and exits. The LM fills the keys and re-runs the script. The
    cycle repeats until the script prints a COMPLETE block.

.PARAMETER RepoPath
    Path to the repository / workspace root being prepared for Azure.

.EXAMPLE
    pwsh ./prepare.ps1 -RepoPath /path/to/repo
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$RepoPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
if (-not (Test-Path -LiteralPath $RepoPath)) {
    throw "RepoPath does not exist: $RepoPath"
}
$RepoPath  = (Resolve-Path -LiteralPath $RepoPath).Path
$StateDir  = Join-Path $RepoPath '.azure-prepare'
$StateFile = Join-Path $StateDir 'prepare-info.json'
$SchemaVersion = 1

# ---------------------------------------------------------------------------
# Load library modules (dot-sourced; they only define functions/data).
# ---------------------------------------------------------------------------
. "$PSScriptRoot/lib/state.ps1"
. "$PSScriptRoot/lib/collect.ps1"
. "$PSScriptRoot/lib/plan.ps1"
. "$PSScriptRoot/lib/refs.ps1"
. "$PSScriptRoot/lib/steps.ps1"
. "$PSScriptRoot/lib/output.ps1"

# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------
$State = Get-State
Invoke-AutoCollect -State $State

foreach ($step in $Steps) {
    $id = $step.id
    if (-not $State['steps'].ContainsKey($id)) { $State['steps'][$id] = 'pending' }
    if ($State['steps'][$id] -eq 'done') { continue }

    # Run the step's auto collector (may satisfy needs programmatically).
    if ($step.ContainsKey('auto') -and $step.auto) { & $step.auto $State }

    # Determine missing needs.
    $missing = @()
    foreach ($n in @($step.needs)) {
        if (-not (Test-Provided $State $n.Path)) { $missing += $n }
    }

    if ($missing.Count -gt 0) {
        Write-NextAction -State $State -Step $step -Missing $missing
        return
    }

    # All needs satisfied — finalize the step.
    if ($step.ContainsKey('onDone') -and $step.onDone) { & $step.onDone $State }
    $State['steps'][$id] = 'done'
    Save-State $State
}

Write-Complete -State $State
