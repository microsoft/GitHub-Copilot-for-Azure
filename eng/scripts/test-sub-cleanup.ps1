#!/usr/bin/env pwsh

# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

# This script implements the resource management guidelines documented at https://github.com/Azure/azure-sdk-tools/blob/main/doc/engsys_resource_management.md
# Script based on this cleanup script from azure-sdk-tools: https://github.com/Azure/azure-sdk-tools/blob/main/eng/scripts/live-test-resource-cleanup.ps1

#Requires -Version 7.0
#Requires -PSEdition Core
#Requires -Modules @{ModuleName='Az.Accounts'; ModuleVersion='1.6.4'}
#Requires -Modules @{ModuleName='Az.Resources'; ModuleVersion='1.8.0'}

[CmdletBinding(DefaultParameterSetName = 'Interactive', SupportsShouldProcess = $true, ConfirmImpact = 'Medium')]
param (
    [Parameter(ParameterSetName = 'Provisioner', Mandatory = $true)]
    [ValidatePattern('^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$')]
    [string] $ProvisionerApplicationId,

    [Parameter(ParameterSetName = 'Provisioner', Mandatory = $false)]
    [string] $ProvisionerApplicationSecret,

    [Parameter(ParameterSetName = 'Provisioner', Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string] $OpensourceApiApplicationToken,

    [Parameter(ParameterSetName = 'Provisioner', Mandatory = $true)]
    [Parameter(ParameterSetName = 'Interactive')]
    [ValidatePattern('^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$')]
    [string] $TenantId,

    [Parameter(ParameterSetName = 'Provisioner', Mandatory = $true)]
    [Parameter(ParameterSetName = 'Interactive')]
    [ValidatePattern('^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$')]
    [string] $SubscriptionId,

    [Parameter(ParameterSetName = 'Provisioner')]
    [string] $GithubAliasCachePath,

    [Parameter()]
    [ValidateNotNullOrEmpty()]
    [string] $Environment = "AzureCloud",

    [Parameter()]
    [switch] $DeleteNonCompliantGroups,

    [Parameter()]
    [switch] $DeleteArmDeployments,

    [Parameter()]
    [string] $AllowListPath = "$PSScriptRoot/cleanup-allowlist.txt",

    [string] $GroupFilter = '*',

    [Parameter()]
    [switch] $Force,

    [Parameter()]
    [switch] $DryRun,

    [Parameter(ParameterSetName = 'Interactive')]
    [switch] $Login,

    [switch] $UseExistingAzContext,

    [Parameter(ValueFromRemainingArguments = $true)]
    $IgnoreUnusedArguments
)

Set-StrictMode -Version 3

# Import resource management helpers and override its Log function.
. (Join-Path $PSScriptRoot Resource-Helpers.ps1)
# Import helpers for querying repos.opensource.microsoft.com API
. (Join-Path $PSScriptRoot Metadata-Helpers.ps1)

$OwnerAliasCache = @{}
$IsProvisionerApp = $PSCmdlet.ParameterSetName -eq "Provisioner"
$Exceptions = [System.Collections.Generic.HashSet[String]]@()

# Runs a scriptblock up to $Attempts times, sleeping between failures.
# Wraps every ARM/REST call in cleanup so transient throttling or service
# hiccups don't abort the entire subscription sweep.
function Retry([scriptblock] $Action, [int] $Attempts = 5) {
    $attempt = 0
    $sleep = 5

    while ($attempt -lt $Attempts) {
        try {
            $attempt++
            return $Action.Invoke()
        }
        catch {
            if ($attempt -lt $Attempts) {
                Write-Warning "Attempt $attempt failed: $_. Trying again in $sleep seconds..."
                Start-Sleep -Seconds $sleep
            }
            else {
                Write-Error -ErrorRecord $_
            }
        }
    }
}

# Reads the allow-list file into the $Exceptions set so that resource groups
# matching any pattern in that file are never touched. Allows permanent or
# long-lived groups (e.g. shared infra) to coexist with the automated cleanup.
function LoadAllowList() {
    if (!(Test-Path $AllowListPath)) {
        return
    }
    $lines = Get-Content $AllowListPath
    foreach ($line in $lines) {
        if ($line -and !$line.StartsWith("#")) {
            $_ = $Exceptions.Add($line.Trim())
        }
    }
}

# Simple wrapper so callers have a stable Log surface. Overrides the Log
# function from Resource-Helpers.ps1 with a version that omits the timestamp
# (the transcript already records time).
function Log($Message) {
    Write-Host $Message
}

# Returns $true if $Alias maps to a real Microsoft employee. Results are
# cached in $OwnerAliasCache to avoid hammering MS Graph/AAD on every call.
# Used to decide whether a resource group owner tag refers to someone still
# at the company and therefore whether the group is compliant.
function IsValidAlias([string]$Alias) {
    if (!$Alias) {
        return $false
    }

    if ($OwnerAliasCache.ContainsKey($Alias)) {
        return $OwnerAliasCache[$Alias]
    }

    # AAD apps require a higher level of permission requiring admin consent to query the MS Graph list API
    # https://docs.microsoft.com/en-us/graph/api/user-list?view=graph-rest-1.0&tabs=http#permissions
    # The Get-AzAdUser call uses the list API under the hood (`/users/$filter=<alias>`)
    # and for some reason the Get API (`/user/<id or user principal name>`) also returns 401
    # with User.Read and User.ReadBasic.All permissions when called with an AAD app.
    # For this reason, skip trying to query MS Graph directly in provisioner mode.
    # The owner alias cache should already be pre-populated with all user records from the
    # github -> ms alias mapping retrieved via the repos.opensource.microsoft.com API, however
    # this will not include any security groups, in the case an owner tag does not contain
    # individual user aliases.
    if ($IsProvisionerApp) {
        Write-Host "Skipping MS Graph alias lookup for '$Alias' due to permissions. Owner aliases not registered with github will be treated as invalid."
        $OwnerAliasCache[$Alias] = $false
        return $false
    }

    $domains = @("microsoft.com", "ntdev.microsoft.com")

    foreach ($domain in $domains) {
        if (Get-AzAdUser -UserPrincipalName "$Alias@$domain") {
            $OwnerAliasCache[$Alias] = $true
            return $true;
        }
    }

    $OwnerAliasCache[$Alias] = $false

    return $false;
}

# Pre-populates $OwnerAliasCache with every known GitHub-to-Microsoft alias
# mapping from the 1ES open-source portal (or a local file cache). Called
# once in provisioner mode so that IsValidAlias can work without making
# per-alias MS Graph calls (which require admin consent for service principals).
function AddGithubUsersToAliasCache() {
    if ($GithubAliasCachePath -and (Test-Path $GithubAliasCachePath)) {
        Write-Host "Loading github -> microsoft alias mappings from filesystem cache '$GithubAliasCachePath'."
        $users = Get-Content $GithubAliasCachePath | ConvertFrom-Json -AsHashtable
    }
    else {
        Write-Host "Retrieving github -> microsoft alias mappings from opensource API."
        $users = GetAllGithubUsers -Token $OpensourceApiApplicationToken
    }
    if (!$users) {
        Write-Error "Failed to retrieve github -> microsoft alias mappings from opensource api."
        exit 1
    }
    Write-Host "Found $($users.Count) users"
    foreach ($user in $users) {
        if ($user -and $user.aad.alias) {
            $OwnerAliasCache[$user.aad.alias] = $true
        }
        if ($user -and $user.aad.userPrincipalName) {
            $OwnerAliasCache[$user.aad.userPrincipalName] = $true
        }
        if ($user -and $user.github.login) {
            $OwnerAliasCache[$user.github.login] = $true
        }
    }
    Write-Host "Found $($OwnerAliasCache.Count) valid github or microsoft aliases."
    if ($GithubAliasCachePath -and !(Test-Path $GithubAliasCachePath)) {
        $cacheDir = Split-Path $GithubAliasCachePath
        if ($cacheDir -and $cacheDir -ne '.') {
            New-Item -Type Directory -Force $cacheDir -WhatIf:$false
        }
        Write-Host "Caching github -> microsoft alias mappings to '$GithubAliasCachePath'"
        $users | ConvertTo-Json -Depth 4 | Out-File $GithubAliasCachePath -WhatIf:$false
    }
}

# Case-insensitive tag lookup for a resource group. Azure tag keys are
# case-insensitive but PowerShell hashtable keys are not, so this helper
# prevents missed matches due to casing differences.
function GetTag([object]$ResourceGroup, [string]$Key) {
    if (!$ResourceGroup.Tags) {
        return $null
    }

    foreach ($tagKey in $ResourceGroup.Tags.Keys) {
        # Compare case-insensitive
        if ($tagKey -ieq $Key) {
            return $ResourceGroup.Tags[$tagKey]
        }
    }

    return $null
}

# Returns $true when at least one alias in the 'Owners' tag resolves to a
# current Microsoft employee. Groups with a recognised owner should not be
# auto-deleted even when they lack a DeleteAfter tag.
function HasValidOwnerTag([object]$ResourceGroup) {
    $ownerTag = GetTag $ResourceGroup "Owners"
    if (!$ownerTag) {
        return $false
    }
    $owners = $ownerTag -split "[;, ]"
    $hasValidOwner = $false
    $invalidOwners = @()
    foreach ($owner in $owners) {
        if (IsValidAlias -Alias $owner) {
            $hasValidOwner = $true
        }
        else {
            $invalidOwners += $owner
        }
    }
    if ($invalidOwners) {
        Write-Warning " Resource group '$($ResourceGroup.ResourceGroupName)' has invalid owner tags: $($invalidOwners -join ',')"
    }
    if ($hasValidOwner) {
        Write-Host " Found tagged resource group '$($ResourceGroup.ResourceGroupName)' with owners '$($owners -join ',')'"
        return $true
    }
    return $false
}

# Returns $true when the resource-group name follows the '<alias>-...' naming
# convention and that alias belongs to a current employee. A compliant name is
# treated as implicit ownership, protecting the group from automated deletion.
function HasValidAliasInName([object]$ResourceGroup) {
    # check compliance (formatting first, then validate alias) and skip if compliant
    if ($ResourceGroup.ResourceGroupName `
            -match '^(SSS3PT_)?(rg-)?(?<alias>(t-|a-|v-)?[a-z,A-Z]+)([-_].*)?$' `
            -and (IsValidAlias -Alias $matches['alias'])) {
        Write-Host " Found resource group '$($ResourceGroup.ResourceGroupName)' starting with valid alias '$($matches['alias'])'"
        return $true
    }
    return $false
}

# Convenience wrapper that reads the 'DeleteAfter' tag from a resource group.
# Centralised here so the tag key string is never duplicated across the script.
function GetDeleteAfterTag([object]$ResourceGroup) {
    return GetTag $ResourceGroup "DeleteAfter"
}

# Returns $true when the DeleteAfter value parses as a date that is already
# in the past. Used to gate actual deletion: only expired tags trigger removal.
function HasExpiredDeleteAfterTag([string]$DeleteAfter) {
    if ($DeleteAfter) {
        $deleteDate = $deleteAfter -as [DateTime]
        return $deleteDate -and [datetime]::UtcNow -gt $deleteDate
    }
    return $false
}

# Returns $true if the resource group name matches any pattern in the
# allow-list loaded by LoadAllowList. Matching groups are always skipped,
# regardless of any other compliance checks.
function HasException([object]$ResourceGroup) {
    foreach ($ex in $Exceptions) {
        if ($ResourceGroup.ResourceGroupName -like $ex) {
            Write-Host " Skipping allowed resource group '$($ResourceGroup.ResourceGroupName)' because it matches pattern '$ex' in the allow list '$AllowListPath'"
            return $true
        }
    }
    return $false
}

# Ensures a non-compliant resource group has a DeleteAfter tag so it will be
# cleaned up on a future run. Without this, groups that fail compliance checks
# today but are never re-examined would accumulate indefinitely.
function FindOrCreateDeleteAfterTag {
    [CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Medium')]
    param(
        [object]$ResourceGroup
    )

    if (!$DeleteNonCompliantGroups -or !$ResourceGroup) {
        return
    }

    # Possible states are Canceled, Deleting, Failed, InProgress, Succeeded
    # https://learn.microsoft.com/dotnet/api/microsoft.azure.management.websites.models.provisioningstate
    if ($ResourceGroup.ProvisioningState -in @('Deleting', 'InProgress')) {
        Write-Host "Skipping tag query/update for group '$($ResourceGroup.ResourceGroupName)' as it is in '$($ResourceGroup.ProvisioningState)' state"
        return
    }

    $deleteAfter = GetTag $ResourceGroup "DeleteAfter"
    if (!$deleteAfter -or !($deleteAfter -as [datetime])) {
        $hasAppServiceResources = (Get-AzResource -ResourceGroupName $ResourceGroup.ResourceGroupName `
                -ResourceType 'Microsoft.Web/sites' -ErrorAction SilentlyContinue) -or `
        (Get-AzResource -ResourceGroupName $ResourceGroup.ResourceGroupName `
                -ResourceType 'Microsoft.Web/serverfarms' -ErrorAction SilentlyContinue)
        if ($hasAppServiceResources) {
            Write-Host " Resource group '$($ResourceGroup.ResourceGroupName)' contains App Service or App Service Plan resources, setting DeleteAfter to 1 day."
            $deleteAfter = [datetime]::UtcNow.AddDays(1)
        }
        else {
            $deleteAfter = [datetime]::UtcNow.AddDays(5)
        }
        if ($Force -or $PSCmdlet.ShouldProcess("$($ResourceGroup.ResourceGroupName) [DeleteAfter (UTC): $deleteAfter]", "Adding DeleteAfter Tag to Group")) {
            Write-Host "Adding DeleteAfter tag with value '$deleteAfter' to group '$($ResourceGroup.ResourceGroupName)'"
            $result = ($ResourceGroup | Update-AzTag -Operation Merge -Tag @{ DeleteAfter = $deleteAfter }) 2>&1
            if ("Exception" -in $result.PSObject.Properties.Name) {
                # Handle race conditions where the group starts deleting after we get its info, in order to avoid pipeline warning/failure emails
                # "The resource group '<group name>' is in deprovisioning state and cannot perform this operation"
                if ($result.Exception.Message -notlike '*is in deprovisioning state*') {
                    Write-Error $result.Exception.Message
                }
                else {
                    Write-Host "Skipping '$($ResourceGroup.ResourceGroupName)' as it is in a deprovisioning state"
                }
            }
            else {
                $result
            }
        }
    }
}

# Returns $true when the group carries a 'DoNotDelete' tag, which signals
# that a human has explicitly opted it out of automated cleanup.
function HasDoNotDeleteTag([object]$ResourceGroup) {
    $doNotDelete = GetTag $ResourceGroup "DoNotDelete"
    if ($doNotDelete -ne $null) {
        Write-Host " Skipping resource group '$($ResourceGroup.ResourceGroupName)' because it has a 'DoNotDelete' tag"
    }
    return $doNotDelete -ne $null
}

# Returns $true when the group carries a 'skipDelete' tag. Similar to
# DoNotDelete but used by provisioning tooling to temporarily park a group
# while an in-progress deployment is still running.
function HasSkipDeleteTag([object]$ResourceGroup) {
    $skipDelete = GetTag $ResourceGroup "skipDelete"
    if ($skipDelete -ne $null) {
        Write-Host " Skipping resource group '$($ResourceGroup.ResourceGroupName)' because it has a 'skipDelete' tag"
        return $true
    }
    return $false
}

# Returns $true when the resource group is managed by another Azure resource
# (e.g. an AKS cluster creates its own node resource group). Deleting managed
# groups directly can corrupt the parent resource, so they must be skipped.
function IsChildResource([object]$ResourceGroup) {
    if ($ResourceGroup.ManagedBy) {
        Write-Host " Skipping resource group '$($ResourceGroup.ResourceGroupName)' because it is managed by '$($ResourceGroup.ManagedBy)'"
        return $true
    }
    return $false
}

# Returns $true when the resource group has an ARM delete lock. Attempting
# to delete a locked group would fail loudly, so it is skipped instead.
function HasDeleteLock([object]$ResourceGroup) {
    $lock = Get-AzResourceLock -ResourceGroupName $ResourceGroup.ResourceGroupName
    if ($lock) {
        Write-Host " Skipping locked resource group '$($ResourceGroup.ResourceGroupName)'"
        return $true
    }
    return $false
}

# Removes ARM deployment records that contain output secrets or test
# application secrets. Deployment history objects persist even after the
# underlying resources are gone and can leak credentials, so they are
# scrubbed as part of cleanup.
function DeleteArmDeployments([object]$ResourceGroup) {
    if (!$DeleteArmDeployments -or !$ResourceGroup) {
        return
    }
    $toDelete = @()
    try {
        $toDelete = @(Get-AzResourceGroupDeployment -ResourceGroupName $ResourceGroup.ResourceGroupName `
            | Where-Object { $_ -and ($_.Outputs?.Count -or $_.Parameters?.ContainsKey('testApplicationSecret')) })
    }
    catch {}
    if (!$toDelete -or !$toDelete.Count) {
        return
    }
    Write-Host "Deleting $($toDelete.Count) ARM deployments for group $($ResourceGroup.ResourceGroupName) as they may contain output secrets. Deployed resources will not be affected."
    $null = $toDelete | Remove-AzResourceGroupDeployment
}

# Removes all subscription-scoped ARM deployments asynchronously.
# Like resource-group deployments, subscription-scoped deployments can
# store secrets in their output/parameter history and must be purged.
function DeleteSubscriptionDeployments() {
    $subDeployments = @(Get-AzSubscriptionDeployment)
    if (!$subDeployments) {
        return
    }
    Write-Host "Removing $($subDeployments.Count) subscription scoped deployments async"
    $jobs = $subDeployments | Remove-AzSubscriptionDeployment -AsJob
    if (!$jobs) {
        return
    }
    for ($i = 0; $i -lt 20; $i++) {
        $notStarted = Get-Job -Id $jobs.Id | Where-Object { $_.State -eq 'NotStarted' }
        if (!$notStarted) {
            break
        }
        Write-Host "Waiting for async jobs to start..."
        Start-Sleep 5
    }
}

# Main cleanup orchestrator. Iterates every resource group in the
# subscription, applies all compliance checks, and either tags non-compliant
# groups with a future DeleteAfter date or queues expired groups for deletion.
# Separating tagging from deletion gives owners a grace period to react.
function DeleteOrUpdateResourceGroups() {
    [CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Medium')]
    param()

    if ($IsProvisionerApp) {
        AddGithubUsersToAliasCache
    }

    Write-Verbose "Fetching groups"
    [Array]$allGroups = Retry { Get-AzResourceGroup } | Where-Object { $_.ResourceGroupName -like $GroupFilter }
    if (!$allGroups) {
        Write-Warning "No resource groups found"
        return
    }
    $toDelete = @()
    $toDeleteSoon = @()
    Write-Host "Total Resource Groups: $($allGroups.Count)"

    foreach ($rg in $allGroups) {
        if ($rg -ieq "rg-dashboard") {
            Write-Host "Skipping resource group '$($rg.ResourceGroupName)' because it is the resource group that supports dashboard application"
            continue
        }
        if (HasException $rg) {
            continue
        }
        if (HasSkipDeleteTag $rg) {
            continue
        }
        $deleteAfter = GetDeleteAfterTag $rg
        if ($deleteAfter) {
            if (HasExpiredDeleteAfterTag $deleteAfter) {
                $toDelete += $rg
            }
            continue
        }
        if ((IsChildResource $rg) -or (HasDeleteLock $rg)) {
            continue
        }
        if (HasDoNotDeleteTag $rg) {
            continue
        }
        if ((HasValidAliasInName $rg) -or (HasValidOwnerTag $rg)) {
            continue
        }

        $toDeleteSoon += $rg
    }

    if ($DryRun) {
        Write-Host "`n[DRY RUN] The following changes would be made (no actual changes performed):"
        Write-Host "`nResource groups that would be DELETED ($($toDelete.Count)):"
        foreach ($rg in $toDelete) {
            $deleteAfter = GetDeleteAfterTag $rg
            Write-Host "  $($rg.ResourceGroupName) [DeleteAfter (UTC): $deleteAfter]"
        }
        if ($DeleteNonCompliantGroups) {
            Write-Host "`nResource groups that would be TAGGED with DeleteAfter according to FindOrCreateDeleteAfterTag ($($toDeleteSoon.Count)):"
            foreach ($rg in $toDeleteSoon) {
                Write-Host "  $($rg.ResourceGroupName)"
            }
        }
        else {
            Write-Host "`nResource groups that would be TAGGED with DeleteAfter (0):"
            Write-Host "  Tagging is skipped because -DeleteNonCompliantGroups was not specified."
        }
        return
    }

    foreach ($rg in $toDeleteSoon) {
        FindOrCreateDeleteAfterTag -ResourceGroup $rg
    }


    $errors = @(DeleteAndPurgeGroups $toDelete)

    if ($errors.Count -ne 0) {
        Write-Host "Encountered errors removing some resource groups:"
        $errors | % { Write-Host "  $_" }
        exit 1
    }
}

# Deletes each resource group in $toDelete and then purges any soft-deleted
# resources (Key Vaults, Managed HSMs, Cognitive Services) that were inside
# them. Without an explicit purge, soft-deleted resources linger against
# subscription quota and can block re-creation with the same name.
function DeleteAndPurgeGroups([array]$toDelete) {
    $errors = @()
    # Get purgeable resources already in a deleted state.
    $purgeableResources = @(Get-PurgeableResources)

    if ($toDelete) {
        Write-Host "Total Resource Groups To Delete: $($toDelete.Count)"
    }
    foreach ($rg in $toDelete) {
        try {
            $deleteAfter = GetTag $rg "DeleteAfter"
            if ($Force -or $PSCmdlet.ShouldProcess("$($rg.ResourceGroupName) [DeleteAfter (UTC): $deleteAfter]", "Delete Group")) {
                # Add purgeable resources that will be deleted with the resource group to the collection.
                $purgeableResourcesFromRG = @(Get-PurgeableGroupResources $rg.ResourceGroupName)

                if ($purgeableResourcesFromRG) {
                    $purgeableResources += $purgeableResourcesFromRG
                    Write-Verbose "Found $($purgeableResourcesFromRG.Count) potentially purgeable resources in resource group $($rg.ResourceGroupName)"
                }

                Write-Verbose "Deleting group: $($rg.ResourceGroupName)"
                Write-Verbose "  tags $($rg.Tags | ConvertTo-Json -Compress)"

                # For storage tests specifically, if they are aborted then blobs with immutability policies
                # can be left around which prevent deletion.
                if ($rg.Tags?.ContainsKey('ServiceDirectory') -and $rg.Tags.ServiceDirectory -like '*storage*') {
                    SetStorageNetworkAccessRules -ResourceGroupName $rg.ResourceGroupName -SetFirewall -CI:($null -ne $env:SYSTEM_TEAMPROJECTID)
                    Remove-WormStorageAccounts -GroupPrefix $rg.ResourceGroupName -CI:($null -ne $env:SYSTEM_TEAMPROJECTID)
                }

                Write-Host ($rg | Remove-AzResourceGroup -Force -AsJob).Name
            }
        }
        catch {
            $errorMsg = "ERROR: Failure deleting/purging group $($rg.ResourceGroupName): `n $($_.ToString())"
            Write-Warning $errorMsg
            $errors += $errorMsg
        }
    }

    if (!$purgeableResources.Count) {
        return $errors
    }
    <#
  if ($Force -or $PSCmdlet.ShouldProcess("Purgable Resources", "Delete Purgeable Resources")) {
    # Purge all the purgeable resources and get a list of resources (as a collection) we need to follow-up on.
    Write-Host "Attempting to purge $($purgeableResources.Count) resources."
    $failedResources = @(Remove-PurgeableResources $purgeableResources -PassThru)
    if ($failedResources) {
      Write-Warning "Timed out deleting the following $($failedResources.Count) resources. Please file an IcM ticket per resource type."
      $failedResources | Sort-Object AzsdkResourceType, AzsdkName | Format-Table -Property @{l='Type'; e={$_.AzsdkResourceType}}, @{l='Name'; e={$_.AzsdkName}}
    }
  }
    #>

    return $errors
}

# Establishes an Azure session using whichever credential is available:
# service-principal secret (CI), interactive browser login, or an existing
# Az context. Centralised here so the rest of the script can assume it is
# already authenticated before doing anything.
function Login() {
    if ($UseExistingAzContext -and (Get-AzContext)) {
        Write-Verbose "Using existing account"
    }
    elseif ($PSCmdlet.ParameterSetName -eq "Provisioner" -and $ProvisionerApplicationSecret) {
        Write-Verbose "Logging in with provisioner"
        $provisionerSecret = ConvertTo-SecureString -String $ProvisionerApplicationSecret -AsPlainText -Force
        $provisionerCredential = [System.Management.Automation.PSCredential]::new($ProvisionerApplicationId, $provisionerSecret)
        Retry {
            Connect-AzAccount -Force -Tenant $TenantId -Credential $provisionerCredential -ServicePrincipal -Environment $Environment -WhatIf:$false
        }
        Select-AzSubscription -Subscription $SubscriptionId -Confirm:$false -WhatIf:$false
    }
    elseif ($Login) {
        Write-Verbose "Logging in with interactive user"
        $connectParams = @{}
        if ($TenantId) {
            $connectParams.TenantId = $TenantId
        }
        if ($SubscriptionId) {
            $connectParams.SubscriptionId = $SubscriptionId
        }
        Connect-AzAccount @connectParams
    }
    elseif (Get-AzContext) {
        Write-Verbose "Using existing account"
    }
    else {
        $errMsg = 'User context not found. Please re-run script with "-Login" to login, ' +
        'or run "Connect-AzAccount -UseDeviceAuthentication" if interactive login is not available.'
        Write-Error $errMsg
        exit 1
    }
}

LoadAllowList

$logFile = Join-Path $PSScriptRoot "cleanup-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
Start-Transcript -Path $logFile -Append
Write-Host "Logging to: $logFile"

Login

$originalSubscription = (Get-AzContext).Subscription.Id
if ($SubscriptionId -and ($originalSubscription -ne $SubscriptionId)) {
    Select-AzSubscription -Subscription $SubscriptionId -Confirm:$false -WhatIf:$false
}

try {
    DeleteOrUpdateResourceGroups
    if (-not $DryRun) {
        DeleteSubscriptionDeployments
    }
}
finally {
    if ($SubscriptionId -and ($originalSubscription -ne $SubscriptionId)) {
        Select-AzSubscription -Subscription $originalSubscription -Confirm:$false -WhatIf:$false
    }
    Stop-Transcript
}
