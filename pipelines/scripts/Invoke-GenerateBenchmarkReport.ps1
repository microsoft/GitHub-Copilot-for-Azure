<#
.SYNOPSIS
    Generates benchmark analysis reports for completed MSBench runs using GitHub Copilot.

.DESCRIPTION
    This script runs in Azure DevOps under an AzureCLI@2 task with federated authentication.
    Feed authentication is handled by a preceding PipAuthenticate@1 task that sets
    PIP_EXTRA_INDEX_URL for the azure-sdk/internal/MicrosoftSweBench feed.
    The script retrieves a GitHub PAT from KeyVault, clones the msbench-benchmarks repo,
    installs MSBench CLI, checks the status of existing benchmark runs, and uses GitHub Copilot
    to generate detailed analysis reports for the specified run IDs.

    The script reads run IDs from run_ids.json in the InputPath, generates reports using
    GitHub Copilot CLI, and saves the generated markdown reports to the OutputPath.

.PARAMETER InputPath
    Directory path containing the run_ids.json file with benchmark run IDs to analyze.

.PARAMETER OutputPath
    Directory path where generated benchmark reports will be saved.

    MSBench CLI reference:
    - https://github.com/devdiv-microsoft/MicrosoftSweBench/wiki

.LINK
    https://github.com/devdiv-microsoft/MicrosoftSweBench/wiki
#>

    param(
        [Parameter(Mandatory=$true)][ValidateNotNullOrEmpty()][string]$InputPath,
        [Parameter(Mandatory=$true)][ValidateNotNullOrEmpty()][string]$OutputPath
    )

    Set-StrictMode -Version Latest
    $ErrorActionPreference = "Stop"

    if (!$InputPath) {
        throw "InputPath parameter is required."
    }

    if (!$OutputPath) {
        throw "OutputPath parameter is required."
    }

    # --- Parse run IDs from input file if provided ---
    Write-Host "Parsing run IDs from input path: $InputPath"
    $inputRunIds = @()
    if ($InputPath) {
        $runIdsFile = Join-Path $InputPath 'run_ids.json'
        if (!(Test-Path $runIdsFile)) {
            throw "run_ids.json not found at $runIdsFile"
        }
        $inputRunIds = Get-Content -Path $runIdsFile -Raw | ConvertFrom-Json
        $inputRunIds = @($inputRunIds)
        if (-not $inputRunIds -or $inputRunIds.Count -eq 0) {
            throw "No run IDs found in $runIdsFile. Ensure run_ids.json contains at least one run ID."
        }
        Write-Host "Loaded run IDs from ${runIdsFile}: $($inputRunIds -join ',')"
    }

    $vaultName = "kv-msbench-eval-azuremcp"
    $secretName = "msbench-report-copilot-usage"

    Write-Host "Input Path: $InputPath"
    Write-Host "Output Path: $OutputPath"
    $pipelineRun = $env:TF_BUILD -eq "True"

    # --- Retrieve GitHub PAT from KeyVault ---
    try {
        Write-Host "Retrieving GitHub PAT from KeyVault $vaultName secret $secretName"
        $pat = az keyvault secret show --vault-name $vaultName --name $secretName --query value -o tsv

        if (!$pat) {
            throw "Secret $secretName not found in KeyVault $vaultName."
        }

        $env:COPILOT_GITHUB_TOKEN = $pat
        
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

    Write-Host "Checking database used by MSBench CLI"
    & 'msbench-cli' database
    if ($LASTEXITCODE -ne 0) {
        throw "msbench-cli database failed with exit code $LASTEXITCODE"
    }

    # Check if all the runs have completed
    Write-Host "Checking status of run ID: $($inputRunIds -join ',')"
    $statusResult = & 'msbench-cli' resume --run-id $($inputRunIds -join ',')
    if ($LASTEXITCODE -ne 0) {
        throw "msbench-cli resume failed for run ID $($inputRunIds -join ',') with exit code $LASTEXITCODE"
    }

    # --- Clone repo and cd to working directory ---
    $msbenchRepo = "https://devdiv@dev.azure.com/devdiv/OnlineServices/_git/msbench-benchmarks"
    $repoName = "msbench-benchmarks"

    $cloneDir = Join-Path $PWD $repoName

    if (Test-Path $cloneDir) {
        Write-Host "Removing existing directory $cloneDir"
        Remove-Item -Recurse -Force $cloneDir
    }

    Write-Host "Cloning $msbenchRepo into $cloneDir"
    # ADO resource id for Azure Repos is 499b84ac-1321-427f-aa17-267ca6975798
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

    $targetDir = Join-Path $cloneDir "curation/benchmarks/azure/report"
    if (!(Test-Path $targetDir)) {
        throw "Working directory '$targetDir' does not exist after clone."
    }

    Write-Host "Changing directory to $targetDir"
    Set-Location $targetDir

    # Generate benchmark analysis report using GitHub Copilot CLI
    # Copilot will analyze the specified run IDs and generate detailed markdown reports
    Write-Host "Generating benchmark report for run IDs: $($inputRunIds -join ', ')"
    New-Item -Path $OutputPath -ItemType Directory -Force | Out-Null
    $reportGenerationPrompt = "analyze msbench run: $($inputRunIds -join ', ')"
    $copilotLogDir = Join-Path $OutputPath "copilot_log"
    $copilotLogFile = Join-Path $copilotLogDir "copilot_log.md"
    New-Item -Path $copilotLogDir -ItemType Directory -Force | Out-Null
    $copilotArgs = @(
            "-p", $reportGenerationPrompt,
            "--model", "claude-opus-4.6",
            "--share", $copilotLogFile,
            "--yolo"
        )
    & 'copilot' @copilotArgs
    if ($LASTEXITCODE -ne 0) {
        throw "copilot report generation failed with exit code $LASTEXITCODE"
    }

    # Move generated markdown reports from the working directory to the specified output path
    $reportsDir = Join-Path $targetDir "reports"
    $reportFiles = @()
    $reportsDirMdFiles = Get-ChildItem -Path $reportsDir -Filter '*.md' -ErrorAction SilentlyContinue
    if ((Test-Path $reportsDir) -and $reportsDirMdFiles) {
        $reportFiles = $reportsDirMdFiles
        Write-Host "Found $($reportFiles.Count) report(s) in $reportsDir"
    } else {
        $reportFiles = Get-ChildItem -Path $targetDir -Filter '*.md' -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notlike "*\.github\*" -and $_.FullName -notlike "*/.github/*" }
        Write-Host "Found $($reportFiles.Count) report(s) in $targetDir (excluding .github folders)"
    }

    if ($reportFiles.Count -gt 0) {
        foreach ($report in $reportFiles) {
            $destination = Join-Path $OutputPath $report.Name
            Move-Item -Path $report.FullName -Destination $destination -Force
            Write-Host "Moved report to $destination"
            
            # Upload report summary if running in pipeline
            if ($pipelineRun) {
                # Verify file exists before uploading
                if (Test-Path $destination) {
                    # Use relative path from agent working directory for better compatibility
                    $relativePath = Resolve-Path -Path $destination -Relative -ErrorAction SilentlyContinue
                    if (-not $relativePath) {
                        $relativePath = $destination
                    }
                    Write-Host "##vso[task.uploadsummary]$relativePath"
                    Write-Host "##vso[task.addattachment type=Distributedtask.Core.Summary;name=$($report.BaseName) Report;]$destination"
                } else {
                    Write-Warning "Report file not found at $destination, skipping upload to build summary"
                }
            }
        }
    } else {
        Write-Warning "No generated report (.md) files found in $reportsDir or $targetDir"
    }
    
    Write-Host "`nMSBench benchmark report generation completed successfully."
