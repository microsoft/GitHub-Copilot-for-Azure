<#
.SYNOPSIS
    Runs the standard Azure CLI pre-deployment validation sequence for a Bicep
    template and reports PASS/FAIL for each step. Shared by the AZCLI and Bicep
    validation recipes.
.DESCRIPTION
    Executes, in order:
      1. az version         - Azure CLI is installed
      2. az account show    - authenticated to Azure
      3. az bicep build     - template compiles cleanly
      4. az deployment ... validate  - template validates against the target scope
      5. az deployment ... what-if   - preview changes (Create/Modify/Delete summary)
    Emits a per-step PASS/FAIL summary and an OVERALL result. Exits 1 if any step fails.
.PARAMETER Scope
    Deployment scope: 'sub' or 'group' (required).
.PARAMETER Location
    Location (required when -Scope sub).
.PARAMETER ResourceGroup
    Resource group name (required when -Scope group).
.PARAMETER Template
    Bicep template path. Default: ./infra/main.bicep
.PARAMETER Parameters
    Parameters file path. Default: ./infra/main.parameters.json
    (skipped automatically if the file does not exist).
.PARAMETER Subscription
    Subscription to target (optional).
.EXAMPLE
    .\validate-deployment.ps1 -Scope sub -Location eastus
.EXAMPLE
    .\validate-deployment.ps1 -Scope group -ResourceGroup my-rg `
        -Template ./infra/main.bicep -Parameters ./infra/main.parameters.json
#>
param(
    [ValidateSet("sub", "group")][string]$Scope,
    [string]$Location,
    [string]$ResourceGroup,
    [string]$Template = "./infra/main.bicep",
    [string]$Parameters = "./infra/main.parameters.json",
    [string]$Subscription
)

# Validate arguments
if (-not $Scope) {
    Write-Error "-Scope is required and must be 'sub' or 'group'."
    exit 2
}
if ($Scope -eq "sub" -and -not $Location) {
    Write-Error "-Location is required when -Scope is 'sub'."
    exit 2
}
if ($Scope -eq "group" -and -not $ResourceGroup) {
    Write-Error "-ResourceGroup is required when -Scope is 'group'."
    exit 2
}

# Build shared argument arrays
$subArgs = @()
if ($Subscription) { $subArgs = @("--subscription", $Subscription) }

$paramArgs = @()
if (Test-Path $Parameters) {
    $paramArgs = @("--parameters", $Parameters)
} else {
    Write-Host "NOTE: parameters file '$Parameters' not found; validating without --parameters."
}

if ($Scope -eq "sub") {
    $scopeTargetArgs = @("--location", $Location)
    $scopeDesc = "subscription (location: $Location)"
} else {
    $scopeTargetArgs = @("--resource-group", $ResourceGroup)
    $scopeDesc = "resource group '$ResourceGroup'"
}

# Track results
$steps = [System.Collections.ArrayList]@()
$overall = 0

function Add-Result([string]$Name, [string]$Result) {
    [void]$steps.Add([PSCustomObject]@{ Step = $Name; Result = $Result })
    if ($Result -ne "PASS") { $script:overall = 1 }
}

Write-Host "=== Azure deployment validation ==="
Write-Host "Template:   $Template"
Write-Host "Scope:      $scopeDesc"
Write-Host ""

# Step 1: Azure CLI installed
Write-Host "--- Step 1: Azure CLI installed (az version) ---"
az version *> $null
if ($LASTEXITCODE -eq 0) {
    Write-Host "PASS: Azure CLI is installed."
    Add-Result "Azure CLI installed" "PASS"
} else {
    Write-Host "FAIL: Azure CLI not found. Install it, then re-run."
    Add-Result "Azure CLI installed" "FAIL"
    Write-Host ""
    Write-Host "=== Summary ==="
    $steps | Format-Table -AutoSize | Out-String | Write-Host
    Write-Host "OVERALL: FAIL"
    exit 1
}
Write-Host ""

# Step 2: Authenticated
Write-Host "--- Step 2: Authenticated (az account show) ---"
$accountJson = az account show @subArgs -o json 2>$null
if ($accountJson) {
    $accountName = ($accountJson | ConvertFrom-Json).name
    Write-Host "PASS: Authenticated (subscription: $accountName)."
    Add-Result "Authenticated" "PASS"
} else {
    Write-Host "FAIL: Not logged in. Run 'az login' (and 'az account set --subscription <id>')."
    Add-Result "Authenticated" "FAIL"
}
Write-Host ""

# Step 3: Bicep compilation
Write-Host "--- Step 3: Bicep compilation (az bicep build) ---"
$buildOutput = az bicep build --file $Template 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "PASS: Template compiles cleanly."
    Add-Result "Bicep compilation" "PASS"
} else {
    Write-Host "FAIL: Bicep compilation errors:"
    Write-Host ($buildOutput | Out-String)
    Add-Result "Bicep compilation" "FAIL"
}
Write-Host ""

# Step 4: Template validation
Write-Host "--- Step 4: Template validation (az deployment $Scope validate) ---"
$validateOutput = az deployment $Scope validate @scopeTargetArgs --template-file $Template @paramArgs @subArgs 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "PASS: Template validated against the target scope."
    Add-Result "Template validation" "PASS"
} else {
    Write-Host "FAIL: Template validation errors:"
    Write-Host ($validateOutput | Out-String)
    Add-Result "Template validation" "FAIL"
}
Write-Host ""

# Step 5: What-if preview
Write-Host "--- Step 5: What-if preview (az deployment $Scope what-if) ---"
$whatifOutput = az deployment $Scope what-if @scopeTargetArgs --template-file $Template @paramArgs @subArgs 2>&1
if ($LASTEXITCODE -eq 0) {
    $lines = $whatifOutput | Out-String -Stream
    $createCount = ($lines | Where-Object { $_ -match '^\s*\+ ' }).Count
    $modifyCount = ($lines | Where-Object { $_ -match '^\s*~ ' }).Count
    $deleteCount = ($lines | Where-Object { $_ -match '^\s*- ' }).Count
    Write-Host "PASS: What-if completed. Changes -> Create: $createCount, Modify: $modifyCount, Delete: $deleteCount"
    Add-Result "What-if preview" "PASS"
} else {
    Write-Host "FAIL: What-if errors:"
    Write-Host ($whatifOutput | Out-String)
    Add-Result "What-if preview" "FAIL"
}
Write-Host ""

# Summary
Write-Host "=== Summary ==="
$steps | Format-Table -AutoSize | Out-String | Write-Host
if ($overall -eq 0) {
    Write-Host "OVERALL: PASS"
} else {
    Write-Host "OVERALL: FAIL"
}
exit $overall
