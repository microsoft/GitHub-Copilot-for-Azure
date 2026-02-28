<#
.SYNOPSIS
    Installs MSBench CLI and runs a Copilot Azure benchmark.

.DESCRIPTION
    This script runs in Azure DevOps under an AzureCLI@2 task with federated authentication.
    It acquires an Azure DevOps AAD token from the already-authenticated az CLI session,
    constructs an authenticated pip index URL, installs MSBench CLI from the
    MicrosoftSweBench Azure Artifacts feed, and invokes:
    msbench-cli run --agent github-copilot-cli --benchmark <benchmark> --model <model>

    MSBench CLI reference:
    - https://github.com/devdiv-microsoft/MicrosoftSweBench/wiki

.PARAMETER Benchmark
    Benchmark identifier. Default: azure

.PARAMETER Model
    Model identifier. Default: claude-sonnet-4.5-autodev-test

.PARAMETER NoWait
    Whether to add --no-wait to the run command.

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

    if ([string]::IsNullOrWhiteSpace($Benchmark)) {
        throw "Benchmark parameter is required."
    }

    if ([string]::IsNullOrWhiteSpace($Model)) {
        throw "Model parameter is required."
    }

    $vaultName = "kv-msbench-eval-azuremcp"
    $secretName = "azure-eval-gh-pat"

    Write-Host "Benchmark: $Benchmark"
    Write-Host "Model: $Model"
    Write-Host "NoWait: $NoWait"

    # --- Retrieve GitHub PAT from KeyVault ---
    try {
        Write-Host "Retrieving GitHub PAT from KeyVault $vaultName secret $secretName"
        $pat = az keyvault secret show --vault-name $vaultName --name $secretName --query value -o tsv
        if ([string]::IsNullOrWhiteSpace($pat)) {
            throw "Secret $secretName not found in KeyVault $vaultName."
        }
        $env:GITHUB_MCP_SERVER_TOKEN = $pat
        
        # Log the PAT as a secret variable to avoid exposing it in logs
        Write-Host "##vso[task.setsecret]$pat"
    }
    catch {
        throw "Failed to retrieve GitHub PAT from KeyVault: $_"
    }

    # --- Authenticate to Azure DevOps Artifacts feed via AAD token ---
    Write-Host "Acquiring Azure DevOps AAD token for feed authentication"
    $adoResourceId = "499b84ac-1321-427f-aa17-267ca6975798"
    $adoAccessToken = az account get-access-token --resource $adoResourceId --query accessToken -o tsv

    # Log the token as a secret variable to avoid exposing it in logs
    Write-Host "##vso[task.setsecret]$adoAccessToken"

    if (!$adoAccessToken) {
        throw "Failed to acquire Azure DevOps AAD access token. Ensure the AzureCLI@2 task has a valid service connection."
    }

    $encodedToken = [System.Uri]::EscapeDataString($adoAccessToken)
    $indexUrl = "https://vsts:$encodedToken@pkgs.dev.azure.com/devdiv/_packaging/MicrosoftSweBench/pypi/simple/"
    Write-Host "Authenticated pip index URL constructed."

    $pythonCommand = Get-Command python
    Write-Host "Using python from: $($pythonCommand.Path). Version: $(python --version)"

    Write-Host "Install/upgrade pip"
    python -m pip install --upgrade pip

    Write-Host "Checking MSBench CLI versions from feed"
    python -m pip index versions msbench-cli --no-input --index-url $indexUrl

    Write-Host "Installing/upgrading MSBench CLI"
    python -m pip install --upgrade msbench-cli --no-input --index-url $indexUrl

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
    & 'msbench-cli' @runArgs

    if ($LASTEXITCODE -ne 0) {
        throw "msbench-cli run failed with exit code $LASTEXITCODE"
    }
