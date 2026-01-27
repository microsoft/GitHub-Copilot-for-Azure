# Azure Quick Review (azqr) Scan Scripts
# Common scanning scenarios for Azure compliance assessment

# =============================================================================
# Prerequisites
# =============================================================================

# Check if azqr is installed
function Test-AzqrInstalled {
    try {
        $null = Get-Command azqr -ErrorAction Stop
        return $true
    }
    catch {
        Write-Host "azqr is not installed. Install with: winget install azqr" -ForegroundColor Red
        return $false
    }
}

# Check Azure CLI authentication
function Test-AzureAuth {
    try {
        $account = az account show 2>$null | ConvertFrom-Json
        Write-Host "Authenticated as: $($account.user.name)" -ForegroundColor Green
        Write-Host "Subscription: $($account.name) ($($account.id))" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "Not authenticated. Run 'az login' first." -ForegroundColor Red
        return $false
    }
}

# =============================================================================
# Basic Scans
# =============================================================================

# Full subscription scan with all outputs
function Invoke-FullSubscriptionScan {
    param(
        [Parameter(Mandatory=$true)]
        [string]$SubscriptionId,
        
        [string]$OutputName = "azqr-scan-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    )
    
    Write-Host "Starting full subscription scan..." -ForegroundColor Cyan
    azqr scan -s $SubscriptionId --json --xlsx --output-name $OutputName
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Scan complete. Reports saved:" -ForegroundColor Green
        Write-Host "  - $OutputName.xlsx" -ForegroundColor Gray
        Write-Host "  - $OutputName.json" -ForegroundColor Gray
    }
}

# Resource group scan
function Invoke-ResourceGroupScan {
    param(
        [Parameter(Mandatory=$true)]
        [string]$SubscriptionId,
        
        [Parameter(Mandatory=$true)]
        [string]$ResourceGroupName,
        
        [string]$OutputName = "azqr-rg-scan-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    )
    
    Write-Host "Starting resource group scan: $ResourceGroupName..." -ForegroundColor Cyan
    azqr scan -s $SubscriptionId -g $ResourceGroupName --json --xlsx --output-name $OutputName
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Scan complete. Reports saved to $OutputName.*" -ForegroundColor Green
    }
}

# Management group scan (enterprise-wide)
function Invoke-ManagementGroupScan {
    param(
        [Parameter(Mandatory=$true)]
        [string]$ManagementGroupId,
        
        [string]$OutputName = "azqr-mg-scan-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    )
    
    Write-Host "Starting management group scan: $ManagementGroupId..." -ForegroundColor Cyan
    Write-Host "This may take a while for large environments..." -ForegroundColor Yellow
    azqr scan --management-group-id $ManagementGroupId --json --xlsx --output-name $OutputName
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Scan complete. Reports saved to $OutputName.*" -ForegroundColor Green
    }
}

# =============================================================================
# Service-Specific Scans
# =============================================================================

# Scan specific service type only
function Invoke-ServiceScan {
    param(
        [Parameter(Mandatory=$true)]
        [string]$SubscriptionId,
        
        [Parameter(Mandatory=$true)]
        [ValidateSet('aks','apim','appcs','asp','ca','cosmos','cr','kv','lb','mysql','psql','redis','sb','sql','st','vm','vmss','vnet')]
        [string]$ServiceType,
        
        [string]$OutputName = "azqr-$ServiceType-scan-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    )
    
    Write-Host "Starting $ServiceType service scan..." -ForegroundColor Cyan
    azqr scan $ServiceType -s $SubscriptionId --json --xlsx --output-name $OutputName
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Scan complete. Reports saved to $OutputName.*" -ForegroundColor Green
    }
}

# =============================================================================
# Advanced Scans
# =============================================================================

# Scan without cost analysis (for users without Cost Management access)
function Invoke-ScanNoCost {
    param(
        [Parameter(Mandatory=$true)]
        [string]$SubscriptionId,
        
        [string]$OutputName = "azqr-scan-nocost-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    )
    
    Write-Host "Starting scan (cost analysis disabled)..." -ForegroundColor Cyan
    azqr scan -s $SubscriptionId -c=false --json --xlsx --output-name $OutputName
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Scan complete. Reports saved to $OutputName.*" -ForegroundColor Green
    }
}

# Scan with plugins (carbon emissions, zone mapping, OpenAI throttling)
function Invoke-ScanWithPlugins {
    param(
        [Parameter(Mandatory=$true)]
        [string]$SubscriptionId,
        
        [switch]$CarbonEmissions,
        [switch]$ZoneMapping,
        [switch]$OpenAIThrottling,
        
        [string]$OutputName = "azqr-scan-plugins-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    )
    
    $pluginArgs = @()
    if ($CarbonEmissions) { $pluginArgs += "--plugin carbon-emissions" }
    if ($ZoneMapping) { $pluginArgs += "--plugin zone-mapping" }
    if ($OpenAIThrottling) { $pluginArgs += "--plugin openai-throttling" }
    
    if ($pluginArgs.Count -eq 0) {
        Write-Host "No plugins specified. Use -CarbonEmissions, -ZoneMapping, or -OpenAIThrottling" -ForegroundColor Yellow
        return
    }
    
    Write-Host "Starting scan with plugins: $($pluginArgs -join ', ')..." -ForegroundColor Cyan
    $command = "azqr scan -s $SubscriptionId $($pluginArgs -join ' ') --json --xlsx --output-name $OutputName"
    Invoke-Expression $command
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Scan complete. Reports saved to $OutputName.*" -ForegroundColor Green
    }
}

# =============================================================================
# Comparison Workflows
# =============================================================================

# Create baseline scan for later comparison
function New-BaselineScan {
    param(
        [Parameter(Mandatory=$true)]
        [string]$SubscriptionId,
        
        [string]$BaselineName = "baseline-$(Get-Date -Format 'yyyyMMdd')"
    )
    
    Write-Host "Creating baseline scan: $BaselineName..." -ForegroundColor Cyan
    azqr scan -s $SubscriptionId --xlsx --output-name $BaselineName
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Baseline saved: $BaselineName.xlsx" -ForegroundColor Green
        Write-Host "Use Compare-AzqrScans to compare with future scans." -ForegroundColor Gray
    }
}

# Compare two scan reports
function Compare-AzqrScans {
    param(
        [Parameter(Mandatory=$true)]
        [string]$BaselineReport,
        
        [Parameter(Mandatory=$true)]
        [string]$CurrentReport,
        
        [string]$OutputFile = "comparison-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt"
    )
    
    if (-not (Test-Path $BaselineReport)) {
        Write-Host "Baseline report not found: $BaselineReport" -ForegroundColor Red
        return
    }
    
    if (-not (Test-Path $CurrentReport)) {
        Write-Host "Current report not found: $CurrentReport" -ForegroundColor Red
        return
    }
    
    Write-Host "Comparing scans..." -ForegroundColor Cyan
    azqr compare --file1 $BaselineReport --file2 $CurrentReport --output $OutputFile
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Comparison saved: $OutputFile" -ForegroundColor Green
        Get-Content $OutputFile | Write-Host
    }
}

# =============================================================================
# Interactive Dashboard
# =============================================================================

# Launch web dashboard for a report
function Show-AzqrDashboard {
    param(
        [Parameter(Mandatory=$true)]
        [string]$ReportFile
    )
    
    if (-not (Test-Path $ReportFile)) {
        Write-Host "Report not found: $ReportFile" -ForegroundColor Red
        return
    }
    
    Write-Host "Launching dashboard for $ReportFile..." -ForegroundColor Cyan
    azqr show -f $ReportFile --open
}

# =============================================================================
# Utility Functions
# =============================================================================

# List all supported service types
function Get-AzqrServiceTypes {
    Write-Host "Supported Azure service types:" -ForegroundColor Cyan
    azqr types
}

# List all recommendations
function Get-AzqrRules {
    param(
        [switch]$AsJson
    )
    
    if ($AsJson) {
        azqr rules --json
    } else {
        azqr rules
    }
}

# =============================================================================
# Example Usage
# =============================================================================

Write-Host @"

Azure Quick Review (azqr) Scan Functions
=========================================

Prerequisites:
  Test-AzqrInstalled       - Check if azqr is installed
  Test-AzureAuth           - Check Azure CLI authentication

Basic Scans:
  Invoke-FullSubscriptionScan -SubscriptionId <sub-id>
  Invoke-ResourceGroupScan -SubscriptionId <sub-id> -ResourceGroupName <rg-name>
  Invoke-ManagementGroupScan -ManagementGroupId <mg-id>

Service-Specific Scans:
  Invoke-ServiceScan -SubscriptionId <sub-id> -ServiceType <st|aks|sql|...>

Advanced Scans:
  Invoke-ScanNoCost -SubscriptionId <sub-id>
  Invoke-ScanWithPlugins -SubscriptionId <sub-id> -CarbonEmissions -ZoneMapping

Comparison Workflows:
  New-BaselineScan -SubscriptionId <sub-id>
  Compare-AzqrScans -BaselineReport baseline.xlsx -CurrentReport current.xlsx

Dashboard:
  Show-AzqrDashboard -ReportFile report.xlsx

Utilities:
  Get-AzqrServiceTypes     - List supported service types
  Get-AzqrRules            - List all recommendations

"@ -ForegroundColor Gray
