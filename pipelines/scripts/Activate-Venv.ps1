<#!
.SYNOPSIS
Activates a virtual environment for a CI machine. Any further usages of "python" will utilize this virtual environment.

.DESCRIPTION
When activating a virtual environment, only a few things are actually functionally changed on the machine.

# 1. PATH = path to the bin directory of the virtual env. "Scripts" on windows machines
# 2. VIRTUAL_ENV = path to root of the virtual env
# 3. VIRTUAL_ENV_PROMPT = the prompt that is displayed next to the CLI cursor when the virtual env is active
# within a CI machine, we only need the PATH and VIRTUAL_ENV variables to be set.
# 4. (optional and inconsistently) _OLD_VIRTUAL_PATH = the PATH before the virtual env was activated. This is not set in this script.

.PARAMETER VenvName
The name of the virtual environment to activate.

.PARAMETER RepoRoot
The root of the repository.
#>
param (
    [string]$VenvName = "venv"
)

Set-StrictMode -Version 4
$ErrorActionPreference = "Stop"

$repoRoot = Join-Path $PSScriptRoot ".." ".." -Resolve
$venvPath = Join-Path $repoRoot $VenvName
$pipelineRun = $env:TF_BUILD -eq "True"

if (-not (Test-Path $venvPath)) {
    Write-Error "Virtual environment '$venvPath' does not exist at $venvPath"
    exit 1
}

Write-Host "Activating virtual environment '$VenvName' via VIRTUAL_ENV variable at $venvPath.'"
$env:VIRTUAL_ENV = $venvPath
if ($pipelineRun) {
    Write-Host "##vso[task.setvariable variable=VIRTUAL_ENV]$($env:VIRTUAL_ENV)"
}

$venvBinPath = $IsWindows ? (Join-Path $venvPath "Scripts") : (Join-Path $venvPath "bin")

Write-Host "Prepending path with $venvBinPath"
$env:PATH = $IsWindows ? "$venvBinPath;$($env:PATH)" : "$venvBinPath`:$($env:PATH)"
if ($pipelineRun) {
    Write-Host "##vso[task.prependpath]$venvBinPath"
}

if ($pipelineRun) {
    Write-Host "Unset of PYTHONHOME"
    Write-Host "##vso[task.setvariable variable=PYTHONHOME]"
}
