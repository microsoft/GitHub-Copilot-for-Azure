<#
.SYNOPSIS
    Checks Azure quota requirements.
.DESCRIPTION
    Discovers quota resource names and queries limits and usage through Azure
    Quota. Batch input can supply an ARM resource type and documented limit for
    the Azure Resource Graph fallback used only when Azure Quota returns
    BadRequest.
.PARAMETER ResourceProvider
    Provider namespace for legacy mode.
.PARAMETER Region
    Azure region. Required in all modes.
.PARAMETER ResourceName
    Optional single quota resource name in legacy mode.
.PARAMETER SubscriptionId
    Subscription ID. Defaults to the current subscription.
.PARAMETER RequirementsFile
    UTF-8 JSON batch requirements file.
.PARAMETER Help
    Displays usage.
.EXAMPLE
    .\check-quota.ps1 Microsoft.Compute eastus standardDSv3Family
.EXAMPLE
    .\check-quota.ps1 -Region eastus -RequirementsFile .\requirements.json

Exit codes: 0 = all requirements pass or are near limit; 1 = insufficient
capacity or an operational error; 2 = invalid arguments.
#>
param(
    [string]$ResourceProvider,
    [string]$Region,
    [string]$ResourceName,
    [string]$SubscriptionId,
    [string]$RequirementsFile,
    [switch]$Help
)

function Show-Usage {
    @'
Usage:
  .\check-quota.ps1 <provider> <region> [quota-resource-name] [subscription-id]
  .\check-quota.ps1 -Region <region> -RequirementsFile <json-file> [-SubscriptionId <id>]
  .\check-quota.ps1 -Help

Legacy mode checks every quota for a provider, or one quota when its resource
name is supplied. Requested count is zero in legacy mode.

Batch mode reads a UTF-8 JSON array. Each object requires provider,
resourceName, and requested. Optional resourceType and documentedLimit must be
supplied together. They are used only when Azure Quota returns BadRequest, in
which case current usage is counted with Azure Resource Graph.

  [{"provider":"Microsoft.Compute","resourceName":"standardDSv3Family",
    "requested":2}]

Status is INSUFFICIENT when projected usage exceeds the limit, NEAR-LIMIT when
projected usage is at least 80% of a positive limit, and PASS otherwise.
'@ | Write-Output
}

function Exit-Invalid {
    param([string]$Message)
    Write-Error "Error: $Message"
    Show-Usage | ForEach-Object { [Console]::Error.WriteLine($_) }
    exit 2
}

function Exit-Operational {
    param([string]$Message)
    Write-Error "Error: $Message"
    exit 1
}

function Test-NonnegativeInteger {
    param([string]$Value)
    $parsed = 0L
    return [long]::TryParse($Value, [ref]$parsed) -and $parsed -ge 0
}

function Test-JsonNonnegativeInteger {
    param($Value)
    if ($Value -is [bool] -or
        ($Value -isnot [byte] -and $Value -isnot [sbyte] -and
         $Value -isnot [int16] -and $Value -isnot [uint16] -and
         $Value -isnot [int32] -and $Value -isnot [uint32] -and
         $Value -isnot [int64] -and $Value -isnot [uint64])) {
        return $false
    }
    return [decimal]$Value -ge 0
}

function Invoke-AzToFiles {
    param([string[]]$Arguments)
    & az @Arguments 1> $script:OutFile 2> $script:ErrFile
    return $LASTEXITCODE
}

function Get-AzError {
    try {
        $text = [IO.File]::ReadAllText($script:ErrFile)
    }
    catch {
        Exit-Operational "could not read Azure CLI error output: $($_.Exception.Message)"
    }
    if ([string]::IsNullOrWhiteSpace($text)) {
        return "Azure CLI returned no error details"
    }
    return ($text -split "\r?\n")[0]
}

function Test-BadRequest {
    try {
        return [IO.File]::ReadAllText($script:ErrFile).Contains("BadRequest")
    }
    catch {
        Exit-Operational "could not read Azure CLI error output: $($_.Exception.Message)"
    }
}

function Get-FirstOutputLine {
    param([string]$Description)
    try {
        $lines = @(Get-Content -LiteralPath $script:OutFile -ErrorAction Stop)
    }
    catch {
        Exit-Operational "could not read ${Description}: $($_.Exception.Message)"
    }
    if ($lines.Count -eq 0) {
        Exit-Operational "$Description returned no value."
    }
    return ([string]$lines[0]).Trim()
}

function Ensure-Extension {
    param([string]$Name)
    $code = Invoke-AzToFiles @("extension", "list", "--query", "[?name=='$Name'].name", "-o", "tsv")
    if ($code -ne 0) {
        Exit-Operational "could not list Azure CLI extensions: $(Get-AzError)"
    }
    $installed = ""
    try {
        $installed = ([IO.File]::ReadAllText($script:OutFile)).Trim()
    }
    catch {
        Exit-Operational "could not read Azure CLI extension output: $($_.Exception.Message)"
    }
    if ([string]::IsNullOrWhiteSpace($installed)) {
        [Console]::Error.WriteLine("Installing Azure CLI extension '$Name'...")
        $code = Invoke-AzToFiles @("extension", "add", "--name", $Name, "--yes")
        if ($code -ne 0) {
            Exit-Operational "could not install '$Name': $(Get-AzError)"
        }
    }
}

function Assert-ProviderAndRegion {
    param([string]$Provider)
    if ([string]::IsNullOrWhiteSpace($Provider) -or $Provider -notmatch '^[A-Za-z0-9._-]+$') {
        Exit-Invalid "invalid resource provider '$Provider'."
    }
    if ([string]::IsNullOrWhiteSpace($script:Region) -or $script:Region -notmatch '^[A-Za-z0-9-]+$') {
        Exit-Invalid "invalid region '$script:Region'."
    }
}

function Update-Overall {
    param([string]$Status)
    if ($Status -eq "INSUFFICIENT") {
        $script:Overall = "INSUFFICIENT"
    }
    elseif ($Status -eq "NEAR-LIMIT" -and $script:Overall -eq "PASS") {
        $script:Overall = "NEAR-LIMIT"
    }
}

function Write-Result {
    param(
        [string]$Provider,
        [string]$QuotaName,
        [long]$Requested,
        [long]$Current,
        [long]$Limit,
        [string]$Source
    )
    $projected = $Current + $Requested
    $available = $Limit - $Current
    if ($projected -gt $Limit) {
        $status = "INSUFFICIENT"
    }
    elseif ($Limit -gt 0 -and ($projected * 100) -ge ($Limit * 80)) {
        $status = "NEAR-LIMIT"
    }
    else {
        $status = "PASS"
    }
    Update-Overall $status
    Write-Output (($Provider, $QuotaName, $script:Region, $Requested, $Current, $Limit,
        $projected, $available, $status, $Source) -join "`t")
}

function Invoke-ResourceGraphFallback {
    param(
        [string]$Provider,
        [string]$QuotaName,
        [long]$Requested,
        [string]$ArmType,
        [string]$DocumentedLimit
    )
    if ([string]::IsNullOrWhiteSpace($ArmType) -or [string]::IsNullOrWhiteSpace($DocumentedLimit)) {
        Exit-Operational "Azure Quota returned BadRequest for '$QuotaName'; ARM resource type and documented limit are required for fallback."
    }
    if ($ArmType -notmatch '^[A-Za-z0-9._/-]+$') {
        Exit-Invalid "invalid ARM resource type '$ArmType'."
    }
    if (-not (Test-NonnegativeInteger $DocumentedLimit)) {
        Exit-Invalid "documented limit for '$QuotaName' must be a non-negative integer."
    }

    Ensure-Extension "resource-graph"
    $query = "Resources | where type =~ '$ArmType' and location =~ '$script:Region' | summarize count()"
    $code = Invoke-AzToFiles @("graph", "query", "--subscriptions", $script:SubscriptionId,
        "-q", $query, "--query", "data[0].count_", "-o", "tsv")
    if ($code -ne 0) {
        Exit-Operational "Resource Graph count failed for '$ArmType': $(Get-AzError)"
    }
    $currentText = Get-FirstOutputLine "Resource Graph count for '$ArmType'"
    if (-not (Test-NonnegativeInteger $currentText)) {
        Exit-Operational "Resource Graph returned a non-integer count for '$ArmType'."
    }
    Write-Result $Provider $QuotaName $Requested ([long]$currentText) ([long]$DocumentedLimit) "ResourceGraph"
}

function Test-Requirement {
    param(
        [string]$Provider,
        [string]$QuotaName,
        [string]$RequestedText,
        [string]$ArmType,
        [string]$DocumentedLimit
    )
    Assert-ProviderAndRegion $Provider
    if ([string]::IsNullOrWhiteSpace($QuotaName)) {
        Exit-Invalid "quota resource name cannot be empty."
    }
    if (-not (Test-NonnegativeInteger $RequestedText)) {
        Exit-Invalid "requested count for '$QuotaName' must be a non-negative integer."
    }
    if (([string]::IsNullOrWhiteSpace($ArmType)) -ne ([string]::IsNullOrWhiteSpace($DocumentedLimit))) {
        Exit-Invalid "ARM resource type and documented limit must be supplied together for '$QuotaName'."
    }

    $scope = "/subscriptions/$script:SubscriptionId/providers/$Provider/locations/$script:Region"
    $code = Invoke-AzToFiles @("quota", "list", "--scope", $scope, "--query", "[].name", "-o", "tsv")
    if ($code -ne 0) {
        if (Test-BadRequest) {
            Invoke-ResourceGraphFallback $Provider $QuotaName ([long]$RequestedText) $ArmType $DocumentedLimit
            return
        }
        Exit-Operational "quota discovery failed for '$Provider': $(Get-AzError)"
    }
    try {
        $names = @(Get-Content -LiteralPath $script:OutFile -ErrorAction Stop)
    }
    catch {
        Exit-Operational "could not read quota discovery output: $($_.Exception.Message)"
    }
    $discovered = $names | Where-Object { ([string]$_).Trim() -ceq $QuotaName } | Select-Object -First 1
    if ($null -eq $discovered) {
        Exit-Operational "quota resource '$QuotaName' was not returned by quota discovery for '$Provider'."
    }

    $code = Invoke-AzToFiles @("quota", "show", "--resource-name", $QuotaName, "--scope", $scope,
        "--query", "properties.limit.value", "-o", "tsv")
    if ($code -ne 0) {
        if (Test-BadRequest) {
            Invoke-ResourceGraphFallback $Provider $QuotaName ([long]$RequestedText) $ArmType $DocumentedLimit
            return
        }
        Exit-Operational "quota limit query failed for '$QuotaName': $(Get-AzError)"
    }
    $limitText = Get-FirstOutputLine "quota limit query for '$QuotaName'"

    $code = Invoke-AzToFiles @("quota", "usage", "show", "--resource-name", $QuotaName, "--scope", $scope,
        "--query", "properties.usages.value", "-o", "tsv")
    if ($code -ne 0) {
        if (Test-BadRequest) {
            Invoke-ResourceGraphFallback $Provider $QuotaName ([long]$RequestedText) $ArmType $DocumentedLimit
            return
        }
        Exit-Operational "quota usage query failed for '$QuotaName': $(Get-AzError)"
    }
    $currentText = Get-FirstOutputLine "quota usage query for '$QuotaName'"

    if (-not (Test-NonnegativeInteger $limitText)) {
        Exit-Operational "quota limit for '$QuotaName' is not a non-negative integer."
    }
    if (-not (Test-NonnegativeInteger $currentText)) {
        Exit-Operational "quota usage for '$QuotaName' is not a non-negative integer."
    }
    Write-Result $Provider $QuotaName ([long]$RequestedText) ([long]$currentText) ([long]$limitText) "QuotaAPI"
}

if ($Help) {
    Show-Usage
    exit 0
}

$batchMode = -not [string]::IsNullOrWhiteSpace($RequirementsFile)
if ($batchMode) {
    if (-not [string]::IsNullOrWhiteSpace($ResourceProvider) -or -not [string]::IsNullOrWhiteSpace($ResourceName)) {
        Exit-Invalid "ResourceProvider and ResourceName cannot be combined with RequirementsFile."
    }
    if ([string]::IsNullOrWhiteSpace($Region)) {
        Exit-Invalid "Region is required in batch mode."
    }
    if (-not (Test-Path -LiteralPath $RequirementsFile -PathType Leaf)) {
        Exit-Invalid "requirements file '$RequirementsFile' is not a readable file."
    }
}
elseif ([string]::IsNullOrWhiteSpace($ResourceProvider) -or [string]::IsNullOrWhiteSpace($Region)) {
    Exit-Invalid "ResourceProvider and Region are required in legacy mode."
}

if ($Region -notmatch '^[A-Za-z0-9-]+$') {
    Exit-Invalid "invalid region '$Region'."
}

$script:Region = $Region
$script:SubscriptionId = $SubscriptionId
$script:OutFile = Join-Path (Get-Location).Path ".check-quota.$PID.out"
$script:ErrFile = Join-Path (Get-Location).Path ".check-quota.$PID.err"
$namesFile = Join-Path (Get-Location).Path ".check-quota.$PID.names"

$requirements = @()
if ($batchMode) {
    try {
        $json = [IO.File]::ReadAllText((Resolve-Path -LiteralPath $RequirementsFile -ErrorAction Stop))
        if ([string]::IsNullOrWhiteSpace($json) -or $json.TrimStart()[0] -ne '[') {
            Exit-Invalid "requirements file root value must be an array."
        }
        $requirements = @($json | ConvertFrom-Json -ErrorAction Stop)
    }
    catch {
        Exit-Invalid "could not read requirements file '$RequirementsFile': $($_.Exception.Message)"
    }
    if ($requirements.Count -eq 0) {
        Exit-Invalid "requirements file contains no requirements."
    }
}

if ($null -eq (Get-Command az -ErrorAction SilentlyContinue)) {
    Exit-Operational "Azure CLI 'az' is not installed."
}

try {
    Ensure-Extension "quota"
    if ([string]::IsNullOrWhiteSpace($script:SubscriptionId)) {
        $code = Invoke-AzToFiles @("account", "show", "--query", "id", "-o", "tsv")
        if ($code -ne 0) {
            Exit-Operational "could not resolve the current Azure subscription: $(Get-AzError)"
        }
        $script:SubscriptionId = Get-FirstOutputLine "current Azure subscription query"
    }

    $script:Overall = "PASS"
    Write-Output "Provider`tQuotaResource`tRegion`tRequested`tCurrentUsage`tLimit`tProjectedUsage`tAvailable`tStatus`tSource"

    if ($batchMode) {
        $requirementCount = 0
        foreach ($requirement in $requirements) {
            if ($null -eq $requirement -or $requirement -isnot [PSCustomObject]) {
                Exit-Invalid "requirement item $requirementCount must be an object."
            }
            $names = @($requirement.PSObject.Properties.Name)
            foreach ($requiredName in @("provider", "resourceName", "requested")) {
                if ($names -cnotcontains $requiredName) {
                    Exit-Invalid "requirement item $requirementCount is missing '$requiredName'."
                }
            }
            foreach ($name in $names) {
                if (@("provider", "resourceName", "requested", "resourceType", "documentedLimit") -cnotcontains $name) {
                    Exit-Invalid "requirement item $requirementCount has unknown field '$name'."
                }
            }
            if ($requirement.provider -isnot [string] -or $requirement.resourceName -isnot [string]) {
                Exit-Invalid "requirement item $requirementCount provider and resourceName must be strings."
            }
            if (-not (Test-JsonNonnegativeInteger $requirement.requested)) {
                Exit-Invalid "requirement item $requirementCount requested must be a non-negative integer."
            }
            $resourceType = if ($names -ccontains "resourceType" -and $null -ne $requirement.resourceType) {
                if ($requirement.resourceType -isnot [string]) {
                    Exit-Invalid "requirement item $requirementCount resourceType must be a string."
                }
                [string]$requirement.resourceType
            } else { "" }
            $documentedLimit = if ($names -ccontains "documentedLimit" -and $null -ne $requirement.documentedLimit) {
                if (-not (Test-JsonNonnegativeInteger $requirement.documentedLimit)) {
                    Exit-Invalid "requirement item $requirementCount documentedLimit must be a non-negative integer."
                }
                [string]$requirement.documentedLimit
            } else { "" }
            Test-Requirement ([string]$requirement.provider) ([string]$requirement.resourceName) `
                ([string]$requirement.requested) $resourceType $documentedLimit
            $requirementCount++
        }
    }
    elseif (-not [string]::IsNullOrWhiteSpace($ResourceName)) {
        Test-Requirement $ResourceProvider $ResourceName "0" "" ""
    }
    else {
        Assert-ProviderAndRegion $ResourceProvider
        $scope = "/subscriptions/$script:SubscriptionId/providers/$ResourceProvider/locations/$script:Region"
        $code = Invoke-AzToFiles @("quota", "list", "--scope", $scope, "--query", "[].name", "-o", "tsv")
        if ($code -ne 0) {
            Exit-Operational "quota discovery failed for '$ResourceProvider': $(Get-AzError)"
        }
        Copy-Item -LiteralPath $script:OutFile -Destination $namesFile -ErrorAction Stop
        $names = @(Get-Content -LiteralPath $namesFile -ErrorAction Stop)
        $quotaCount = 0
        foreach ($name in $names) {
            $quotaName = ([string]$name).Trim()
            if ([string]::IsNullOrWhiteSpace($quotaName)) {
                continue
            }
            Test-Requirement $ResourceProvider $quotaName "0" "" ""
            $quotaCount++
        }
        if ($quotaCount -eq 0) {
            Exit-Operational "quota discovery returned no resources for '$ResourceProvider'."
        }
    }

    Write-Output "Overall`t$script:Overall"
    if ($script:Overall -eq "INSUFFICIENT") {
        exit 1
    }
    exit 0
}
finally {
    Remove-Item -LiteralPath $script:OutFile, $script:ErrFile, $namesFile -Force -ErrorAction SilentlyContinue
}
