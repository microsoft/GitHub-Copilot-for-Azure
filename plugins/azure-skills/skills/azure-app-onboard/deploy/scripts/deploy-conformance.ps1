#!/usr/bin/env pwsh
# Deploy -> Handoff conformance gate.
# Deterministically checks the Step 8 finalization artifacts (deploy-result.json,
# deployment-summary.md, deploy-audit.log, context.json) instead of relying on the
# model to remember and re-verify a prose checklist late in a long, compaction-heavy session.
#
# Usage:  deploy-conformance.ps1 -SessionPath <.copilot-azure/sessions/{id}>
# Output: JSON { passed, failures:[{id,detail,file}] } to stdout.
# Exit:   0 = pass, 1 = one or more BLOCK failures.
[CmdletBinding()]
param(
  [Parameter(Mandatory)] [string]$SessionPath,
  [string]$InfraPath = 'infra'
)

$failures = New-Object System.Collections.Generic.List[object]
function Add-Fail($id, $detail, $file) {
  $failures.Add([ordered]@{ id = $id; detail = $detail; file = $file })
}
function Read-Json($p) {
  if (Test-Path $p) { try { return (Get-Content $p -Raw | ConvertFrom-Json) } catch { return $null } }
  return $null
}

$deployResultPath  = Join-Path $SessionPath 'deploy-result.json'
$summaryPath       = Join-Path $SessionPath 'deployment-summary.md'
$auditPath         = Join-Path $SessionPath 'deploy-audit.log'
$contextPath       = Join-Path $SessionPath 'context.json'
$planPath          = Join-Path $SessionPath 'prepare-plan.json'

$deployResult = Read-Json $deployResultPath
$context      = Read-Json $contextPath
$plan         = Read-Json $planPath

# 1. DEPLOY-RESULT-EXISTS — the file must exist before handoff, always.
if (-not $deployResult) {
  Add-Fail 'DEPLOY-RESULT-EXISTS' 'deploy-result.json missing or unparsable — must exist before handoff' 'deploy-result.json'
} else {
  # 2. DEPLOY-RESULT-NOT-SKELETON — status must be flipped off the Step 5b skeleton value.
  if ($deployResult.status -eq 'in-progress') {
    Add-Fail 'DEPLOY-RESULT-NOT-SKELETON' "status is still 'in-progress' — finalize to 'succeeded'/'failed' before handoff" 'deploy-result.json'
  }
  # 3. DEPLOY-RESULT-SCHEMA — ALL required (non-optional) DeployResult fields per deploy-schemas.ts.
  #    Evidence: B119 (07-20 Run 23d) hand-wrote a custom shape missing exactly this field set.
  $requiredFields = @('sessionId', 'subscriptionId', 'resourceGroupName', 'status', 'healthStatus', 'warnings', 'partial', 'orphanedResourceGroups')
  $requiredArrays = @('deploymentNames', 'resourceIds', 'endpoints', 'resourceResults')
  foreach ($f in ($requiredFields + $requiredArrays)) {
    $val = $deployResult.$f
    if ($null -eq $val) {
      Add-Fail 'DEPLOY-RESULT-SCHEMA' "field '$f' missing — required by deploy-schemas.ts (empty array/false is valid, missing is not)" 'deploy-result.json'
    }
  }
  if ($deployResult.status -eq 'succeeded' -and (-not $deployResult.resourceIds -or $deployResult.resourceIds.Count -eq 0)) {
    Add-Fail 'DEPLOY-RESULT-SCHEMA' "status is 'succeeded' but resourceIds[] is empty" 'deploy-result.json'
  }
  if ($deployResult.status -eq 'succeeded' -and (-not $deployResult.duration -or -not $deployResult.duration.completedUtc)) {
    Add-Fail 'DEPLOY-RESULT-SCHEMA' "status is 'succeeded' but duration.completedUtc is empty" 'deploy-result.json'
  }
  # 4. ENDPOINT-COMPLETENESS — every plan service that hosts application code needs a matching endpoint.
  #    Exclude infra/non-routable entries: '... Plan' (compute SKU), '... Environment' (CAE, not an app),
  #    '... Job'/'worker' (background/queue consumer — no inbound HTTP endpoint by design).
  $hostingTypes = 'app service|functions|container app|static web app'
  $nonHostingName = '(?i)\b(plan|environment|job|worker)\b'
  if ($plan -and $plan.services -and $deployResult.status -eq 'succeeded') {
    $hostingServices = @($plan.services | Where-Object { ($_.name -match $hostingTypes -or $_.type -match $hostingTypes) -and $_.name -notmatch $nonHostingName })
    if ($hostingServices.Count -gt 0 -and (-not $deployResult.endpoints -or $deployResult.endpoints.Count -lt $hostingServices.Count)) {
      Add-Fail 'ENDPOINT-COMPLETENESS' "plan has $($hostingServices.Count) hosting service(s) but deploy-result.json.endpoints[] has $($deployResult.endpoints.Count) entries" 'deploy-result.json'
    }
  }
}

# 5. AUDIT-LOG-EXISTS — must exist with ≥2 entries (started + result for at least 1 command).
$auditLines = @()
if (-not (Test-Path $auditPath)) {
  Add-Fail 'AUDIT-LOG-EXISTS' 'deploy-audit.log missing — required before handoff' 'deploy-audit.log'
} else {
  $auditLines = @(Get-Content $auditPath)
  if ($auditLines.Count -lt 2) {
    Add-Fail 'AUDIT-LOG-EXISTS' "deploy-audit.log exists but has fewer than 2 entries ($($auditLines.Count)) — started+result pairs expected" 'deploy-audit.log'
  }
}

# 6. AUDIT-VS-HEALING — if the audit log shows more than one attempt of the same command
#    (a retry actually happened), healingAttempts[] must record it. Catches the "succeeded but
#    healingAttempts: []" class of bug even when the model's own narrative says otherwise.
if ($auditLines.Count -gt 0 -and $deployResult) {
  $startedCounts = @{}
  foreach ($line in $auditLines) {
    $m = [regex]::Match($line, '\|\s*(az [a-z ]+?(?:sub create|group create|webapp deploy|acr build))\s*\|\s*started')
    if ($m.Success) {
      $cmd = $m.Groups[1].Value.Trim()
      $startedCounts[$cmd] = ($startedCounts[$cmd] + 1)
    }
  }
  $retried = $startedCounts.Keys | Where-Object { $startedCounts[$_] -gt 1 }
  if ($retried.Count -gt 0 -and (-not $deployResult.healingAttempts -or $deployResult.healingAttempts.Count -eq 0)) {
    Add-Fail 'AUDIT-VS-HEALING' "deploy-audit.log shows retries ($($retried -join ', ')) but healingAttempts[] is empty" 'deploy-result.json'
  }
}

# 7. DEPLOYMENT-SUMMARY-EXISTS + DEPLOYMENT-SUMMARY-SECTIONS
if (-not (Test-Path $summaryPath)) {
  Add-Fail 'DEPLOYMENT-SUMMARY-EXISTS' 'deployment-summary.md missing — required before handoff' 'deployment-summary.md'
} else {
  $summary = Get-Content $summaryPath -Raw
  foreach ($section in @('status', 'health', 'cleanup', 'portal')) {
    if ($summary -notmatch "(?i)$section") {
      Add-Fail 'DEPLOYMENT-SUMMARY-SECTIONS' "deployment-summary.md missing a '$section' section" 'deployment-summary.md'
    }
  }
}

# 8. CONTEXT-PHASE-COMPLETE — session lifecycle must reflect deploy completion.
if (-not $context) {
  Add-Fail 'CONTEXT-PHASE-COMPLETE' 'context.json missing or unparsable' 'context.json'
} else {
  $completed = @($context.completedPhases)
  if ($completed -notcontains 'deploy') {
    Add-Fail 'CONTEXT-PHASE-COMPLETE' "'deploy' missing from context.json.completedPhases" 'context.json'
  }
  if ($null -ne $context.currentPhase -and $context.currentPhase -ne '') {
    Add-Fail 'CONTEXT-PHASE-COMPLETE' "context.json.currentPhase is '$($context.currentPhase)' — must be null after handoff" 'context.json'
  }
}

# 9. CHECKLIST-SCOPE-MATCH — the prescribed az deployment command must match the Bicep entry point's targetScope.
#    Evidence: 08-13 Run 3 — deploy-checklist.md prescribed `az deployment group` while main.bicep declares
#    `targetScope = 'subscription'`. Undetected, this fails the deployment before it ever runs.
$mainBicepPath = Join-Path $InfraPath 'main.bicep'
$checklistPath = Join-Path $SessionPath 'deploy-checklist.md'
if ((Test-Path $mainBicepPath) -and (Test-Path $checklistPath)) {
  $mainBicep = Get-Content $mainBicepPath -Raw
  $checklist = Get-Content $checklistPath -Raw
  $scopeMatch = [regex]::Match($mainBicep, "targetScope\s*=\s*'(\w+)'")
  $targetScope = if ($scopeMatch.Success) { $scopeMatch.Groups[1].Value } else { 'resourceGroup' }  # Bicep default when omitted
  $hasGroupCmd = $checklist -match 'az deployment group (what-if|create)'
  $hasSubCmd   = $checklist -match 'az deployment sub (what-if|create)'
  if ($targetScope -eq 'subscription' -and $hasGroupCmd -and -not $hasSubCmd) {
    Add-Fail 'CHECKLIST-SCOPE-MATCH' "main.bicep declares targetScope='subscription' but deploy-checklist.md prescribes 'az deployment group' — must be 'az deployment sub'" 'deploy-checklist.md'
  } elseif ($targetScope -ne 'subscription' -and $hasSubCmd -and -not $hasGroupCmd) {
    Add-Fail 'CHECKLIST-SCOPE-MATCH' "main.bicep has no subscription targetScope (resourceGroup-scoped) but deploy-checklist.md prescribes 'az deployment sub' — must be 'az deployment group'" 'deploy-checklist.md'
  }
}

# 10. DEPLOYED-BY-NOT-SKILLNAME — the deployedBy parameter must never be the literal skill name.
#     Evidence: B47 (08-12 Run 3) — main.parameters.json defaulted deployedBy to 'azure-app-onboard'
#     (the skill name) instead of the signed-in user's identity.
$paramsFilePath = Join-Path $InfraPath 'main.parameters.json'
if (Test-Path $paramsFilePath) {
  $paramsJson = Read-Json $paramsFilePath
  $deployedByVal = $paramsJson.parameters.deployedBy.value
  if ($null -ne $deployedByVal) {
    if ([string]::IsNullOrWhiteSpace($deployedByVal) -or $deployedByVal -eq 'azure-app-onboard') {
      Add-Fail 'DEPLOYED-BY-NOT-SKILLNAME' "main.parameters.json deployedBy='$deployedByVal' — must be the signed-in user's identity ('az ad signed-in-user show --query displayName'), never the skill name or empty" 'infra/main.parameters.json'
    }
  }
}

$result = [ordered]@{ passed = ($failures.Count -eq 0); failures = $failures }
$result | ConvertTo-Json -Depth 5 -Compress
if ($failures.Count -gt 0) { exit 1 } else { exit 0 }
