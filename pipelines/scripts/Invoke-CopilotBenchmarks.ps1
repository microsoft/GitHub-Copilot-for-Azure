<#
.SYNOPSIS
    Installs MSBench CLI and runs a Copilot Azure benchmark.

.DESCRIPTION
    This script runs in Azure DevOps under an AzureCLI@2 task with federated authentication.
    Feed authentication is handled by a preceding PipAuthenticate@1 task that sets
    PIP_EXTRA_INDEX_URL for the azure-sdk/internal/MicrosoftSweBench feed.
    The script retrieves a GitHub PAT from KeyVault, installs MSBench CLI, and invokes:
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

    if (!$Benchmark) {
        throw "Benchmark parameter is required."
    }

    if (!$Model) {
        throw "Model parameter is required."
    }

    $vaultName = "kv-msbench-eval-azuremcp"
    $secretName = "azure-eval-gh-pat"

    Write-Host "Benchmark: $Benchmark"
    Write-Host "Model: $Model"
    Write-Host "NoWait: $NoWait"

    $pipelineRun = $env:TF_BUILD -eq "True"

    # --- Retrieve GitHub PAT from KeyVault ---
    try {
        Write-Host "Retrieving GitHub PAT from KeyVault $vaultName secret $secretName"
        $pat = az keyvault secret show --vault-name $vaultName --name $secretName --query value -o tsv

        if (!$pat) {
            throw "Secret $secretName not found in KeyVault $vaultName."
        }

        $env:GITHUB_MCP_SERVER_TOKEN = $pat
        
        # Log the PAT as a secret variable to avoid exposing it in logs
        if ($pipelineRun) {
            Write-Host "##vso[task.setsecret]$pat"
        }
    }
    catch {
        throw "Failed to retrieve GitHub PAT from KeyVault: $_"
    }

    # --- Feed authentication ---
    # In CI, PipAuthenticate@1 sets PIP_EXTRA_INDEX_URL automatically.
    # For local runs, fall back to az CLI token acquisition.
    if ($env:PIP_EXTRA_INDEX_URL) {
        Write-Host "PIP_EXTRA_INDEX_URL is set (feed auth configured by PipAuthenticate task). Forwarding to UV_EXTRA_INDEX_URL for MSBench CLI."
        $env:UV_EXTRA_INDEX_URL = $env:PIP_EXTRA_INDEX_URL
    } else {
        Write-Host "PIP_EXTRA_INDEX_URL not set — acquiring Azure DevOps AAD token for local feed auth"
        $feedUrl = "https://pkgs.dev.azure.com/azure-sdk/internal/_packaging/MicrosoftSweBench/pypi/simple/"
        $adoResourceId = "499b84ac-1321-427f-aa17-267ca6975798"
        $adoAccessToken = az account get-access-token --resource $adoResourceId --query accessToken -o tsv

        if (!$adoAccessToken) {
            throw "Failed to acquire Azure DevOps AAD token. Run 'az login' first."
        }

        $encodedToken = [System.Uri]::EscapeDataString($adoAccessToken)
        $env:UV_EXTRA_INDEX_URL = $feedUrl -replace "https://", "https://vsts:$encodedToken@"
        Write-Host "UV_EXTRA_INDEX_URL set via az CLI token"
    }


    Write-Host "`n> uv pip install msbench-cli"
    uv pip install msbench-cli
    if ($LASTEXITCODE -ne 0) {
        throw "uv pip install msbench-cli failed with exit code $LASTEXITCODE"
    }

    Write-Host "`n> uv run 'msbench-cli' version"
    uv run 'msbench-cli' version
    if ($LASTEXITCODE -ne 0) {
        throw "uv run msbench-cli failed with exit code $LASTEXITCODE"
    }
    
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

    Write-Host "`n> msbench-cli $($runArgs -join ' ')"
    uv run 'msbench-cli' @runArgs
    if ($LASTEXITCODE -ne 0) {
        throw "msbench-cli run failed with exit code $LASTEXITCODE"
    }
