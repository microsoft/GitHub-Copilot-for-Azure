<#
.SYNOPSIS
    Generates Agent Forensics reports for completed Azure MSBench runs.

.DESCRIPTION
    This script runs in Azure DevOps under an AzureCLI@2 task with federated
    authentication. PipAuthenticate@1 configures the MicrosoftSweBench feed.
    For each date in the ToBeProcessed blob, the script downloads run_ids.json,
    verifies the runs are complete, extracts every run into one shared Agent
    Forensics data root, and performs one combined azure.skill analysis.

    Agent Forensics uses the external GitHub Copilot CLI with HMAC provider
    authentication. The HMAC key and integration ID are retrieved from Azure
    Key Vault and exposed only as COPILOT_HMAC_KEY and
    COPILOT_HMAC_INTEGRATION_ID.

    Reports and compressed snapshots are staged under:
      {date}/agent-forensics/{reports|snapshots}

    They are uploaded to the matching blob prefix. Existing enriched
    per-task eval_report.json blobs remain at:
      {date}/{benchmark_instance}/{model}_{benchmark_instance}_eval_report.json

    A date is removed from ToBeProcessed only after extraction, combined
    analysis, classification, compatibility enrichment, and every blob upload
    succeed.

.PARAMETER OutputPath
    Azure DevOps artifact staging directory.

.PARAMETER StorageAccountName
    Storage account containing ToBeProcessed, run_ids.json, and reports.

.PARAMETER ContainerName
    Blob container containing the benchmark reporting queue and artifacts.

.PARAMETER Benchmark
    Exact benchmark name to analyze. Default: azure.skill.

.PARAMETER KeyVaultName
    Key Vault containing the Copilot HMAC credentials.

.PARAMETER HmacKeySecretName
    Key Vault secret containing the Copilot HMAC signing key.

.PARAMETER HmacIntegrationIdSecretName
    Key Vault secret containing the matching Copilot integration ID.
#>

param(
    [string]$OutputPath,
    [string]$StorageAccountName,
    [string]$ContainerName,
    [string]$Benchmark = "azure.skill",
    [string]$KeyVaultName = "kv-msbench-eval-azuremcp",
    [string]$HmacKeySecretName = "azure-mcp-eval-capi-hmac",
    [string]$HmacIntegrationIdSecretName = "azure-mcp-eval-capi-id"
)

Set-StrictMode -Version Latest

$agentForensicsVersion = "0.4.0"
$pipelineRun = $env:TF_BUILD -eq "True"

function Assert-RequiredValue {
    param(
        [string]$Name,
        [string]$Value
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        throw "$Name is required."
    }
}

function Get-KeyVaultSecretValue {
    param(
        [string]$VaultName,
        [string]$SecretName
    )

    $value = az keyvault secret show `
        --vault-name $VaultName `
        --name $SecretName `
        --query value `
        -o tsv
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "Failed to retrieve Key Vault secret '$SecretName' from '$VaultName' (exit $exitCode)."
    }

    $secretValue = ($value -join "`n").Trim()
    if ([string]::IsNullOrWhiteSpace($secretValue)) {
        throw "Key Vault secret '$SecretName' in '$VaultName' is empty."
    }

    return $secretValue
}

function Invoke-BlobDownload {
    param(
        [string]$BlobName,
        [string]$Destination
    )

    if (Test-Path -LiteralPath $Destination) {
        Remove-Item -LiteralPath $Destination -Force -ErrorAction Stop
    }

    az storage blob download `
        --account-name $StorageAccountName `
        --container-name $ContainerName `
        --name $BlobName `
        --file $Destination `
        --auth-mode login `
        --only-show-errors | Out-Null
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0 -or !(Test-Path -LiteralPath $Destination)) {
        throw "Failed to download '$BlobName' from '$ContainerName' (exit $exitCode)."
    }
}

function Invoke-BlobUpload {
    param(
        [string]$Source,
        [string]$BlobName
    )

    az storage blob upload `
        --account-name $StorageAccountName `
        --container-name $ContainerName `
        --name $BlobName `
        --file $Source `
        --auth-mode login `
        --overwrite `
        --only-show-errors | Out-Null
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "Failed to upload '$Source' to '$ContainerName/$BlobName' (exit $exitCode)."
    }
}

function Get-RelativePathForBlob {
    param(
        [string]$BasePath,
        [string]$Path
    )

    return [System.IO.Path]::GetRelativePath($BasePath, $Path).Replace('\', '/')
}

function Get-EnrichedEvalReports {
    param(
        [string]$Date,
        [string[]]$RunIds,
        [string]$DataRoot,
        [string]$DateOutputPath
    )

    $benchmarkDataPath = Join-Path $DataRoot "$Date/$Benchmark"
    if (!(Test-Path -LiteralPath $benchmarkDataPath -PathType Container)) {
        throw "Expected extracted benchmark directory '$benchmarkDataPath' was not created."
    }

    $metadataFiles = @(
        Get-ChildItem -LiteralPath $benchmarkDataPath -Filter "run_metadata.json" -File -Recurse -ErrorAction Stop
    )
    if ($metadataFiles.Count -eq 0) {
        throw "No run_metadata.json files were found under '$benchmarkDataPath'."
    }

    $metadataRunIds = @($metadataFiles | ForEach-Object { $_.Directory.Name })
    $missingRunIds = @($RunIds | Where-Object { $_ -notin $metadataRunIds })
    if ($missingRunIds.Count -gt 0) {
        throw "Extracted metadata is missing run ID(s): $($missingRunIds -join ', ')."
    }

    $reports = @()
    foreach ($metadataFile in $metadataFiles) {
        $runDirectory = $metadataFile.Directory
        $runId = $runDirectory.Name
        if ($runId -notin $RunIds) {
            continue
        }

        $metadata = Get-Content -LiteralPath $metadataFile.FullName -Raw -ErrorAction Stop |
            ConvertFrom-Json -ErrorAction Stop
        if ([string]::IsNullOrWhiteSpace([string]$metadata.model)) {
            throw "Run '$runId' has no model in '$($metadataFile.FullName)'."
        }
        $model = ([string]$metadata.model) -replace '-autodev-test$', ''

        $instanceDirectories = @(
            Get-ChildItem -LiteralPath $runDirectory.FullName `
                -Directory `
                -Filter "azure.eval.x86_64.*-output" `
                -ErrorAction Stop
        )
        if ($instanceDirectories.Count -eq 0) {
            throw "Run '$runId' contains no Azure benchmark instance output directories."
        }

        foreach ($instanceDirectory in $instanceDirectories) {
            $instanceName = $instanceDirectory.Name `
                -replace '^azure\.eval\.x86_64\.', '' `
                -replace '-output$', ''
            $taskOutputPath = Join-Path $instanceDirectory.FullName "output"
            $evalReportPath = Join-Path $taskOutputPath "eval_report.json"
            $evalPath = Join-Path $taskOutputPath "eval.json"

            if (!(Test-Path -LiteralPath $evalReportPath -PathType Leaf)) {
                Write-Warning "No eval_report.json is available for run '$runId', instance '$instanceName'."
                continue
            }
            if (!(Test-Path -LiteralPath $evalPath -PathType Leaf)) {
                Write-Warning "No eval.json is available for run '$runId', instance '$instanceName'."
                continue
            }

            $evalContent = Get-Content -LiteralPath $evalReportPath -Raw -ErrorAction Stop |
                ConvertFrom-Json -ErrorAction Stop
            $evalJson = Get-Content -LiteralPath $evalPath -Raw -ErrorAction Stop |
                ConvertFrom-Json -ErrorAction Stop

            $resolvedValue = $null
            foreach ($property in $evalJson.PSObject.Properties) {
                if ($property.Value -is [psobject] -and
                    $property.Value.PSObject.Properties.Name -contains "resolved") {
                    $resolvedValue = $property.Value.resolved
                    break
                }
            }
            if ($null -eq $resolvedValue) {
                Write-Warning "eval.json has no resolved field for run '$runId', instance '$instanceName'."
            }

            $evalContent | Add-Member -NotePropertyName "model" -NotePropertyValue $model -Force
            $evalContent | Add-Member -NotePropertyName "instance_id" -NotePropertyValue $instanceName -Force
            if ($null -ne $resolvedValue) {
                $evalContent | Add-Member -NotePropertyName "resolved" -NotePropertyValue $resolvedValue -Force
            }

            $fileName = "${model}_${instanceName}_eval_report.json"
            $destination = Join-Path $DateOutputPath $fileName
            $evalContent |
                ConvertTo-Json -Depth 10 |
                Set-Content -LiteralPath $destination -Encoding UTF8 -ErrorAction Stop

            $reports += [pscustomobject]@{
                Source = $destination
                BlobName = "$Date/$instanceName/$fileName"
            }
        }
    }

    if ($reports.Count -eq 0) {
        throw "No compatibility eval_report.json files were generated for date '$Date'."
    }

    return $reports
}

Assert-RequiredValue -Name "OutputPath" -Value $OutputPath
Assert-RequiredValue -Name "StorageAccountName" -Value $StorageAccountName
Assert-RequiredValue -Name "ContainerName" -Value $ContainerName
Assert-RequiredValue -Name "Benchmark" -Value $Benchmark
Assert-RequiredValue -Name "KeyVaultName" -Value $KeyVaultName
Assert-RequiredValue -Name "HmacKeySecretName" -Value $HmacKeySecretName
Assert-RequiredValue -Name "HmacIntegrationIdSecretName" -Value $HmacIntegrationIdSecretName

New-Item -Path $OutputPath -ItemType Directory -Force -ErrorAction Stop | Out-Null

$tempRoot = if ([string]::IsNullOrWhiteSpace($env:AGENT_TEMPDIRECTORY)) {
    [System.IO.Path]::GetTempPath()
} else {
    $env:AGENT_TEMPDIRECTORY
}
$workingRoot = Join-Path $tempRoot "msbench-agent-forensics-$([guid]::NewGuid().ToString('N'))"
$dataRoot = Join-Path $workingRoot "data"
New-Item -Path $dataRoot -ItemType Directory -Force -ErrorAction Stop | Out-Null

try {
    Write-Host "Output Path: $OutputPath"
    Write-Host "Benchmark: $Benchmark"

    if ([string]::IsNullOrWhiteSpace($env:PIP_INDEX_URL) -and
        [string]::IsNullOrWhiteSpace($env:PIP_EXTRA_INDEX_URL)) {
        throw "No authenticated pip index is configured. PipAuthenticate@1 must authenticate the MicrosoftSweBench feed."
    }

    python -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 11) else 1)"
    if ($LASTEXITCODE -ne 0) {
        throw "Python 3.11 or later is required by msbench-agent-forensics."
    }
    Write-Host "Using Python: $(python --version 2>&1)"

    Write-Host "Installing msbench-cli and msbench-agent-forensics $agentForensicsVersion from configured feeds"
    python -m pip install `
        --upgrade `
        --no-input `
        msbench-cli `
        "msbench-agent-forensics==$agentForensicsVersion"
    if ($LASTEXITCODE -ne 0) {
        throw "Package installation failed. Ensure msbench-agent-forensics $agentForensicsVersion is published to the MicrosoftSweBench feed."
    }

    $installedVersion = python -c "import agent_forensics; print(agent_forensics.__version__)"
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to import the installed msbench-agent-forensics package."
    }
    $installedVersion = ($installedVersion -join "`n").Trim()
    if ($installedVersion -ne $agentForensicsVersion) {
        throw "Installed msbench-agent-forensics version '$installedVersion'; expected '$agentForensicsVersion'."
    }
    Write-Host "Installed msbench-agent-forensics $installedVersion"

    & "msbench-cli" version
    if ($LASTEXITCODE -ne 0) {
        throw "msbench-cli version failed with exit code $LASTEXITCODE."
    }

    $packageOutputPath = python -c "import agent_forensics, pathlib; print(pathlib.Path(agent_forensics.__file__).parent / 'output')"
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to resolve the Agent Forensics package output directory."
    }
    $packageOutputPath = ($packageOutputPath -join "`n").Trim()

    Write-Host "Retrieving Copilot HMAC credentials from Key Vault '$KeyVaultName'"
    $env:COPILOT_HMAC_KEY = Get-KeyVaultSecretValue `
        -VaultName $KeyVaultName `
        -SecretName $HmacKeySecretName
    $env:COPILOT_HMAC_INTEGRATION_ID = Get-KeyVaultSecretValue `
        -VaultName $KeyVaultName `
        -SecretName $HmacIntegrationIdSecretName

    $toBeProcessedLocal = Join-Path $workingRoot "ToBeProcessed"
    Invoke-BlobDownload -BlobName "ToBeProcessed" -Destination $toBeProcessedLocal
    $toBeProcessedArtifactPath = Join-Path $OutputPath "ToBeProcessed"
    Copy-Item `
        -LiteralPath $toBeProcessedLocal `
        -Destination $toBeProcessedArtifactPath `
        -Force `
        -ErrorAction Stop

    $queueEntries = @(
        Get-Content -LiteralPath $toBeProcessedLocal -ErrorAction Stop |
            ForEach-Object { $_.Trim() } |
            Where-Object { $_ }
    )
    $invalidEntries = @($queueEntries | Where-Object { $_ -notmatch '^\d{4}-\d{2}-\d{2}$' })
    if ($invalidEntries.Count -gt 0) {
        throw "ToBeProcessed contains invalid date value(s): $($invalidEntries -join ', ')."
    }
    $dates = @($queueEntries | Select-Object -Unique)
    if ($dates.Count -eq 0) {
        Write-Host "ToBeProcessed is empty. No action needed."
        return
    }

    Write-Host "Found $($dates.Count) date(s) to process: $($dates -join ', ')"
    $processedDates = @()
    $failedDates = @()

    foreach ($date in $dates) {
        try {
            Write-Host "`nProcessing date $date"
            $dateWorkingPath = Join-Path $workingRoot $date
            $dateSnapshotsPath = Join-Path $dateWorkingPath "snapshots"
            $dateOutputPath = Join-Path $OutputPath $date
            $dateAgentForensicsPath = Join-Path $dateOutputPath "agent-forensics"
            New-Item -Path $dateSnapshotsPath -ItemType Directory -Force -ErrorAction Stop | Out-Null
            New-Item -Path $dateOutputPath -ItemType Directory -Force -ErrorAction Stop | Out-Null
            if (Test-Path -LiteralPath $dateAgentForensicsPath) {
                Remove-Item -LiteralPath $dateAgentForensicsPath -Recurse -Force -ErrorAction Stop
            }

            $runIdsLocalPath = Join-Path $dateWorkingPath "run_ids.json"
            Invoke-BlobDownload -BlobName "$date/run_ids.json" -Destination $runIdsLocalPath
            Copy-Item `
                -LiteralPath $runIdsLocalPath `
                -Destination (Join-Path $OutputPath "run_ids_$date.json") `
                -Force `
                -ErrorAction Stop
            $runIdsJson = Get-Content -LiteralPath $runIdsLocalPath -Raw -ErrorAction Stop |
                ConvertFrom-Json -ErrorAction Stop
            $inputRunIds = @($runIdsJson | ForEach-Object { ([string]$_).Trim() })
            $invalidRunIds = @($inputRunIds | Where-Object { $_ -notmatch '^\d+$' })
            if ($inputRunIds.Count -eq 0 -or $invalidRunIds.Count -gt 0) {
                throw "Date '$date' has missing or invalid run IDs."
            }
            $inputRunIds = @($inputRunIds | Select-Object -Unique)

            Write-Host "Checking completion of run ID(s): $($inputRunIds -join ', ')"
            & "msbench-cli" resume --run-id ($inputRunIds -join ',')
            if ($LASTEXITCODE -ne 0) {
                throw "msbench-cli resume failed for date '$date' (exit $LASTEXITCODE)."
            }

            foreach ($runId in $inputRunIds) {
                Write-Host "Extracting run $runId into the shared data root"
                & "agent-forensics" extract `
                    --run_id $runId `
                    --run_date $date `
                    --data-dir $dataRoot
                if ($LASTEXITCODE -ne 0) {
                    throw "Agent Forensics extraction failed for run '$runId' (exit $LASTEXITCODE)."
                }
            }

            $benchmarkDataPath = Join-Path $dataRoot "$date/$Benchmark"
            if (!(Test-Path -LiteralPath $benchmarkDataPath -PathType Container)) {
                throw "Extraction did not produce the expected exact benchmark '$Benchmark' for date '$date'."
            }

            $analysisDirectoriesBefore = @()
            if (Test-Path -LiteralPath $packageOutputPath -PathType Container) {
                $analysisDirectoriesBefore = @(
                    Get-ChildItem -LiteralPath $packageOutputPath -Directory -ErrorAction Stop |
                        ForEach-Object { $_.Name }
                )
            }

            Write-Host "Running one combined Agent Forensics analysis for $Benchmark on $date"
            & "agent-forensics" analyze `
                --rundate $date `
                --benchmark $Benchmark `
                --exact_match `
                --formatter-mode both `
                --provider hmac `
                --data-dir $dataRoot `
                --snapshots-dir $dateSnapshotsPath
            if ($LASTEXITCODE -ne 0) {
                throw "Agent Forensics analysis failed for date '$date' (exit $LASTEXITCODE)."
            }

            $newAnalysisDirectories = @(
                Get-ChildItem -LiteralPath $packageOutputPath -Directory -ErrorAction Stop |
                    Where-Object { $_.Name -notin $analysisDirectoriesBefore }
            )
            if ($newAnalysisDirectories.Count -ne 1) {
                throw "Expected one new Agent Forensics analysis directory for '$date'; found $($newAnalysisDirectories.Count)."
            }
            $analysisDirectory = $newAnalysisDirectories[0]

            Write-Host "Classifying root causes using Copilot CLI with HMAC authentication"
            & "agent-forensics" classify `
                --rundate $date `
                --benchmark $Benchmark `
                --exact_match `
                --use-copilot `
                --provider hmac `
                --source snapshot-only `
                --data-dir $dataRoot `
                --snapshots-dir $dateSnapshotsPath
            if ($LASTEXITCODE -ne 0) {
                throw "Agent Forensics classification failed for date '$date' (exit $LASTEXITCODE)."
            }

            $scopeName = "bm=$Benchmark`__exact"
            $reportSourcePath = Join-Path $analysisDirectory.FullName "$date/$scopeName"
            $copilotReport = Join-Path $reportSourcePath "comprehensive-report.md"
            $deterministicReport = Join-Path $reportSourcePath "comprehensive-report-python.md"
            if (!(Test-Path -LiteralPath $copilotReport -PathType Leaf)) {
                throw "Copilot synthesis report was not generated at '$copilotReport'."
            }
            if (!(Test-Path -LiteralPath $deterministicReport -PathType Leaf)) {
                throw "Deterministic report was not generated at '$deterministicReport'."
            }

            $snapshotFiles = @(
                Get-ChildItem -LiteralPath $dateSnapshotsPath -File -Recurse -ErrorAction Stop
            )
            $compressedSnapshots = @($snapshotFiles | Where-Object { $_.Extension -eq ".gz" })
            if ($compressedSnapshots.Count -eq 0) {
                throw "No compressed Agent Forensics snapshot was generated for date '$date'."
            }

            $reportDestinationPath = Join-Path $dateAgentForensicsPath "reports"
            $snapshotDestinationPath = Join-Path $dateAgentForensicsPath "snapshots"
            New-Item -Path $reportDestinationPath -ItemType Directory -Force -ErrorAction Stop | Out-Null
            New-Item -Path $snapshotDestinationPath -ItemType Directory -Force -ErrorAction Stop | Out-Null
            Copy-Item -Path (Join-Path $reportSourcePath "*") `
                -Destination $reportDestinationPath `
                -Recurse `
                -Force `
                -ErrorAction Stop
            Copy-Item -Path (Join-Path $dateSnapshotsPath "*") `
                -Destination $snapshotDestinationPath `
                -Recurse `
                -Force `
                -ErrorAction Stop

            $compatibilityReports = @(
                Get-EnrichedEvalReports `
                    -Date $date `
                    -RunIds $inputRunIds `
                    -DataRoot $dataRoot `
                    -DateOutputPath $dateOutputPath
            )

            if ($pipelineRun) {
                Write-Host "##vso[task.uploadsummary]$copilotReport"
            }

            $agentForensicsFiles = @(
                Get-ChildItem -LiteralPath $dateAgentForensicsPath -File -Recurse -ErrorAction Stop
            )
            foreach ($file in $agentForensicsFiles) {
                $relativePath = Get-RelativePathForBlob `
                    -BasePath $dateAgentForensicsPath `
                    -Path $file.FullName
                Invoke-BlobUpload `
                    -Source $file.FullName `
                    -BlobName "$date/agent-forensics/$relativePath"
            }
            foreach ($report in $compatibilityReports) {
                Invoke-BlobUpload -Source $report.Source -BlobName $report.BlobName
            }

            $processedDates += $date
            Write-Host "Date '$date' processed and uploaded successfully."
        }
        catch {
            $failedDates += $date
            Write-Error "Date '$date' failed and will remain in ToBeProcessed: $($_.Exception.Message)" -ErrorAction Continue
        }
    }

    if ($processedDates.Count -gt 0) {
        $remainingDates = @($dates | Where-Object { $_ -notin $processedDates })
        if ($remainingDates.Count -eq 0) {
            Set-Content -LiteralPath $toBeProcessedLocal -Value "" -Encoding UTF8 -ErrorAction Stop
        } else {
            Set-Content `
                -LiteralPath $toBeProcessedLocal `
                -Value ($remainingDates -join "`n") `
                -Encoding UTF8 `
                -ErrorAction Stop
        }
        Copy-Item `
            -LiteralPath $toBeProcessedLocal `
            -Destination $toBeProcessedArtifactPath `
            -Force `
            -ErrorAction Stop
        Invoke-BlobUpload -Source $toBeProcessedLocal -BlobName "ToBeProcessed"
        Write-Host "Removed successfully processed date(s) from ToBeProcessed: $($processedDates -join ', ')."
    }

    if ($failedDates.Count -gt 0) {
        throw "Benchmark reporting failed for date(s): $($failedDates -join ', ')."
    }

    Write-Host "All queued dates processed successfully."
}
finally {
    Remove-Item Env:COPILOT_HMAC_KEY -ErrorAction SilentlyContinue
    Remove-Item Env:COPILOT_HMAC_INTEGRATION_ID -ErrorAction SilentlyContinue
    if (Test-Path -LiteralPath $workingRoot) {
        Remove-Item -LiteralPath $workingRoot -Recurse -Force -ErrorAction Continue
    }
}
