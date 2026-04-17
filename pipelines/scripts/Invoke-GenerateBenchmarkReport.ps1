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

    The script reads dates from a ToBeProcessed file in the blob container root, downloads
    run_ids.json for each date, generates reports using GitHub Copilot CLI, and saves the
    generated markdown reports to the OutputPath.

    When StorageAccountName and ContainerName are provided, the generated reports are
    uploaded to Azure Blob Storage organized by date, skill name, and benchmark instance.
    Blob path format: {date}/{benchmark_instance}/{filename}

.PARAMETER OutputPath
    Directory path where generated benchmark reports will be saved.

.PARAMETER StorageAccountName
    Optional. The Azure Storage account name to upload reports to.

.PARAMETER ContainerName
    Optional. The blob container name to upload reports to.

    MSBench CLI reference:
    - https://github.com/devdiv-microsoft/MicrosoftSweBench/wiki

.LINK
    https://github.com/devdiv-microsoft/MicrosoftSweBench/wiki
#>

    param(
        [Parameter(Mandatory=$true)][ValidateNotNullOrEmpty()][string]$OutputPath,
        [Parameter(Mandatory=$false)][string]$StorageAccountName,
        [Parameter(Mandatory=$false)][string]$ContainerName
    )

    Set-StrictMode -Version Latest
    $ErrorActionPreference = "Stop"

    if (!$OutputPath) {
        throw "OutputPath parameter is required."
    }

    $vaultName = "kv-msbench-eval-azuremcp"
    $secretName = "msbench-report-copilot-usage"

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

    # --- Get dates from ToBeProcessed file in blob container root ---
    Write-Host "Checking for ToBeProcessed file in blob container $ContainerName"
    $toBeProcessedLocal = Join-Path $OutputPath 'ToBeProcessed'

    az storage blob download `
        --account-name $StorageAccountName `
        --container-name $ContainerName `
        --name "ToBeProcessed" `
        --file $toBeProcessedLocal `
        --auth-mode login 2>$null

    if ($LASTEXITCODE -ne 0 -or !(Test-Path $toBeProcessedLocal)) {
        Write-Host "ToBeProcessed file not found in blob container root. No action needed."
        exit 0
    }

    $dates = @(Get-Content -Path $toBeProcessedLocal | Where-Object { $_.Trim() -ne '' } | ForEach-Object { $_.Trim() })
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
        az storage blob download `
            --account-name $StorageAccountName `
            --container-name $ContainerName `
            --name $runIdsBlobPath `
            --file $runIdsLocalFile `
            --auth-mode login

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
                Write-Host "Processing run results directory: $($runResultsDir.FullName)"
                foreach ($runDir in $runDirs) {
                    # Read model name and run ID from run_metadata.json
                    $metadataFile = Join-Path $runDir.FullName 'run_metadata.json'
                    $model = $null
                    if (Test-Path $metadataFile) {
                        $metadata = Get-Content -Path $metadataFile -Raw | ConvertFrom-Json
                        $model = $metadata.model -replace '-autodev-test$', ''
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

                        # Enrich with resolved field from eval.json in the same directory
                        $evalJsonFile = Join-Path $evalReport.DirectoryName 'eval.json'
                        if (Test-Path $evalJsonFile) {
                            $evalJson = Get-Content -Path $evalJsonFile -Raw | ConvertFrom-Json
                            $resolvedValue = $null
                            # eval.json structure: { "instance_name": { "resolved": true/false } }
                            foreach ($prop in $evalJson.PSObject.Properties) {
                                if ($null -ne $prop.Value.resolved) {
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
                        } else {
                            Write-Warning "eval.json not found at $evalJsonFile for instance '$instanceName'"
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
            }
            if ($evalCount -eq 0) {
                Write-Warning "No eval_report.json files found under msbench_run_results"
            } else {
                Write-Host "Processed $evalCount eval_report.json file(s)"
            }
        } else {
            Write-Warning "No msbench_run_results directory found"
        }

        # Clean up msbench_run_results for the next date iteration
        $runResultsCleanup = Get-ChildItem -Path $targetDir -Directory -Filter 'msbench_run_results' -ErrorAction SilentlyContinue
        if ($runResultsCleanup) {
            foreach ($dir in $runResultsCleanup) {
                Remove-Item -Path $dir.FullName -Recurse -Force
                Write-Host "Cleaned up $($dir.FullName) for next iteration"
            }
        }
        $reportsCleanup = Join-Path $targetDir "reports"
        if (Test-Path $reportsCleanup) {
            Remove-Item -Path $reportsCleanup -Recurse -Force
            Write-Host "Cleaned up $reportsCleanup for next iteration"
        }
    }

    Write-Host "`nAll dates processed successfully."
