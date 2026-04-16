<#
.SYNOPSIS
    Generates benchmark analysis reports for completed MSBench runs using GitHub Copilot
    and optionally uploads them to Azure Blob Storage.

.DESCRIPTION
    This script runs in Azure DevOps under an AzureCLI@2 task with federated authentication.
    Feed authentication is handled by a preceding PipAuthenticate@1 task that sets
    PIP_EXTRA_INDEX_URL for the azure-sdk/internal/MicrosoftSweBench feed.
    The script retrieves a GitHub PAT from KeyVault, clones the msbench-benchmarks repo,
    installs MSBench CLI, checks the status of existing benchmark runs, and uses GitHub Copilot
    to generate detailed analysis reports for the specified run IDs.

    The script reads run IDs from run_ids.json in the InputPath, generates reports using
    GitHub Copilot CLI, and saves the generated markdown reports to the OutputPath.

    When StorageAccountName and ContainerName are provided, the generated reports are
    uploaded to Azure Blob Storage organized by date, skill name, and benchmark instance.
    Blob path format: {date}/{skill_name}/{benchmark_instance}/{filename}

.PARAMETER InputPath
    Directory path containing the run_ids.json file with benchmark run IDs to analyze.

.PARAMETER OutputPath
    Directory path where generated benchmark reports will be saved.

.PARAMETER StorageAccountName
    Optional. The Azure Storage account name to upload reports to.

.PARAMETER ContainerName
    Optional. The blob container name to upload reports to.

.PARAMETER Date
    Optional date string in yyyy-MM-dd format for blob path organization. Defaults to today's date.

    MSBench CLI reference:
    - https://github.com/devdiv-microsoft/MicrosoftSweBench/wiki

.LINK
    https://github.com/devdiv-microsoft/MicrosoftSweBench/wiki
#>

    param(
        [Parameter(Mandatory=$true)][ValidateNotNullOrEmpty()][string]$InputPath,
        [Parameter(Mandatory=$true)][ValidateNotNullOrEmpty()][string]$OutputPath,
        [Parameter(Mandatory=$false)][string]$StorageAccountName,
        [Parameter(Mandatory=$false)][string]$ContainerName,
        [Parameter(Mandatory=$false)][string]$Date
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
    & 'msbench-cli' resume --run-id $($inputRunIds -join ',')
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
    $token = az account get-access-token --resource 499b84ac-1321-427f-aa17-267ca6975798 --query accessToken -o tsv  
    if ($pipelineRun) {  
        Write-Host "##vso[task.setsecret]$token"  
    }  
    
    git -c http.extraheader="AUTHORIZATION: bearer $token" `
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

    Write-Host "`nMSBench benchmark report generation completed successfully."

    # Move generated markdown reports from the working directory to the specified output path
    Write-Host "Moving generated report files to output path: $OutputPath"
    $reportsDir = Join-Path $targetDir "reports"
    $reportFiles = @()
    $reportsDirMdFiles = Get-ChildItem -Path $reportsDir -Filter '*.md'
    if ((Test-Path $reportsDir) -and $reportsDirMdFiles) {
        $reportFiles = $reportsDirMdFiles
        Write-Host "Found $($reportFiles.Count) report(s) in $reportsDir"
    } else {
        $reportFiles = Get-ChildItem -Path $targetDir -Filter '*.md' | Where-Object { $_.FullName -notlike "*\.github\*" -and $_.FullName -notlike "*/.github/*" }
        Write-Host "Found $($reportFiles.Count) report(s) in $targetDir (excluding .github folders)"
    }

    if ($reportFiles.Count -gt 0) {
        foreach ($report in $reportFiles) {
            $destination = Join-Path $OutputPath $report.Name
            Move-Item -Path $report.FullName -Destination $destination -Force
            Write-Host "Moved report to $destination"
            
            # Upload report summary if running in pipeline
            if ($pipelineRun) {
                # Add to build summary for easy access
                # TO-DO: The reports are not showing up on the summary page. Need to fix it.
                Write-Host "##vso[task.uploadsummary]$destination"
            }
        }
    } else {
        Write-Warning "No generated report (.md) files found in $reportsDir or $targetDir"
    }

    # Find and copy eval_report.json files for each benchmark instance,
    # enriched with model name and run ID from run_metadata.json.
    # Path structure: msbench_run_results/{runId}_results/azure.eval.x86_64.{instance}-output/output/eval_report.json
    Write-Host "Searching for eval_report.json files to enrich and copy to output path"
    $runResultsDirs = Get-ChildItem -Path $targetDir -Directory -Filter 'msbench_run_results' -ErrorAction SilentlyContinue
    if (-not $runResultsDirs) {
        $runResultsDirs = Get-ChildItem -Path $cloneDir -Directory -Filter 'msbench_run_results' -Recurse -ErrorAction SilentlyContinue
    }

    if ($runResultsDirs) {
        $evalCount = 0
        foreach ($runResultsDir in $runResultsDirs) {
            $runDirs = Get-ChildItem -Path $runResultsDir.FullName -Directory -Filter '*_results' -ErrorAction SilentlyContinue
            foreach ($runDir in $runDirs) {
                # Read model name and run ID from run_metadata.json
                $metadataFile = Join-Path $runDir.FullName 'run_metadata.json'
                $model = $null
                if (Test-Path $metadataFile) {
                    $metadata = Get-Content -Path $metadataFile -Raw | ConvertFrom-Json
                    $model = $metadata.model
                    Write-Host "Run $(($runDir.Name -replace '_results$', '')): model=$model"
                }

                # Find eval_report.json files under azure.eval.x86_64.{instance}-output/output/
                $evalReports = Get-ChildItem -Path $runDir.FullName -Filter 'eval_report.json' -Recurse -ErrorAction SilentlyContinue
                foreach ($evalReport in $evalReports) {
                    # Extract instance name from: azure.eval.x86_64.{instance}-output
                    $outputDirName = $evalReport.Directory.Parent.Name  # e.g. azure.eval.x86_64.aca_deployment_skill-output
                    $instanceName = $outputDirName -replace '^azure\.eval\.x86_64\.', '' -replace '-output$', ''

                    # Enrich eval_report.json with model and run metadata
                    $evalContent = Get-Content -Path $evalReport.FullName -Raw | ConvertFrom-Json
                    if ($model) { $evalContent | Add-Member -NotePropertyName 'model' -NotePropertyValue $model -Force }
                    $evalContent | Add-Member -NotePropertyName 'instance_id' -NotePropertyValue $instanceName -Force

                    $destination = Join-Path $OutputPath "${instanceName}_eval_report.json"
                    $evalContent | ConvertTo-Json -Depth 10 | Set-Content -Path $destination -Encoding UTF8
                    Write-Host "Saved enriched eval_report.json for instance '$instanceName' (model: $model) to $destination"
                    $evalCount++
                }
            }
        }
        if ($evalCount -eq 0) {
            Write-Warning "No eval_report.json files found under msbench_run_results"
        } else {
            Write-Host "Processed $evalCount eval_report.json file(s)"
        }
    } else {
        Write-Warning "No msbench_run_results directory found"
    }

    # --- Upload reports to Azure Blob Storage ---
    if ($StorageAccountName -and $ContainerName) {
        Write-Host "`n--- Uploading reports to Azure Blob Storage ---"

        if (-not $Date) {
            $Date = Get-Date -Format "yyyy-MM-dd"
        }

        # Known skill categories ordered longest-first to ensure greedy matching.
        # For example, "enterprise_infra_planner" must match before a hypothetical "enterprise".
        $skillCategories = @(
            "enterprise_infra_planner"
            "resource_visualization"
            "cost_optimization"
            "resource_lookup"
            "app_insights"
            "observability"
            "diagnostics"
            "deployment"
            "compliance"
            "foundry"
            "rbac"
        )

        function Get-BenchmarkInstance {
            param([string]$FileName)

            $baseName = [System.IO.Path]::GetFileNameWithoutExtension($FileName).ToLower()
            $normalized = $baseName -replace '-', '_'

            # Extract BENCHMARK_INSTANCE from: msbench_analysis_report_[BENCHMARK_INSTANCE]_[DATE]
            $instance = $normalized -replace '^msbench_(analysis_)?report_', '' `
                                    -replace '_\d{4}_\d{2}_\d{2}$', ''

            if ($instance) {
                return $instance
            }

            return $baseName
        }

        function Get-SkillName {
            param([string]$FileName)

            $baseName = [System.IO.Path]::GetFileNameWithoutExtension($FileName).ToLower()

            # Normalize separators: replace hyphens with underscores for consistent matching
            $normalized = $baseName -replace '-', '_'

            foreach ($skill in $skillCategories) {
                if ($normalized -match [regex]::Escape($skill)) {
                    return $skill
                }
            }

            # Fallback: strip common prefixes/suffixes and date patterns
            $cleaned = $normalized -replace '^msbench_(analysis_)?report_', '' `
                                   -replace '_?\d{4}_\d{2}_\d{2}$', '' `
                                   -replace '_skill$', '' `
                                   -replace '_report$', ''

            if ($cleaned) {
                return $cleaned
            }

            return $baseName
        }

        # Discover report files (exclude copilot log artifacts)
        $uploadReports = Get-ChildItem -Path $OutputPath -Filter '*.md' |
                   Where-Object { $_.DirectoryName -notlike '*copilot_log*' }

        if (-not $uploadReports -or $uploadReports.Count -eq 0) {
            Write-Warning "No report files found in $OutputPath for upload"
        } else {
            Write-Host "Found $($uploadReports.Count) report(s) to upload"

            $successCount = 0
            $failCount = 0

            foreach ($report in $uploadReports) {
                $skillName = Get-SkillName -FileName $report.Name
                $benchmarkInstance = Get-BenchmarkInstance -FileName $report.Name
                $blobPath = "$Date/$skillName/$benchmarkInstance/$($report.Name)"

                Write-Host "Uploading $($report.Name) -> $ContainerName/$blobPath (skill: $skillName, instance: $benchmarkInstance)"

                $azArgs = @(
                    "storage"
                    "blob"
                    "upload"
                    "--account-name"
                    $StorageAccountName
                    "--container-name"
                    $ContainerName
                    "--name"
                    $blobPath
                    "--file"
                    $report.FullName
                    "--auth-mode"
                    "login"
                    "--overwrite"
                )

                az @azArgs
                if ($LASTEXITCODE -ne 0) {
                    Write-Warning "Failed to upload $($report.Name)"
                    $failCount++
                } else {
                    $successCount++
                }

                # Upload corresponding eval_report.json if it exists
                $evalReportFile = Join-Path $OutputPath "${benchmarkInstance}_eval_report.json"
                if (Test-Path $evalReportFile) {
                    $evalBlobPath = "$Date/$skillName/$benchmarkInstance/eval_report.json"
                    Write-Host "Uploading eval_report.json -> $ContainerName/$evalBlobPath"

                    $evalAzArgs = @(
                        "storage"
                        "blob"
                        "upload"
                        "--account-name"
                        $StorageAccountName
                        "--container-name"
                        $ContainerName
                        "--name"
                        $evalBlobPath
                        "--file"
                        $evalReportFile
                        "--auth-mode"
                        "login"
                        "--overwrite"
                    )

                    az @evalAzArgs
                    if ($LASTEXITCODE -ne 0) {
                        Write-Warning "Failed to upload eval_report.json for instance $benchmarkInstance"
                        $failCount++
                    } else {
                        $successCount++
                    }
                }
            }

            Write-Host "`nUpload complete: $successCount succeeded, $failCount failed (container: $ContainerName/$Date/)"

            if ($failCount -gt 0) {
                Write-Error "$failCount report upload(s) failed."
                exit 1
            }
        }
    }
