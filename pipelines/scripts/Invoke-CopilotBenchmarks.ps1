<#
.SYNOPSIS
    Installs MSBench CLI in a local virtual environment and runs a Copilot Azure benchmark.

.DESCRIPTION
    This script is executed by the Azure DevOps benchmark pipeline to run a single Azure benchmark
    instance using the github-copilot-cli agent.

    The script creates a Python virtual environment in the working directory, installs MSBench CLI
    from the MicrosoftSweBench Azure Artifacts feed, validates required inputs, and invokes:
    msbench-cli run --agent github-copilot-cli --benchmark <benchmark> --model <model>

    Required environment variable:
    - GITHUB_MCP_SERVER_TOKEN

    MSBench CLI reference:
    - https://github.com/devdiv-microsoft/MicrosoftSweBench/wiki

.PARAMETER Benchmark
    Benchmark identifier

.PARAMETER Model
    Model name passed to msbench-cli via --model.
    Default: claude-sonnet-4.5-autodev-test

.PARAMETER NoWait
    Whether to add --no-wait to the run command.
    Accepted values: "true" or "false" (case-insensitive).
    Default: true

.EXAMPLE
    PS> ./Invoke-CopilotBenchmarks.ps1

    Runs benchmark azure with default model and --no-wait.

.EXAMPLE
    PS> ./Invoke-CopilotBenchmarks.ps1 -BenchmarkInstanceId azure.120 -Model "claude-sonnet-4.5-autodev-test" -NoWait "false"

    Runs benchmark azure.120 with explicit model and waits for completion.

.NOTES
    The pipeline must provide GITHUB_MCP_SERVER_TOKEN and ensure Python is available.

.LINK
    https://github.com/devdiv-microsoft/MicrosoftSweBench/wiki
#>

param(
    [string]$Benchmark = "azure",
    [string]$Model = "claude-sonnet-4.5-autodev-test",
    [switch]$NoWait
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"


if (!$Benchmark) {
    throw "Benchmark parameter is required."
}

if (!$Model) {
    throw "Model parameter is required."
}

$indexUrl = "https://pkgs.dev.azure.com/devdiv/_packaging/MicrosoftSweBench/pypi/simple/"
$vaultName = "kv-msbench-eval-azuremcp"
$secretName = "azure-eval-gh-pat"

# pull the azure-eval-gh-pat secret from KeyVault using Azure CLI
try {
    Write-Host "Retrieving GitHub PAT from KeyVault $vaultName secret $secretName"
    $pat = az keyvault secret show --vault-name $vaultName --name $secretName --query value -o tsv
    if (!$pat) {
        throw "Secret $secretName not found in KeyVault $vaultName."
    }

    $env:GITHUB_MCP_SERVER_TOKEN = $pat
}
catch {
    throw "Failed to retrieve GitHub PAT from KeyVault: $_"
}

Write-Host "Benchmark: $Benchmark"
Write-Host "Model: $Model"
Write-Host "NoWait: $NoWait"

$pythonCommand = Get-Command python
Write-Host "Using python from: $($pythonCommand.Path). Version: $(python --version)"

Write-Host "Install/upgrade pip"
python -m pip install --upgrade pip

Write-Host "Installing artifact authentication dependencies"
python -m pip install keyring artifacts-keyring

Write-Host "Checking MSBench CLI versions from feed"
python -m pip index versions msbench-cli --index-url $indexUrl

Write-Host "Installing/upgrading MSBench CLI"
python -m pip install --upgrade msbench-cli --index-url $indexUrl

Write-Host "MSBench CLI version"
& 'msbench-cli' version

$runArgs = @(
    "run",
    "--agent", "github-copilot-cli",
    "--benchmark", $Benchmark,
    "--model", $Model,
    "--env", "GITHUB_MCP_SERVER_TOKEN"
)

if ($NoWait) {
    $runArgs += "--no-wait"
}

Write-Host "Running: msbench-cli $($runArgs -join ' ')"
#msbench-cli @runArgs

if ($LASTEXITCODE -ne 0) {
    throw "msbench-cli run failed with exit code $LASTEXITCODE"
}
