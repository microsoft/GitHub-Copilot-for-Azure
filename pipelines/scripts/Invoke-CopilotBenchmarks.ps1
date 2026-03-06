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
        [string]$Benchmark = "azure.list_subscription",
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
    # $msbenchRepo = "https://devdiv@dev.azure.com/devdiv/OnlineServices/_git/msbench-benchmarks"
    # $repoName = "msbench-benchmarks"
    $msbenchRepo = "https://github.com/microsoft/mcp-pr.git"
    $repoName = "mcp-pr"

    $cloneDir = Join-Path $PWD $repoName

    Write-Host "Cloning $msbenchRepo into $cloneDir"
    git clone --depth 1 $msbenchRepo $cloneDir
    if ($LASTEXITCODE -ne 0) {
        throw "git clone failed with exit code $LASTEXITCODE"
    }
    
    Write-Host "Checking out branch add_msbench_model_mapping in $cloneDir" 
    Set-Location $cloneDir
    git checkout add_msbench_model_mapping
    if ($LASTEXITCODE -ne 0) {
        throw "git checkout failed with exit code $LASTEXITCODE"
    }

    $targetDir = Join-Path $cloneDir "model_mapping"
    if (!(Test-Path $targetDir)) {
        throw "Working directory '$targetDir' does not exist after clone."
    }

    Write-Host "Changing directory to $targetDir"
    Set-Location $targetDir

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
