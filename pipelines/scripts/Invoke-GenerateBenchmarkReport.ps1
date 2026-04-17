<#
.SYNOPSIS
    Generates benchmark analysis reports for completed MSBench runs using GitHub Copilot
    and uploads them to Azure Blob Storage.

.DESCRIPTION
    This script runs in Azure DevOps under an AzureCLI@2 task with federated authentication.
    Feed authentication is handled by a preceding PipAuthenticate@1 task that sets
    PIP_EXTRA_INDEX_URL for the azure-sdk/internal/MicrosoftSweBench feed.
    The script retrieves a GitHub PAT from KeyVault, clones the msbench-benchmarks repo,
    installs MSBench CLI, checks the status of existing benchmark runs, and uses GitHub Copilot
    to generate detailed analysis reports for the specified run IDs.

    The script downloads a ToBeProcessed file from the blob container root to determine which
    dates need report generation. For each date, it downloads the corresponding run_ids.json,
    generates reports using GitHub Copilot CLI, enriches eval_report.json files with model
    metadata and resolved status from eval.json, and uploads all artifacts to Azure Blob Storage.

    After processing, successfully completed dates are removed from the ToBeProcessed file,
    which is then uploaded back to blob storage. If the ToBeProcessed file does not exist
    in the container, the script exits gracefully with no action.

    Blob path format: {date}/{benchmark_instance}/{filename}

.PARAMETER OutputPath
    Directory path where generated benchmark reports will be saved, organized by date.

.PARAMETER StorageAccountName
    The Azure Storage account name for reading ToBeProcessed/run_ids.json and uploading reports.

.PARAMETER ContainerName
    The blob container name for reading ToBeProcessed/run_ids.json and uploading reports.

    MSBench CLI reference:
    - https://github.com/devdiv-microsoft/MicrosoftSweBench/wiki

.LINK
    https://github.com/devdiv-microsoft/MicrosoftSweBench/wiki
#>

    param(
        [Parameter(Mandatory=$true)][ValidateNotNullOrEmpty()][string]$OutputPath,
        [Parameter(Mandatory=$true)][ValidateNotNullOrEmpty()][string]$StorageAccountName,
        [Parameter(Mandatory=$true)][ValidateNotNullOrEmpty()][string]$ContainerName
    )

    Set-StrictMode -Version Latest
    $ErrorActionPreference = "Stop"

    if (!(Test-Path -Path $OutputPath)) {
        New-Item -Path $OutputPath -ItemType Directory -Force | Out-Null
    }

    $vaultName = "kv-msbench-eval-azuremcp"
    $secretName = "msbench-report-copilot-usage"

    Write-Host "Output Path: $OutputPath"
    $pipelineRun = $env:TF_BUILD -eq "True"

    # --- Retrieve GitHub PAT from KeyVault ---
    try {
        Write-Host "Retrieving GitHub PAT from KeyVault $vaultName secret $secretName"
        $azArgs = @(
            "keyvault", "secret", "show",
            "--vault-name", $vaultName,
            "--name", $secretName,
            "--query", "value",
            "-o", "tsv"
        )
        $pat = az @azArgs

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
    $azArgs = @(
        "account", "get-access-token",
        "--resource", "499b84ac-1321-427f-aa17-267ca6975798",
        "--query", "accessToken",
        "-o", "tsv"
    )
    $token = az @azArgs  
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

    # --- Get dates from ToBeProcessed file in blob container root ---
    Write-Host "Downloading ToBeProcessed file from blob container $ContainerName"
    $toBeProcessedLocal = Join-Path $OutputPath 'ToBeProcessed'

    $azArgs = @(
        "storage", "blob", "download",
        "--account-name", $StorageAccountName,
        "--container-name", $ContainerName,
        "--name", "ToBeProcessed",
        "--file", $toBeProcessedLocal,
        "--auth-mode", "login"
    )
    az @azArgs
    if ($LASTEXITCODE -ne 0 -or !(Test-Path $toBeProcessedLocal)) {
        throw "Failed to download ToBeProcessed file from blob container $ContainerName. Ensure the file exists and the service principal has access."
    }

    $dates = @(Get-Content -Path $toBeProcessedLocal | 
                Where-Object { $_.Trim() -ne '' } | 
                ForEach-Object { $_.Trim() } |
                Where-Object { $_ -match '^\d{4}-\d{2}-\d{2}$' })
    if ($dates.Count -eq 0) {
        Write-Host "ToBeProcessed file is empty. No action needed."
        exit 0
    }
    Write-Host "Found $($dates.Count) date(s) to process: $($dates -join ', ')"

    # --- Download run_ids.json for each date from blob container ---
    $dateRunIdMap = @{}
    foreach ($d in $dates) {
        $runIdsBlobPath = "$d/run_ids.json"
        $runIdsLocalFile = Join-Path $OutputPath "run_ids_${d}.json"

        Write-Host "Downloading $runIdsBlobPath from blob container $ContainerName"
        $azArgs = @(
            "storage", "blob", "download",
            "--account-name", $StorageAccountName,
            "--container-name", $ContainerName,
            "--name", $runIdsBlobPath,
            "--file", $runIdsLocalFile,
            "--auth-mode", "login"
        )
        az @azArgs

        if ($LASTEXITCODE -ne 0) {
            throw "Failed to download $runIdsBlobPath from blob container $ContainerName"
        }

        $runIds = @(Get-Content -Path $runIdsLocalFile -Raw | ConvertFrom-Json)
        if (-not $runIds -or $runIds.Count -eq 0) {
            Write-Warning "No run IDs found in $runIdsBlobPath. Skipping date $d."
            continue
        }
        $dateRunIdMap[$d] = $runIds
        Write-Host "Date ${d}: loaded $($runIds.Count) run ID(s): $($runIds -join ',')"
    }

    if ($dateRunIdMap.Count -eq 0) {
        throw "No valid run IDs found for any date in ToBeProcessed."
    }

    function Get-BenchmarkInstanceID {
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

    # --- Process each date ---
    $processedDates = @()
    foreach ($date in $dateRunIdMap.Keys) {
        $inputRunIds = @($dateRunIdMap[$date])
        Write-Host "`n=========================================="
        Write-Host "Processing date: $date with $($inputRunIds.Count) run ID(s): $($inputRunIds -join ',')"
        Write-Host "==========================================`n"

        $dateOutputPath = Join-Path $OutputPath $date
        New-Item -Path $dateOutputPath -ItemType Directory -Force | Out-Null

        # Check if all the runs have completed
        Write-Host "Checking status of run ID: $($inputRunIds -join ',')"
        & 'msbench-cli' resume --run-id $($inputRunIds -join ',')
        if ($LASTEXITCODE -ne 0) {
            throw "msbench-cli resume failed for run ID $($inputRunIds -join ',') with exit code $LASTEXITCODE"
        }

        # Ensure we are in the target directory for copilot
        Write-Host "Changing directory to $targetDir"
        Set-Location $targetDir

        # Generate benchmark analysis report using GitHub Copilot CLI
        # Copilot will analyze the specified run IDs and generate detailed markdown reports
        Write-Host "Generating benchmark report for run IDs: $($inputRunIds -join ', ')"
        $reportGenerationPrompt = "analyze msbench run on $date`: $($inputRunIds -join ', ')"
        $copilotLogDir = Join-Path $dateOutputPath "copilot_log"
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

        Write-Host "`nMSBench benchmark report generation completed successfully for date $date."

        # Copy generated markdown reports from the working directory to the date output path
        Write-Host "Copying generated report files to output path: $dateOutputPath"
        $reportsDir = Join-Path $targetDir "reports"
        $reportFiles = @()
        if ((Test-Path $reportsDir)) {
            $reportsDirMdFiles = Get-ChildItem -Path $reportsDir -Filter '*.md'
            if ($reportsDirMdFiles) {
                $reportFiles = $reportsDirMdFiles
                Write-Host "Found $($reportFiles.Count) report(s) in $reportsDir"
            }
        } else {
            $reportFiles = Get-ChildItem -Path $targetDir -Filter '*.md' | Where-Object { $_.FullName -notlike "*\.github\*" -and $_.FullName -notlike "*/.github/*" }
            Write-Host "Found $($reportFiles.Count) report(s) in $targetDir (excluding .github folders)"
        }

        if ($reportFiles.Count -gt 0) {
            foreach ($report in $reportFiles) {
                $destination = Join-Path $dateOutputPath $report.Name
                Copy-Item -Path $report.FullName -Destination $destination -Force
                Write-Host "Copied report to $destination"

                # Upload report summary if running in pipeline
                if ($pipelineRun) {
                    Write-Host "##vso[task.uploadsummary]$destination"
                }

                # Upload report to Azure Blob Storage
                $benchmarkInstance = Get-BenchmarkInstanceID -FileName $report.Name
                $blobPath = "$date/$benchmarkInstance/$($report.Name)"
                Write-Host "Uploading $($report.Name) -> $ContainerName/$blobPath (instance: $benchmarkInstance)"

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
                    $destination
                    "--auth-mode"
                    "login"
                    "--overwrite"
                )

                az @azArgs
                if ($LASTEXITCODE -ne 0) {
                    Write-Warning "Failed to upload $($report.Name)"
                }
            }
        } else {
            Write-Warning "No generated report (.md) files found in $reportsDir or $targetDir"
        }

        # Find and copy eval_report.json files for each benchmark instance,
        # enriched with model name and run ID from run_metadata.json.
        # Folder structure:
        #   msbench_run_results/
        #     {runId}_results/
        #       run_metadata.json
        #       azure.eval.x86_64.{instance}-output/
        #         output/
        #           eval_report.json
        #           eval.json
        Write-Host "Searching for eval_report.json files to enrich and copy to output path"
        $msbenchRunResultsDir = Join-Path $targetDir 'msbench_run_results'
        if (!(Test-Path $msbenchRunResultsDir)) {
            # Fallback: find run_metadata.json and derive the results folder
            # Structure: {results_folder}/{runId}_results/run_metadata.json
            Write-Host "msbench_run_results not found at expected path. Searching for run_metadata.json under $targetDir"
            $metadataHit = Get-ChildItem -Path $targetDir -Filter 'run_metadata.json' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
            if (-not $metadataHit) {
                Write-Warning "No run_metadata.json found under $targetDir. Cannot locate results folder. Skipping date $date."
                continue
            }
            # run_metadata.json is inside {results_folder}/{runId}_results/ — go up 2 levels
            $msbenchRunResultsDir = $metadataHit.Directory.Parent.FullName
            Write-Host "Found results folder via run_metadata.json: $msbenchRunResultsDir"
        }

        $evalCount = 0
        $runDirs = Get-ChildItem -Path $msbenchRunResultsDir -Directory -Filter '*_results' -ErrorAction SilentlyContinue
        Write-Host "Processing run results directory: $msbenchRunResultsDir"
        foreach ($runDir in $runDirs) {
            # Read model name from run_metadata.json
            $metadataFile = Join-Path $runDir.FullName 'run_metadata.json'
            if (!(Test-Path $metadataFile)) {
                Write-Warning "run_metadata.json not found in $($runDir.FullName). Skipping this run directory."
                continue
            }
            $metadata = Get-Content -Path $metadataFile -Raw | ConvertFrom-Json
            if (-not $metadata.model) {
                Write-Warning "No 'model' field in run_metadata.json in $($runDir.FullName). Skipping this run directory."
                continue
            }
            $model = $metadata.model -replace '-autodev-test$', ''
            $runId = $runDir.Name -replace '_results$', ''
            Write-Host "Run ${runId}: model=$model"

            # Iterate over azure.eval.x86_64.{instance}-output directories
            $instanceDirs = Get-ChildItem -Path $runDir.FullName -Directory -Filter 'azure.eval.x86_64.*-output' -ErrorAction SilentlyContinue
            foreach ($instanceDir in $instanceDirs) {
                $instanceName = $instanceDir.Name -replace '^azure\.eval\.x86_64\.', '' -replace '-output$', ''
                $outputDir = Join-Path $instanceDir.FullName 'output'

                $evalReportFile = Join-Path $outputDir 'eval_report.json'
                if (!(Test-Path $evalReportFile)) {
                    Write-Warning "eval_report.json not found in $outputDir for instance '$instanceName'. Skipping."
                    continue
                }
                # Enrich eval_report.json with model and instance metadata
                $evalContent = Get-Content -Path $evalReportFile -Raw | ConvertFrom-Json
                $evalContent | Add-Member -NotePropertyName 'model' -NotePropertyValue $model -Force
                $evalContent | Add-Member -NotePropertyName 'instance_id' -NotePropertyValue $instanceName -Force

                # Enrich with resolved field from eval.json in the same output directory
                $evalJsonFile = Join-Path $outputDir 'eval.json'
                if (!(Test-Path $evalJsonFile)) {
                    Write-Warning "eval.json not found in $outputDir for instance '$instanceName'. Skipping."
                    continue
                }
                $evalJson = Get-Content -Path $evalJsonFile -Raw | ConvertFrom-Json
                $resolvedValue = $null
                # eval.json structure: { "instance_name": { "resolved": true/false } }
                foreach ($prop in $evalJson.PSObject.Properties) {
                    if ($prop.Value -is [psobject] -and $prop.Value.PSObject.Properties.Name -contains 'resolved') {
                        $resolvedValue = $prop.Value.resolved
                        break
                    }
                }
                if ($null -ne $resolvedValue) {
                    $evalContent | Add-Member -NotePropertyName 'resolved' -NotePropertyValue $resolvedValue -Force
                    Write-Host "Enriched with resolved=$resolvedValue from eval.json for instance '$instanceName'"
                } else {
                    Write-Warning "eval.json found but no 'resolved' field for instance '$instanceName'"
                }

                $destination = Join-Path $dateOutputPath "${model}_${instanceName}_eval_report.json"
                $evalContent | ConvertTo-Json -Depth 10 | Set-Content -Path $destination -Encoding UTF8
                Write-Host "Saved enriched eval_report.json for instance '$instanceName' (model: $model) to $destination"

                # Upload eval_report.json to Azure Blob Storage
                $evalBlobPath = "$date/$instanceName/${model}_${instanceName}_eval_report.json"
                Write-Host "Uploading ${model}_${instanceName}_eval_report.json -> $ContainerName/$evalBlobPath"

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
                    $destination
                    "--auth-mode"
                    "login"
                    "--overwrite"
                )

                az @evalAzArgs
                if ($LASTEXITCODE -ne 0) {
                    Write-Warning "Failed to upload $([System.IO.Path]::GetFileName($destination)) for instance $instanceName"
                }

                $evalCount++
            }
        }
        if ($evalCount -eq 0) {
            Write-Warning "No eval_report.json files found under msbench_run_results"
        } else {
            Write-Host "Processed $evalCount eval_report.json file(s)"
        }

        # Clean up run results for the next date iteration
        if ($msbenchRunResultsDir -and (Test-Path $msbenchRunResultsDir)) {
            Remove-Item -Path $msbenchRunResultsDir -Recurse -Force
            Write-Host "Cleaned up $msbenchRunResultsDir for next iteration"
        }
        $reportsCleanup = Join-Path $targetDir "reports"
        if (Test-Path $reportsCleanup) {
            Remove-Item -Path $reportsCleanup -Recurse -Force
            Write-Host "Cleaned up $reportsCleanup for next iteration"
        }

        $processedDates += $date
        Write-Host "Date $date processed successfully."
    }

    # --- Update ToBeProcessed file in blob storage ---
    if ($processedDates.Count -gt 0) {
        Write-Host "`nSuccessfully processed $($processedDates.Count) date(s): $($processedDates -join ', ')"

        # Remove processed dates from the original list
        $remainingDates = @($dates | Where-Object { $_ -notin $processedDates })

        if ($remainingDates.Count -eq 0) {
            Write-Host "All dates processed. Uploading empty ToBeProcessed file."
            Set-Content -Path $toBeProcessedLocal -Value '' -Encoding UTF8
        } else {
            Write-Host "Remaining dates to process: $($remainingDates -join ', ')"
            Set-Content -Path $toBeProcessedLocal -Value ($remainingDates -join "`n") -Encoding UTF8
        }

        # Upload updated ToBeProcessed file to blob storage
        Write-Host "Uploading updated ToBeProcessed file to blob container $ContainerName"
        $azArgs = @(
            "storage", "blob", "upload",
            "--account-name", $StorageAccountName,
            "--container-name", $ContainerName,
            "--name", "ToBeProcessed",
            "--file", $toBeProcessedLocal,
            "--auth-mode", "login",
            "--overwrite"
        )
        az @azArgs

        if ($LASTEXITCODE -ne 0) {
            Write-Warning "Failed to upload updated ToBeProcessed file to blob storage"
        } else {
            Write-Host "Updated ToBeProcessed file uploaded successfully."
        }
    } else {
        Write-Warning "No dates were processed successfully."
    }

    Write-Host "`nAll dates processed successfully."
