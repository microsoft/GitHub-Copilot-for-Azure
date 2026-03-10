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
    One or more model identifiers to benchmark.

.PARAMETER NoWait
    Whether to add --no-wait to the run command.

.LINK
    https://github.com/devdiv-microsoft/MicrosoftSweBench/wiki
#>

    param(
        [string]$Benchmark = "azure",
        [string[]]$Model = @(
            "claude-sonnet-4.5-autodev-test",
            "claude-opus-4.5-autodev-test",
            "gpt-5.2-codex-autodev-test",
            "gpt-5.2-autodev-test",
            "gemini-2.5-pro-autodev-test"
        ),
        [switch]$NoWait
    )

    Set-StrictMode -Version Latest
    $ErrorActionPreference = "Stop"

    if (!$Benchmark) {
        throw "Benchmark parameter is required."
    }

    if (!$Model -or $Model.Count -eq 0) {
        throw "Model parameter is required."
    }

    $vaultName = "kv-msbench-eval-azuremcp"
    $secretName = "azure-eval-gh-pat"

    Write-Host "Benchmark: $Benchmark"
    Write-Host "Models: $($Model -join ', ')"
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

    # --- Feed auth is handled by the PipAuthenticate@1 pipeline task ---
    # PipAuthenticate sets PIP_EXTRA_INDEX_URL for the azure-sdk/internal/MicrosoftSweBench feed.
    if ($env:PIP_EXTRA_INDEX_URL) {
        Write-Host "PIP_EXTRA_INDEX_URL is set (feed auth configured by PipAuthenticate task)"
    } else {
        Write-Warning "PIP_EXTRA_INDEX_URL is not set. Feed authentication may fail. Ensure PipAuthenticate@1 runs before this script."
    }

    $pythonCommand = Get-Command python
    Write-Host "Using python from: $($pythonCommand.Path). Version: $(python --version 2>&1)"

    Write-Host "Install/upgrade pip"
    python -m pip install --upgrade pip
    if ($LASTEXITCODE -ne 0) {
        throw "pip install/upgrade failed with exit code $LASTEXITCODE"
    }

    Write-Host "Installing/upgrading MSBench CLI"
    python -m pip install msbench-cli --no-input
    if ($LASTEXITCODE -ne 0) {
        throw "pip install msbench-cli failed with exit code $LASTEXITCODE"
    }

    Write-Host "MSBench CLI version"
    & 'msbench-cli' version
    if ($LASTEXITCODE -ne 0) {
        throw "msbench-cli version failed with exit code $LASTEXITCODE"
    }

    # --- Clone repo and cd to working directory ---
    $msbenchRepo = "https://devdiv@dev.azure.com/devdiv/OnlineServices/_git/msbench-benchmarks"
    $repoName = "msbench-benchmarks"

    $cloneDir = Join-Path $PWD $repoName

    Write-Host "Cloning $msbenchRepo into $cloneDir"
    git -c http.extraheader="AUTHORIZATION: bearer $(az account get-access-token --resource 499b84ac-1321-427f-aa17-267ca6975798 --query accessToken -o tsv)" `
        clone --depth 1 $msbenchRepo $cloneDir
    if ($LASTEXITCODE -ne 0) {
        throw "git clone failed with exit code $LASTEXITCODE"
    }

    Write-Host "Checking out branch main in $cloneDir" 
    Set-Location $cloneDir
    git checkout main
    if ($LASTEXITCODE -ne 0) {
        throw "git checkout failed with exit code $LASTEXITCODE"
    }

    $targetDir = Join-Path $cloneDir "curation/benchmarks/azure"
    if (!(Test-Path $targetDir)) {
        throw "Working directory '$targetDir' does not exist after clone."
    }

    Write-Host "Changing directory to $targetDir"
    Set-Location $targetDir

    $failedModels = @()

    foreach ($m in $Model) {
        Write-Host "`n=== Running benchmark for model: $m ==="

        $runArgs = @(
            "run",
            "--agent", "github-copilot-cli",
            "--benchmark", $Benchmark,
            "--model", $m,
            "--env", "GITHUB_MCP_SERVER_TOKEN"
        )

        if ($NoWait) {
            $runArgs += "--no-wait"
        }

        Write-Host "Running: msbench-cli $($runArgs -join ' ')"
        & 'msbench-cli' @runArgs

        if ($LASTEXITCODE -ne 0) {
            Write-Warning "msbench-cli run failed for model '$m' with exit code $LASTEXITCODE"
            $failedModels += $m
        }
    }

    if ($failedModels.Count -gt 0) {
        throw "msbench-cli run failed for models: $($failedModels -join ', ')"
    }

    Write-Host "`nAll $($Model.Count) model runs completed successfully."
