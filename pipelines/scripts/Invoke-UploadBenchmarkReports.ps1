<#
.SYNOPSIS
    Uploads benchmark reports to Azure Blob Storage organized by date and skill name.

.DESCRIPTION
    This script uploads generated MSBench benchmark report files to a blob container,
    organizing them by date (yyyy-MM-dd) and parsed skill name.

    Blob path format: {date}/{skill_name}/{filename}

    Skill name is extracted from the report filename by matching against known skill
    categories. If no match is found, the full base name is used as a fallback.

.PARAMETER ReportPath
    Directory path containing the generated benchmark report markdown files.

.PARAMETER StorageAccountName
    The Azure Storage account name to upload to.

.PARAMETER ContainerName
    The blob container name to upload to.

.PARAMETER Date
    Optional date string in yyyy-MM-dd format. Defaults to today's date.
#>

param(
    [Parameter(Mandatory=$true)][ValidateNotNullOrEmpty()][string]$ReportPath,
    [Parameter(Mandatory=$true)][ValidateNotNullOrEmpty()][string]$StorageAccountName,
    [Parameter(Mandatory=$true)][ValidateNotNullOrEmpty()][string]$ContainerName,
    [Parameter(Mandatory=$false)][string]$Date
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

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
$reports = Get-ChildItem -Path $ReportPath -Filter '*.md' |
           Where-Object { $_.DirectoryName -notlike '*copilot_log*' }

if (-not $reports -or $reports.Count -eq 0) {
    Write-Warning "No report files found in $ReportPath"
    exit 0
}

Write-Host "Found $($reports.Count) report(s) to upload"

$successCount = 0
$failCount = 0

foreach ($report in $reports) {
    $skillName = Get-SkillName -FileName $report.Name
    $blobPath = "$Date/$skillName/$($report.Name)"

    Write-Host "Uploading $($report.Name) -> $ContainerName/$blobPath (skill: $skillName)"

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
}

Write-Host "`nUpload complete: $successCount succeeded, $failCount failed (container: $ContainerName/$Date/)"

if ($failCount -gt 0) {
    Write-Error "$failCount report upload(s) failed."
    exit 1
}
