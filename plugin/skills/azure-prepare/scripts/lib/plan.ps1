# =============================================================================
# plan.ps1 -- Deployment-plan generation and recipe scaffolding.
# Dot-sourced by prepare.ps1; shares script scope ($RepoPath, $StateFile, $Steps).
# Not a standalone script.
# =============================================================================

# ---------------------------------------------------------------------------
# Plan file generation (.azure/deployment-plan.md) from collected state
# ---------------------------------------------------------------------------
function Write-DeploymentPlan {
    # Generates (or regenerates) .azure/deployment-plan.md from the collected state and returns its path.
    param([hashtable]$State)
    $planDir  = Join-Path $RepoPath '.azure'
    $planFile = Join-Path $planDir 'deployment-plan.md'
    New-Item -ItemType Directory -Force -Path $planDir | Out-Null

    $i  = $State['input']
    $a  = $State['auto']
    $ts = (Get-Date).ToUniversalTime().ToString('o')

    $goal        = (Get-ByPath $State 'input.goal');        if (-not $goal) { $goal = '_TBD_' }
    $mode        = (Get-ByPath $State 'input.mode');        if (-not $mode) { $mode = '_TBD_' }
    $recipe      = (Get-ByPath $State 'input.recipe');      if (-not $recipe) { $recipe = '_TBD_' }
    $recipeWhy   = (Get-ByPath $State 'input.recipeRationale'); if (-not $recipeWhy) { $recipeWhy = '_TBD_' }
    $stack       = (Get-ByPath $State 'input.stack');       if (-not $stack) { $stack = '_TBD_' }
    $sub         = $a['azContext']['subscriptionName']; if (-not $sub) { $sub = (Get-ByPath $State 'input.subscription') }
    if (-not $sub) { $sub = '_TBD_ — confirm with user' }
    $loc         = (Get-ByPath $State 'input.location');   if (-not $loc) { $loc = '_TBD_ — confirm with user' }

    $req = (Get-ByPath $State 'input.requirements')
    $classification = if ($req) { $req['classification'] } else { '_TBD_' }
    $scale          = if ($req) { $req['scale'] } else { '_TBD_' }
    $budget         = if ($req) { $req['budget'] } else { '_TBD_' }
    $compliance     = if ($req -and $req['compliance']) { $req['compliance'] } else { '_TBD_' }

    $sb = [System.Text.StringBuilder]::new()
    [void]$sb.AppendLine('# Azure Deployment Plan')
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine('> **Status:** Planning | Approved | Executing | Ready for Validation | Validated | Deployed')
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine("Generated: $ts")
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine('---')
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine('## 1. Project Overview')
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine("**Goal:** $goal")
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine("**Path:** $mode")
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine('---')
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine('## 2. Requirements')
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine('| Attribute | Value |')
    [void]$sb.AppendLine('|-----------|-------|')
    [void]$sb.AppendLine("| Classification | $classification |")
    [void]$sb.AppendLine("| Scale | $scale |")
    [void]$sb.AppendLine("| Budget | $budget |")
    [void]$sb.AppendLine("| Compliance | $compliance |")
    [void]$sb.AppendLine("| **Subscription** | $sub |")
    [void]$sb.AppendLine("| **Location** | $loc |")
    [void]$sb.AppendLine('')
    $policy = (Get-ByPath $State 'auto.policyConstraints')
    if (-not $policy) { $policy = (Get-ByPath $State 'input.policyConstraints') }
    if ($policy -and @($policy).Count -gt 0) {
        [void]$sb.AppendLine('### Policy Constraints')
        [void]$sb.AppendLine('')
        foreach ($p in $policy) { [void]$sb.AppendLine("- $p") }
        [void]$sb.AppendLine('')
    }
    [void]$sb.AppendLine('---')
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine('## 3. Components Detected')
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine('| Component | Type | Technology | Path |')
    [void]$sb.AppendLine('|-----------|------|------------|------|')
    $components = (Get-ByPath $State 'input.components')
    if ($components) {
        foreach ($c in $components) {
            [void]$sb.AppendLine("| $($c['name']) | $($c['type']) | $($c['technology']) | $($c['path']) |")
        }
    }
    else {
        $langStr = ($a['detectedLanguages'] -join ', '); if (-not $langStr) { $langStr = '_TBD_' }
        [void]$sb.AppendLine("| _detected_ | _TBD_ | $langStr | . |")
    }
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine('---')
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine('## 4. Recipe Selection')
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine("**Selected:** $recipe")
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine("**Rationale:** $recipeWhy")
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine('---')
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine('## 5. Architecture')
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine("**Stack:** $stack")
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine('### Service Mapping')
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine('| Component | Azure Service | SKU |')
    [void]$sb.AppendLine('|-----------|---------------|-----|')
    $arch = (Get-ByPath $State 'input.architecture')
    if ($arch) {
        foreach ($m in $arch) {
            [void]$sb.AppendLine("| $($m['component']) | $($m['azureService']) | $($m['sku']) |")
        }
    }
    else {
        [void]$sb.AppendLine('| _TBD_ | _TBD_ | _TBD_ |')
    }
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine('---')
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine('## 6. Provisioning Limit Checklist')
    [void]$sb.AppendLine('')
    $quota = (Get-ByPath $State 'input.quotaChecklistMarkdown')
    if ($quota) { [void]$sb.AppendLine($quota) }
    else { [void]$sb.AppendLine('_Populate via the quota step (invoke azure-quotas). No "_TBD_" entries allowed before user presentation._') }
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine('---')
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine('## 7. Execution Checklist')
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine('### Phase 1: Planning')
    [void]$sb.AppendLine('- [ ] Analyze workspace')
    [void]$sb.AppendLine('- [ ] Gather requirements')
    [void]$sb.AppendLine('- [ ] Confirm subscription and location with user')
    [void]$sb.AppendLine('- [ ] Scan codebase')
    [void]$sb.AppendLine('- [ ] Select recipe')
    [void]$sb.AppendLine('- [ ] Plan architecture')
    [void]$sb.AppendLine('- [ ] Validate provisioning limits')
    [void]$sb.AppendLine('- [ ] **User approved this plan**')
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine('### Phase 2: Execution')
    [void]$sb.AppendLine('- [ ] Research components')
    [void]$sb.AppendLine('- [ ] Generate infrastructure and configuration')
    [void]$sb.AppendLine('- [ ] Harden security')
    [void]$sb.AppendLine('- [ ] Functional verification')
    [void]$sb.AppendLine('- [ ] **Update plan status to "Ready for Validation"**')
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine('### Phase 3: Validation')
    [void]$sb.AppendLine('- [ ] Invoke azure-validate skill')
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine('### Phase 4: Deployment')
    [void]$sb.AppendLine('- [ ] Invoke azure-deploy skill')
    [void]$sb.AppendLine('')

    $sb.ToString() | Set-Content -LiteralPath $planFile -Encoding utf8
    return $planFile
}

function Set-PlanStatus {
    # Rewrites the Status line in the existing deployment-plan.md to the given status (no-op if the plan is missing).
    param([string]$Status)
    $planFile = Join-Path $RepoPath '.azure/deployment-plan.md'
    if (-not (Test-Path -LiteralPath $planFile)) { return }
    $content = Get-Content -LiteralPath $planFile -Raw
    $content = $content -replace '(?m)^> \*\*Status:\*\*.*$', "> **Status:** $Status"
    $content | Set-Content -LiteralPath $planFile -Encoding utf8
}

function New-RecipeScaffold {
    # Deterministically creates the ./infra tree and writes the standard IaC parameter
    # stub for the selected recipe (main.parameters.json for Bicep, main.tfvars.json for
    # azd+Terraform). Idempotent: never overwrites existing files, and skips .NET Aspire
    # (azd init --from-code generates its own infra). Returns the list of created paths.
    param([hashtable]$State)
    $recipe = (Get-ByPath $State 'input.recipe')
    if (-not $recipe) { return @() }
    $a = $State['auto']
    if ($a -and $a['componentSignals'] -and $a['componentSignals']['aspire']) { return @() }

    $created = @()
    $infra   = Join-Path $RepoPath 'infra'
    if (-not (Test-Path -LiteralPath $infra)) {
        New-Item -ItemType Directory -Force -Path $infra | Out-Null; $created += 'infra/'
    }
    $modules = Join-Path $infra 'modules'
    if (-not (Test-Path -LiteralPath $modules)) {
        New-Item -ItemType Directory -Force -Path $modules | Out-Null; $created += 'infra/modules/'
    }

    # Bicep-based recipes share the same ARM-JSON parameters stub.
    if ($recipe -match 'Bicep' -or $recipe -eq 'AZCLI') {
        $paramFile = Join-Path $infra 'main.parameters.json'
        if (-not (Test-Path -LiteralPath $paramFile)) {
            @'
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "environmentName": { "value": "${AZURE_ENV_NAME}" },
    "location": { "value": "${AZURE_LOCATION}" }
  }
}
'@ | Set-Content -LiteralPath $paramFile -Encoding utf8
            $created += 'infra/main.parameters.json'
        }
    }
    # azd+Terraform uses a ${VAR}-substituted tfvars file that azd resolves via envsubst.
    elseif ($recipe -eq 'AZD (Terraform)') {
        $tfvars = Join-Path $infra 'main.tfvars.json'
        if (-not (Test-Path -LiteralPath $tfvars)) {
            @'
{
  "environment_name": "${AZURE_ENV_NAME}",
  "location": "${AZURE_LOCATION}",
  "subscription_id": "${AZURE_SUBSCRIPTION_ID}"
}
'@ | Set-Content -LiteralPath $tfvars -Encoding utf8
            $created += 'infra/main.tfvars.json'
        }
    }
    return $created
}

