#requires -Version 7.0
<#
.SYNOPSIS
    State-machine driver for the azure-prepare-script skill.

.DESCRIPTION
    Drives the "prepare an app for Azure deployment" workflow as a deterministic
    state machine. The script owns <RepoPath>/.azure-prepare/prepare-info.json and
    advances the workflow as far as it can PROGRAMMATICALLY on each invocation. When
    it needs information only the language model (LM) can provide, it writes null
    placeholder keys under `input.*`, prints a NEXT ACTION block describing exactly
    what to collect, and exits. The LM fills the keys and re-runs the script. The
    cycle repeats until the script prints a COMPLETE block.

.PARAMETER RepoPath
    Path to the repository / workspace root being prepared for Azure.

.EXAMPLE
    pwsh ./prepare.ps1 -RepoPath /path/to/repo
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$RepoPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
if (-not (Test-Path -LiteralPath $RepoPath)) {
    throw "RepoPath does not exist: $RepoPath"
}
$RepoPath  = (Resolve-Path -LiteralPath $RepoPath).Path
$StateDir  = Join-Path $RepoPath '.azure-prepare'
$StateFile = Join-Path $StateDir 'prepare-info.json'
$SchemaVersion = 1

# ---------------------------------------------------------------------------
# Nested get/set helpers (dotted paths into the state hashtable)
# ---------------------------------------------------------------------------
function Get-ByPath {
    # Returns the value at a dotted path (e.g. "input.mode") within a nested hashtable, or $null if any segment is missing.
    param([hashtable]$Root, [string]$Path)
    $node = $Root
    foreach ($seg in $Path.Split('.')) {
        if ($node -is [hashtable] -and $node.ContainsKey($seg)) {
            $node = $node[$seg]
        }
        else {
            return $null
        }
    }
    return $node
}

function Set-ByPath {
    # Sets the value at a dotted path within a nested hashtable, creating intermediate hashtables as needed.
    param([hashtable]$Root, [string]$Path, $Value)
    $segs = $Path.Split('.')
    $node = $Root
    for ($i = 0; $i -lt $segs.Count - 1; $i++) {
        $seg = $segs[$i]
        if (-not ($node.ContainsKey($seg)) -or -not ($node[$seg] -is [hashtable])) {
            $node[$seg] = @{}
        }
        $node = $node[$seg]
    }
    $node[$segs[-1]] = $Value
}

function Test-Provided {
    # A need is "provided" when the key exists and is not null and not an empty string.
    param([hashtable]$Root, [string]$Path)
    $segs = $Path.Split('.')
    $node = $Root
    for ($i = 0; $i -lt $segs.Count - 1; $i++) {
        $seg = $segs[$i]
        if ($node -is [hashtable] -and $node.ContainsKey($seg)) { $node = $node[$seg] } else { return $false }
    }
    $leaf = $segs[-1]
    if (-not ($node -is [hashtable]) -or -not $node.ContainsKey($leaf)) { return $false }
    $val = $node[$leaf]
    if ($null -eq $val) { return $false }
    if ($val -is [string] -and [string]::IsNullOrWhiteSpace($val)) { return $false }
    return $true
}

# ---------------------------------------------------------------------------
# State load / save
# ---------------------------------------------------------------------------
function New-State {
    # Builds a fresh, empty state object for a repo that has no prepare-info.json yet.
    return @{
        schemaVersion = $SchemaVersion
        repoPath      = $RepoPath
        createdAtUtc  = (Get-Date).ToUniversalTime().ToString('o')
        updatedAtUtc  = (Get-Date).ToUniversalTime().ToString('o')
        auto          = @{}      # script-owned, refreshed every run
        steps         = @{}      # per-step status: pending | done
        input         = @{}      # LM-owned values
    }
}

function Get-State {
    # Loads the existing state file (ensuring core keys exist), or creates the state directory and a new state object.
    if (Test-Path -LiteralPath $StateFile) {
        $raw = Get-Content -LiteralPath $StateFile -Raw
        $obj = $raw | ConvertFrom-Json -AsHashtable
        if (-not $obj.ContainsKey('auto'))  { $obj['auto']  = @{} }
        if (-not $obj.ContainsKey('steps')) { $obj['steps'] = @{} }
        if (-not $obj.ContainsKey('input')) { $obj['input'] = @{} }
        return $obj
    }
    New-Item -ItemType Directory -Force -Path $StateDir | Out-Null
    return New-State
}

function Save-State {
    # Stamps the updated timestamp and writes the state object back to prepare-info.json as JSON.
    param([hashtable]$State)
    $State['updatedAtUtc'] = (Get-Date).ToUniversalTime().ToString('o')
    New-Item -ItemType Directory -Force -Path $StateDir | Out-Null
    ($State | ConvertTo-Json -Depth 30) | Set-Content -LiteralPath $StateFile -Encoding utf8
}

# ---------------------------------------------------------------------------
# Programmatic collectors (idempotent; run every invocation)
# ---------------------------------------------------------------------------
function Get-RepoFiles {
    # Top-level + shallow scan, excluding noise directories.
    $exclude = @('.git', '.azure-prepare', 'node_modules', 'bin', 'obj', '.venv', 'dist', '.terraform')
    Get-ChildItem -LiteralPath $RepoPath -Recurse -File -Depth 3 -ErrorAction SilentlyContinue |
        Where-Object {
            $rel = $_.FullName.Substring($RepoPath.Length).TrimStart('\', '/')
            $seg = $rel -split '[\\/]'
            -not ($seg | Where-Object { $exclude -contains $_ })
        }
}

function Invoke-AutoCollect {
    # Scans the repo and refreshes the state's `auto.*` block (languages, frameworks, existing infra, markers, git, Azure context).
    param([hashtable]$State)

    $files = @(Get-RepoFiles)
    $names = @($files | ForEach-Object { $_.Name })
    function HasFile([string]$pattern) { return [bool]($files | Where-Object { $_.Name -like $pattern }) }

    # --- languages ---
    $langs = [System.Collections.Generic.List[string]]::new()
    if (HasFile 'package.json')      { $langs.Add('nodejs') }
    if ((HasFile '*.csproj') -or (HasFile '*.sln')) { $langs.Add('dotnet') }
    if ((HasFile 'requirements.txt') -or (HasFile 'pyproject.toml') -or (HasFile 'setup.py')) { $langs.Add('python') }
    if ((HasFile 'pom.xml') -or (HasFile 'build.gradle')) { $langs.Add('java') }
    if (HasFile 'go.mod')            { $langs.Add('go') }
    if (HasFile 'Cargo.toml')        { $langs.Add('rust') }

    # --- frameworks (best-effort from package.json / python files) ---
    $frameworks = [System.Collections.Generic.List[string]]::new()
    $copilotSdk = $false
    $pkg = $files | Where-Object { $_.Name -eq 'package.json' } | Select-Object -First 1
    if ($pkg) {
        try {
            $json = Get-Content -LiteralPath $pkg.FullName -Raw | ConvertFrom-Json -AsHashtable
            $deps = @{}
            foreach ($k in @('dependencies', 'devDependencies')) {
                if ($json.ContainsKey($k) -and $json[$k]) { $json[$k].Keys | ForEach-Object { $deps[$_] = $true } }
            }
            foreach ($fw in @('react', 'next', 'express', 'fastify', '@angular/core', 'vue', 'svelte', 'nestjs', '@nestjs/core')) {
                if ($deps.ContainsKey($fw)) { $frameworks.Add($fw) }
            }
            if ($deps.ContainsKey('@github/copilot-sdk')) { $copilotSdk = $true }
        }
        catch { }
    }
    $reqFiles = @($files | Where-Object { $_.Name -in @('requirements.txt', 'pyproject.toml') })
    foreach ($rf in $reqFiles) {
        try {
            $txt = (Get-Content -LiteralPath $rf.FullName -Raw)
            foreach ($fw in @('flask', 'django', 'fastapi', 'uvicorn', 'gunicorn')) {
                if ($txt -match "(?im)^\s*$fw\b") { if (-not $frameworks.Contains($fw)) { $frameworks.Add($fw) } }
            }
        }
        catch { }
    }

    # --- existing infrastructure ---
    $existingInfra = @{
        azureYaml  = [bool]($files | Where-Object { $_.Name -in @('azure.yaml', 'azure.yml') })
        bicep      = [bool]($files | Where-Object { $_.Extension -eq '.bicep' })
        terraform  = [bool]($files | Where-Object { $_.Extension -eq '.tf' })
        dockerfile = [bool]($files | Where-Object { $_.Name -like 'Dockerfile*' })
        githubActions = [bool]($files | Where-Object { $_.FullName -like '*\.github\workflows\*' -or $_.FullName -like '*/.github/workflows/*' })
        azurePipelines = [bool]($files | Where-Object { $_.Name -eq 'azure-pipelines.yml' })
        azureYamlProvider = $null
    }

    # --- azure.yaml IaC provider (terraform vs bicep/default) ---
    $azureYamlFile = $files | Where-Object { $_.Name -in @('azure.yaml', 'azure.yml') } | Select-Object -First 1
    if ($azureYamlFile) {
        try {
            if ((Get-Content -LiteralPath $azureYamlFile.FullName -Raw) -match '(?im)provider\s*:\s*terraform') {
                $existingInfra.azureYamlProvider = 'terraform'
            }
            else { $existingInfra.azureYamlProvider = 'bicep' }
        }
        catch { }
    }

    # --- .NET Aspire detection (AppHost project or Aspire.Hosting reference) ---
    $aspire = [bool]($files | Where-Object { $_.Name -like '*.AppHost.csproj' })
    if (-not $aspire) {
        foreach ($csproj in @($files | Where-Object { $_.Extension -eq '.csproj' })) {
            try {
                if ((Get-Content -LiteralPath $csproj.FullName -Raw) -match 'Aspire\.Hosting') { $aspire = $true; break }
            }
            catch { }
        }
    }

    # --- Azure Functions detection (host.json, SDK dependency, or WebJobs reference) ---
    $azureFunctions = [bool]($files | Where-Object { $_.Name -eq 'host.json' })
    if (-not $azureFunctions -and $pkg) {
        try {
            if ((Get-Content -LiteralPath $pkg.FullName -Raw) -match '@azure/functions|azure-functions') { $azureFunctions = $true }
        }
        catch { }
    }
    if (-not $azureFunctions) {
        foreach ($csproj in @($files | Where-Object { $_.Extension -eq '.csproj' })) {
            try {
                if ((Get-Content -LiteralPath $csproj.FullName -Raw) -match 'Microsoft\.Azure\.(Functions|WebJobs)') { $azureFunctions = $true; break }
            }
            catch { }
        }
    }

    # --- pure static site detection (HTML/assets only, no build tooling or framework) ---
    $hasHtml = [bool]($files | Where-Object { $_.Extension -in @('.html', '.htm') })
    $pureStaticSite = ($hasHtml -and $langs.Count -eq 0 -and $frameworks.Count -eq 0)

    # --- workspace emptiness ---
    $workspaceEmpty = ($files.Count -eq 0)

    # --- existing plan ---
    $planPath = Join-Path $RepoPath '.azure/deployment-plan.md'

    # --- git ---
    $gitRoot = $null
    if (Test-Path -LiteralPath (Join-Path $RepoPath '.git')) { $gitRoot = $RepoPath }

    $State['auto'] = @{
        scannedAtUtc     = (Get-Date).ToUniversalTime().ToString('o')
        fileCount        = $files.Count
        workspaceEmpty   = $workspaceEmpty
        detectedLanguages  = @($langs | Select-Object -Unique)
        detectedFrameworks = @($frameworks | Select-Object -Unique)
        existingInfra    = $existingInfra
        componentSignals = @{ aspire = $aspire; azureFunctions = $azureFunctions; pureStaticSite = $pureStaticSite }
        codebaseMarkers  = @{ copilotSdk = $copilotSdk }
        gitRoot          = $gitRoot
        existingPlan     = (Test-Path -LiteralPath $planPath)
        azContext        = (Get-AzContext)
        azdContext       = (Get-AzdContext)
    }
}

function Get-AzdContext {
    # Best-effort read of azd's configured defaults and current environment values (subscription/location) from the repo, or an "unavailable" result if azd is missing.
    $result = @{ available = $false; defaults = @{ subscription = $null; location = $null }; env = @{ name = $null; subscriptionId = $null; location = $null } }
    $azd = Get-Command azd -ErrorAction SilentlyContinue
    if (-not $azd) { return $result }
    Push-Location -LiteralPath $RepoPath
    try {
        $result.available = $true
        try {
            $def = & azd config get defaults -o json 2>$null
            if ($LASTEXITCODE -eq 0 -and $def) {
                $d = ($def | ConvertFrom-Json)
                $result.defaults.subscription = $d.subscription
                $result.defaults.location     = $d.location
            }
        }
        catch { }
        try {
            # azd env values only exist for azd projects; skip the call when there is no azure.yaml.
            $hasAzureYaml = (Test-Path -LiteralPath (Join-Path $RepoPath 'azure.yaml')) -or (Test-Path -LiteralPath (Join-Path $RepoPath 'azure.yml'))
            if ($hasAzureYaml) {
                $vals = & azd env get-values -o json 2>$null
                if ($LASTEXITCODE -eq 0 -and $vals) {
                    $v = ($vals | ConvertFrom-Json)
                    $result.env.subscriptionId = $v.AZURE_SUBSCRIPTION_ID
                    $result.env.location       = $v.AZURE_LOCATION
                    $result.env.name           = $v.AZURE_ENV_NAME
                }
            }
        }
        catch { }
    }
    finally { Pop-Location }
    return $result
}

function Get-AzContext {
    # Returns the signed-in Azure subscription/tenant from `az account show`, or an "unavailable" result if the CLI is missing or not logged in.
    $result = @{ available = $false; subscriptionId = $null; subscriptionName = $null; tenantId = $null }
    $az = Get-Command az -ErrorAction SilentlyContinue
    if (-not $az) { return $result }
    try {
        $out = & az account show -o json 2>$null
        if ($LASTEXITCODE -eq 0 -and $out) {
            $acct = ($out | ConvertFrom-Json)
            $result.available        = $true
            $result.subscriptionId   = $acct.id
            $result.subscriptionName = $acct.name
            $result.tenantId         = $acct.tenantId
        }
    }
    catch { }
    return $result
}

# ---------------------------------------------------------------------------
# Proposed mode from programmatic signals (LM confirms)
# ---------------------------------------------------------------------------
function Get-ProposedMode {
    # Proposes a workspace mode (NEW / MODIFY / MODERNIZE) from the auto-detected signals; the LM confirms it later.
    param([hashtable]$State)
    $a = $State['auto']
    if ($a['workspaceEmpty']) { return 'NEW' }
    if ($a['existingInfra']['azureYaml'] -or $a['existingInfra']['bicep'] -or $a['existingInfra']['terraform']) { return 'MODIFY' }
    return 'MODERNIZE'
}

function Get-ProposedRecipe {
    # Proposes an IaC recipe from the auto-detected signals (Aspire, azure.yaml provider, *.tf, *.bicep); the LM confirms it later.
    param([hashtable]$State)
    $a = $State['auto']
    $infra = $a['existingInfra']
    if ($a['componentSignals'] -and $a['componentSignals']['aspire']) { return 'AZD (Aspire, via azd init --from-code)' }
    if ($infra['azureYaml']) {
        if ($infra['azureYamlProvider'] -eq 'terraform') { return 'AZD (Terraform)' }
        return 'AZD (Bicep)'
    }
    if ($infra['terraform']) { return 'AZD (Terraform)' }
    if ($infra['bicep']) { return 'Bicep' }
    return 'AZD (Bicep)'
}

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
    $policy = (Get-ByPath $State 'input.policyConstraints')
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

# ---------------------------------------------------------------------------
# Step definitions (ordered). Each step:
#   id        unique id, also key under state.steps
#   phase     1 (planning) or 2 (execution)
#   title     short human title
#   refs      reference files (relative to skill root) the LM should read for detail
#   needs     array of @{ Path = 'input.x'; Prompt = '...' } — LM-provided fields
#   auto      optional scriptblock ($State) that fills fields / may satisfy needs
#   onDone    optional scriptblock ($State) run once when the step completes
#   gate      $true if this step is a user-approval gate
#   guidance  instruction text shown to the LM when the step needs LM input
# ---------------------------------------------------------------------------
$Steps = @(
    @{
        id = 'specialized-check'; phase = 1; title = 'Specialized technology check'
        refs = @('references/specialized-routing.md')
        guidance = @'
Decide whether a specialized skill should handle this request FIRST. Check the user's
PROMPT TEXT, not just existing code — critical for greenfield projects with no codebase.
Codebase markers already scanned by the script are in `auto.codebaseMarkers`.

Routing (see specialized-routing.md for the full table):
- copilot SDK / copilot app / @github/copilot-sdk / CopilotClient / sendAndWait
    -> invoke **azure-hosted-copilot-sdk**, then resume by re-running this script.
- AWS / GCP / Lambda cross-cloud migration
    -> invoke **azure-cloud-migrate** (do NOT continue here).
- Azure Functions / function app / timer or service-bus trigger / func new
    -> STAY here; prefer Azure Functions templates at the architecture/generate steps.
- APIM / AI gateway / durable orchestration
    -> STAY here; load the matching service reference when you reach architecture.

Re-entry guard: if this run is a RESUME from a specialized skill that already executed,
set matched=false with notes="resumed from <skill>" so the workflow proceeds.

Set `input.specializedRouting` to an object:
  { "matched": true|false, "skill": "<skill-name or null>", "notes": "<why>" }
If matched (and not a resume), invoke that skill first, then re-run this script.
'@
        needs = @(
            @{ Path = 'input.specializedRouting'; Prompt = 'Routing decision object: { matched, skill, notes }' }
        )
    },
    @{
        id = 'analyze'; phase = 1; title = 'Analyze workspace (NEW / MODIFY / MODERNIZE)'
        refs = @()
        guidance = @'
Choose exactly one workspace mode. The script proposed one in `auto.proposedMode` from
file signals (`auto.workspaceEmpty`, `auto.existingInfra`). Confirm or correct it.

Modes:
- NEW       — empty workspace, or the user wants to create a new app from scratch.
- MODIFY    — existing Azure app (has azure.yaml/infra); user adds features/components.
- MODERNIZE — existing non-Azure app being moved to Azure (add Azure support first).

Decision tree:
- Create a new application                      -> NEW
- Add/change features to an existing app
    - has azure.yaml or infra (see auto.existingInfra) -> MODIFY
    - no Azure config                                  -> MODERNIZE
- Migrate/modernize for Azure
    - cross-cloud (AWS/GCP/Lambda) -> stop; this should have routed to azure-cloud-migrate
    - on-prem or generic           -> MODERNIZE

Detection signals (already gathered in `auto`):
  azureYaml=AZD project (MODIFY likely) · bicep/terraform=existing IaC ·
  dockerfile=containerized · workspaceEmpty=NEW or MODERNIZE.
Note: having azure.yaml does NOT mean skip to validate — the user may want to extend it.

Set `input.mode` to "NEW", "MODIFY", or "MODERNIZE".
Also set `input.goal` to a one-line statement of what the user wants.
'@
        needs = @(
            @{ Path = 'input.mode'; Prompt = 'Workspace mode: NEW | MODIFY | MODERNIZE (proposed value is in auto.proposedMode)' },
            @{ Path = 'input.goal'; Prompt = 'One-line goal of the project' }
        )
        auto = {
            param($State)
            Set-ByPath $State 'auto.proposedMode' (Get-ProposedMode $State)
        }
    },
    @{
        id = 'requirements'; phase = 1; title = 'Gather requirements'
        refs = @()
        guidance = @'
Use `ask_user` to gather deployment requirements, then record them. Confirm each
of: classification, scale, budget, and compliance/data-residency needs.

Classification (drives reliability + monitoring footprint):
  - POC          → minimal infra, cost-optimized
  - Development   → balanced, team-focused internal tooling
  - Production    → full reliability, monitoring, customer-facing

Scale (drives SKUs + redundancy):
  - Small  (<1K users)     → single region, basic SKUs
  - Medium (1K-100K users) → auto-scaling, multi-zone
  - Large  (100K+ users)   → multi-region, premium SKUs

Budget (drives SKU tier):
  - Cost-Optimized → minimize spend, lower SKUs
  - Balanced        → value for money, standard SKUs
  - Performance     → maximum capability, premium SKUs

Compliance (drives region + security controls): data residency (region
constraints), industry regulations (security controls), internal policies
(approval workflows).

Set `input.requirements` to an object:
  { "classification": "POC|Development|Production",
    "scale": "Small|Medium|Large",
    "budget": "Cost-Optimized|Balanced|Performance",
    "compliance": "free text, or 'None' " }

Note: Azure Policy enforcement constraints are gathered separately in the
azure-context step once a subscription is confirmed.
'@
        needs = @(
            @{ Path = 'input.requirements'; Prompt = 'Requirements object: { classification, scale, budget, compliance }' }
        )
    },
    @{
        id = 'scan'; phase = 1; title = 'Scan codebase'
        refs = @()
        guidance = @'
The script already auto-detected (see `auto.*`):
  - `auto.detectedLanguages`  — nodejs/dotnet/python/java/go/rust
  - `auto.detectedFrameworks` — react/next/express/flask/django/fastapi/etc.
  - `auto.existingInfra`      — azureYaml/bicep/terraform/dockerfile/githubActions/azurePipelines
  - `auto.componentSignals`   — aspire / azureFunctions / pureStaticSite
  - `auto.codebaseMarkers`    — copilotSdk (specialized-skill trigger)

Review the code and classify each component. Map signals to component types:
  - React/Vue/Angular in package.json        → SPA Frontend
  - Only .html/.css/.js, no package.json       → Pure Static Site
  - Express/Fastify/Koa, Flask/FastAPI/Django → API Service
  - Next.js/Nuxt                               → SSR Web App
  - Celery/Bull/Agenda                         → Background Worker
  - azure-functions SDK                        → Azure Function
  - *.AppHost.csproj / Aspire.Hosting          → .NET Aspire App

Caveats:
  - Pure Static Site (`auto.componentSignals.pureStaticSite` true): do NOT add a
    `language` field to azure.yaml — it triggers unwanted build steps.
  - .NET Aspire (`auto.componentSignals.aspire` true): prefer
    `azd init --from-code -e <env>` over manual azure.yaml. If the AppHost calls
    `AddAzureFunctionsProject`, you MUST add
    `.WithEnvironment("AzureWebJobsSecretStorageType", "Files")` before deploy.
    See `references/aspire.md` for the full procedure.

Set `input.components` to an array of objects:
  [ { "name": "...", "type": "Frontend|API|Worker|Function|Aspire|Static|...",
      "technology": "...", "path": "...", "dependsOn": ["PostgreSQL", "api", ...] } ]
'@
        needs = @(
            @{ Path = 'input.components'; Prompt = 'Array of components: { name, type, technology, path, dependsOn }' }
        )
    },
    @{
        id = 'recipe'; phase = 1; title = 'Select recipe'
        refs = @(
            'references/recipes/azd/README.md',
            'references/recipes/azcli/README.md',
            'references/recipes/bicep/README.md',
            'references/recipes/terraform/README.md'
        )
        guidance = @'
Choose the IaC recipe. The script computed a suggestion in `auto.suggestedRecipe`
from existing tooling (`auto.existingInfra`, including `azureYamlProvider`) and
`auto.componentSignals.aspire`. Confirm or override it.

Special case — .NET Aspire (`auto.componentSignals.aspire` true):
  Always use AZD with auto-generated config (`azd init --from-code`). Do NOT
  manually select a recipe or hand-author artifacts. See `references/aspire.md`.

Default is AZD unless requirements indicate otherwise. azd supports both Bicep and
Terraform as IaC providers; when Terraform is wanted for an Azure deployment,
prefer AZD (Terraform) for the best DX.

Decision criteria:
  - AZD (Bicep)     → new/multi-service apps, simplest deploy (`azd up`)
  - AZD (Terraform) → DEFAULT when Terraform is wanted + azd simplicity
  - AZCLI           → existing az scripts, imperative control, custom pipelines, AKS
  - Bicep           → IaC-first, no CLI wrapper, direct ARM deployment
  - Terraform       → multi-cloud (non-Azure-first) or TF workflows incompatible with azd

Auto-detection mapping (already applied to `auto.suggestedRecipe`):
  azure.yaml provider=terraform → AZD (Terraform); azure.yaml else → AZD (Bicep);
  *.tf no azure.yaml → AZD (Terraform); *.bicep no azure.yaml → Bicep/AZCLI;
  nothing → AZD (Bicep).

Set `input.recipe` to one of: "AZD (Bicep)" | "AZD (Terraform)" | "AZCLI" | "Bicep" | "Terraform".
Set `input.recipeRationale` to a short reason. Then load the matching recipe
README above for the generate step.
'@
        auto = {
            param($State)
            # Compute a suggested recipe from programmatic signals so the LM can confirm rather than derive it.
            Set-ByPath $State 'auto.suggestedRecipe' (Get-ProposedRecipe $State)
        }
        needs = @(
            @{ Path = 'input.recipe'; Prompt = 'Recipe: AZD (Bicep) | AZD (Terraform) | AZCLI | Bicep | Terraform (see auto.suggestedRecipe)' },
            @{ Path = 'input.recipeRationale'; Prompt = 'Why this recipe' }
        )
    },
    @{
        id = 'architecture'; phase = 1; title = 'Plan architecture'
        refs = @()
        guidance = @'
Select a hosting stack, map each component to an Azure service + SKU, and record
rationale. Load per-service detail under `references/services/<service>/README.md`
as needed.

Stack selection:
  - Containers  → Docker experience, complex deps, microservices
                  (Container Apps, AKS, ACR)
  - Serverless  → event-driven, variable traffic, cost optimization
                  (Functions, Logic Apps, Event Grid)
  - App Service → traditional web apps, PaaS preference
                  (App Service, Static Web Apps)
  Lean Serverless for event-driven/minimal-ops; Containers for complex deps or
  long-running; App Service for traditional PaaS web apps.

Container hosting — Container Apps vs AKS:
  - Container Apps → microservices without K8s, KEDA/Dapr built-in, scale-to-zero,
                     teams without K8s expertise.
  - AKS           → need K8s API/kubectl, custom operators/CRDs, service mesh
                     (Istio), GPU/ML, complex/multi-tenant networking.
  ⮕ If AKS is chosen, invoke the **azure-kubernetes** skill for SKU (Automatic vs
     Standard), networking, identity, scaling, and security configuration.

Hosting service mapping (component type → primary [→ alternatives]):
  - SPA Frontend       → Static Web Apps [Blob + CDN]
  - SSR Web App        → Container Apps [App Service, AKS]
  - REST/GraphQL API   → Container Apps [App Service, Functions, AKS]
  - Background Worker  → Container Apps [Functions, AKS]
  - Scheduled Task     → Functions (Timer) [Container Apps Jobs, AKS CronJob]
  - Event Processor    → Functions [Container Apps, AKS + KEDA]
  - Microservices(K8s) → AKS [Container Apps]
  - GPU/ML Workloads   → AKS [Azure ML]

Data: Relational→Azure SQL [PostgreSQL/MySQL]; Document→Cosmos DB [MongoDB];
  Cache→Redis; Files→Blob Storage; Search→AI Search.
Integration: Queue→Service Bus; Pub/Sub→Event Grid; Streaming→Event Hubs.

Workflow & orchestration:
  - Multi-step workflow → Durable Functions + Durable Task Scheduler (DTS).
    ⚠️ DTS is the REQUIRED managed backend — do NOT use Azure Storage or MSSQL
    backends. See `references/services/functions/durable.md`.
  - Low-code / visual workflow → Logic Apps.

Supporting services — ALWAYS include: Log Analytics (logging), Application
Insights (monitoring/APM), Key Vault (secrets), Managed Identity (svc-to-svc auth).

Set `input.stack` to "Containers" | "Serverless" | "App Service" (or a hybrid label).
Set `input.architecture` to an array of objects:
  [ { "component": "...", "azureService": "...", "sku": "...", "rationale": "..." } ]
Include the supporting services as their own entries.
'@
        needs = @(
            @{ Path = 'input.stack'; Prompt = 'Stack: Containers | Serverless | App Service' },
            @{ Path = 'input.architecture'; Prompt = 'Array of mappings: { component, azureService, sku, rationale }' }
        )
    },
    @{
        id = 'azure-context'; phase = 1; title = 'Confirm Azure subscription and location'
        refs = @('references/region-availability.md')
        guidance = @'
Detect, confirm, and apply the Azure subscription and target region. The script
already collected:
  - `auto.azContext`  — `az account show` (subscriptionName/Id, tenantId)
  - `auto.azdContext` — azd defaults + current env (AZURE_SUBSCRIPTION_ID/LOCATION)

1. Existing AZD env (when `auto.existingInfra.azureYaml` is true): if
   `auto.azdContext.env` already has subscription/location, `ask_user` to confirm
   reuse; if accepted, skip re-detection.
2. Defaults: offer `auto.azdContext.defaults` then `auto.azContext` as the
   RECOMMENDED values (`auto.suggestedSubscription` holds the best guess).
3. Confirm subscription via `ask_user` showing the ACTUAL name AND id
   (e.g. "Use current: <name> (<id>)"). Never offer a vague "use default" choice.
   If the user wants a different one, list via `az account list -o table`.
4. Confirm region via `ask_user`. Consult `references/region-availability.md` and
   present ONLY regions that support ALL selected services — a region missing a
   service will fail deployment. Honor any data-residency constraint in
   `input.requirements.compliance`.
5. Provisioning limits for the chosen region are validated in the next (quota)
   step via the azure-quotas skill; if capacity is insufficient, return here and
   pick another region.
6. Apply to the azd environment — REQUIRED for AZD/Aspire recipes, immediately
   after `azd init`/`azd env new` (do NOT defer to deploy; az and azd keep
   separate config contexts):
     azd env new <env> --no-prompt      # or: azd init --from-code -e <env> --no-prompt
     azd env set AZURE_SUBSCRIPTION_ID <id>
     azd env set AZURE_LOCATION <location>
     azd env get-values                 # verify
   Record the environment name in `input.azdEnvName` ("n/a" for non-azd recipes).

Set `input.subscription` to the confirmed subscription name or id.
Set `input.location` to the confirmed Azure region (e.g., "eastus2").

After the subscription is confirmed, query Azure Policy assignments to discover
enforcement constraints BEFORE finalizing architecture (skipping this causes
deployment failures when policy denies resource creation):
  mcp_azure_mcp_policy(command: "policy_assignment_list", subscription: "<subscriptionId>")

Record discovered constraints so they feed architecture + generation. Watch for:
  - Blocked resource types / SKUs  → exclude from architecture
  - Required tags                  → add to all Bicep/Terraform resources
  - Allowed regions                → restrict location choices
  - Network restrictions (no public endpoints) → adjust networking/access
  - Storage policies (deny shared key) → use policy-compliant auth
  - Naming conventions             → apply to resource naming

Set `input.policyConstraints` to an array of short strings (empty array if none).
'@
        needs = @(
            @{ Path = 'input.subscription'; Prompt = 'Confirmed subscription name or id (auto.azContext has the detected one)' },
            @{ Path = 'input.location'; Prompt = 'Confirmed Azure region' },
            @{ Path = 'input.azdEnvName'; Prompt = 'azd environment name applied with subscription/location ("n/a" for non-azd recipes)' },
            @{ Path = 'input.policyConstraints'; Prompt = 'Array of policy constraint strings (empty array if none found)' }
        )
        auto = {
            param($State)
            # Prefill the suggested subscription from azd env, then azd defaults, then az account, when the LM has not chosen one.
            if (-not (Test-Provided $State 'input.subscription')) {
                $suggest = $null
                $azd = Get-ByPath $State 'auto.azdContext'
                if ($azd -and $azd['available']) {
                    if ($azd['env'] -and $azd['env']['subscriptionId']) { $suggest = $azd['env']['subscriptionId'] }
                    elseif ($azd['defaults'] -and $azd['defaults']['subscription']) { $suggest = $azd['defaults']['subscription'] }
                }
                if (-not $suggest) {
                    $ctx = Get-ByPath $State 'auto.azContext'
                    if ($ctx -and $ctx['available']) { $suggest = $ctx['subscriptionName']; if (-not $suggest) { $suggest = $ctx['subscriptionId'] } }
                }
                # Do NOT auto-confirm location — region is a deliberate user choice.
                if ($suggest) { Set-ByPath $State 'auto.suggestedSubscription' $suggest }
            }
        }
    },
    @{
        id = 'quota'; phase = 1; title = 'Validate provisioning limits'
        refs = @('scripts/references/resources-limits-quotas.md', 'references/plan-template.md')
        guidance = @'
Build the provisioning-limit checklist for all resources to be deployed, then
validate capacity in the confirmed subscription + region.

Invoke the **azure-quotas** skill to fetch real quota/usage via the Azure quota
CLI. Process ONE resource type at a time: `az quota list` first; if the provider
returns BadRequest (e.g. Microsoft.DocumentDB), fall back to Azure Resource Graph
+ official limits docs. Compute Available = Limit − Current Usage. If insufficient,
request an increase or return to the azure-context step for another region.

NO "_TBD_" entries may remain. Render the completed Section 6 table(s) as markdown.
See `scripts/references/resources-limits-quotas.md` for the full limits catalog,
CLI reference, service patterns, and a worked example.

Set `input.quotaChecklistMarkdown` to that markdown block.
'@
        needs = @(
            @{ Path = 'input.quotaChecklistMarkdown'; Prompt = 'Completed provisioning-limit checklist as markdown (no _TBD_ entries)' }
        )
    },
    @{
        id = 'finalize-plan'; phase = 1; title = 'Generate deployment plan (automatic)'
        refs = @()
        guidance = ''
        needs = @()
        onDone = {
            param($State)
            $path = Write-DeploymentPlan $State
            Set-ByPath $State 'auto.planFile' $path
        }
    },
    @{
        id = 'approval'; phase = 1; title = 'Present plan and get approval'
        refs = @()
        gate = $true
        guidance = @'
Present `.azure/deployment-plan.md` (the script just generated/updated it) to the user
and ask for explicit approval. Do NOT proceed without it.
Set `input.userApproved` to true once the user approves (false/keep null to revise).
If the user requests changes, update the relevant `input.*` fields and re-run so the
plan regenerates before asking again.
'@
        needs = @(
            @{ Path = 'input.userApproved'; Prompt = 'true when the user has approved the plan' }
        )
        onDone = {
            param($State)
            Set-PlanStatus -Status 'Approved'
        }
    },
    @{
        id = 'research'; phase = 2; title = 'Research components'
        refs = @('references/region-availability.md')
        guidance = @'
For each Azure service in `input.architecture`, gather best practices BEFORE
generating artifacts, then record findings.

Process:
  1. List all services from the architecture plan.
  2. Load each service's `references/services/<service>/README.md` first, then
     specific files (bicep.md / terraform.md / scaling.md / auth.md / sdk.md / etc.)
     only as needed (progressive loading).
  3. Check resource naming rules (valid chars, length, uniqueness scope) per
     learn.microsoft.com resource-name-rules.
  4. Load the selected recipe's guide + its IaC rules / MCP best practices / schema
     tools (see the recipe README chosen earlier).
  5. Verify every service is available in the target region
     (`references/region-availability.md`).
  6. Provisioning limits/quota were validated in the quota step — re-check if the
     architecture changed.
  7. For containerized apps, load runtime production settings (e.g.
     `references/runtimes/nodejs.md`).
  8. Invoke related skills for deeper guidance (see routing below).
  9. Document findings in `.azure/deployment-plan.md` under `## Research Summary`.

Service → reference / related skill (load README under references/services/<svc>/):
  - Container Apps / App Service → +azure-diagnostics, azure-observability, azure-nodejs-production
  - AKS → +azure-networking
  - Functions → (stay here; see composition mandate below)
  - Storage → +azure-storage
  - API Management → references/apim.md, +azure-aigateway (AI Gateway policies)
  - Durable Functions → services/functions/durable.md + services/durable-task-scheduler/
  - Key Vault → +azure-keyvault-expiration-audit;  Managed Identity → +entra-app-registration
  - Application Insights → +appinsights-instrumentation;  Log Analytics → +azure-observability, azure-kusto
  - Azure OpenAI → services/foundry/ + microsoft-foundry;  AI Search → +azure-ai

Skill routing for special scenarios:
  - GitHub Copilot SDK → invoke **azure-hosted-copilot-sdk** (scaffold+config), then resume.
  - Azure Functions → STAY here: load services/functions/templates/selection.md (decision
    tree) → follow services/functions/templates/recipes/composition.md (algorithm). Never
    synthesize IaC by hand.
  - PostgreSQL passwordless / security hardening → handle directly with service refs.
  - App Insights instrumentation → appinsights-instrumentation; AI apps → microsoft-foundry;
    cost-sensitive → azure-cost.

Set `input.researchDone` to true when finished.
'@
        needs = @(
            @{ Path = 'input.researchDone'; Prompt = 'true when component research is complete' }
        )
    },
    @{
        id = 'generate'; phase = 2; title = 'Generate artifacts'
        refs = @(
            'references/recipes/azd/README.md',
            'references/recipes/azcli/README.md',
            'references/recipes/bicep/README.md',
            'references/recipes/terraform/README.md'
        )
        guidance = @'
Generate infrastructure and configuration files for the selected recipe. Research
(prior step) MUST be complete and its findings applied.

⛔ FIRST — .NET Aspire (`auto.componentSignals.aspire` true): do NOT hand-create
azure.yaml or infra/ files. USE `azd init --from-code -e <env>` (it generates infra
from the AppHost). Then IMMEDIATELY `azd env set AZURE_SUBSCRIPTION_ID <id>`. See
`references/aspire.md` and `references/recipes/azd/aspire.md`. Manually authoring
azure.yaml for Aspire is the most common deployment failure.

Other special patterns: complex existing codebase → consider `azd init --from-code`;
existing azure.yaml (`auto.existingInfra.azureYaml`) → MODIFY the existing config.

⛔ If the target compute is Azure Functions, load the composition algorithm BEFORE
generating any infrastructure:
  1. Load `references/services/functions/templates/selection.md` (base template + recipe).
  2. Load `references/services/functions/templates/recipes/composition.md` (the algorithm).
  3. Use the `functions_template_get` MCP tool to list/fetch templates and write
     functionFiles[] + projectFiles[] directly — NEVER hand-write Bicep/Terraform.
     Fallback to `azd init -t <template>` / `func init` / `func new` only when composing
     multiple recipes and the required templates are not found.
  The Functions bicep.md/terraform.md files are REFERENCE DOCS, not templates to copy —
  hand-writing from them yields missing RBAC and broken managed identity.
For other compute (Container Apps, App Service, Static Web Apps) load their
`references/services/<service>/README.md`. Load the selected recipe's README (above)
for detailed generation steps.

Generation order: (1) azure.yaml (AZD only) → (2) app code scaffolding (entry points,
health endpoints) → (3) Dockerfiles (if containerized) → (4) IaC in ./infra/ →
(5) CI/CD (if requested). Typical layout: .azure/, infra/{main.bicep|main.tf,modules/},
src/<component>/Dockerfile, azure.yaml.

⚠️ Create the full directory tree (`mkdir -p`) BEFORE writing files — the `create`
tool does NOT make parent directories.

Security requirements (MANDATORY):
  - No hardcoded secrets; Key Vault for sensitive values; Managed Identity for auth;
    HTTPS only, TLS 1.2+.
  - SQL Server Bicep MUST use Entra-only auth — omit administratorLogin /
    administratorLoginPassword entirely (incl. conditional branches); these names must
    not appear in any .bicep. See `references/services/sql-database/bicep.md`.
  - SQL + Managed Identity → MUST generate scripts/grant-sql-access.sh + .ps1 and a
    `postprovision` hook in azure.yaml (ARM role assignments only grant control-plane).
  - App Service Bicep → every Microsoft.Web/sites MUST carry
    tags: union(tags, { 'azd-service-name': serviceName }) or `azd deploy` can't find it.
  - Containerized apps → apply runtime production settings (e.g. `references/runtimes/nodejs.md`).

After generation: record the generated file list in `.azure/deployment-plan.md`.
Set `input.generateDone` to true when artifacts are written.
'@
        needs = @(
            @{ Path = 'input.generateDone'; Prompt = 'true when infrastructure/config artifacts are generated' }
        )
    },
    @{
        id = 'security'; phase = 2; title = 'Harden security'
        refs = @('scripts/references/security.md')
        guidance = @'
Harden the generated artifacts following Zero Trust: never trust/always verify,
least privilege, defense in depth, encryption everywhere.

Identity & access:
  - Managed identities everywhere — no credentials in code.
  - Least-privilege RBAC (e.g. "Key Vault Secrets User", "Storage Blob Data Reader")
    scoped to the resource, not subscription. Assigning roles needs
    Microsoft.Authorization/roleAssignments/write (User Access Administrator).
  - Microsoft Entra ID for auth; MFA for users.
  - SQL Server → Entra-only auth: NEVER emit administratorLogin /
    administratorLoginPassword anywhere in Bicep (incl. conditional branches).

Network: private endpoints for PaaS in production; NSGs on subnets (default deny);
  disable public endpoints where possible; DDoS protection; Azure Firewall for egress.

Data protection: encryption at rest (default) + TLS 1.2+ in transit; secrets in
  Key Vault with soft-delete + purge protection + RBAC authorization; customer-managed
  keys for sensitive data.

Monitoring: enable Microsoft Defender for Cloud on production workloads; diagnostic +
  audit logging to Log Analytics; security alerts.

SDK auth: use the language Azure Identity package; `DefaultAzureCredential` for LOCAL
  dev only — in production use `ManagedIdentityCredential` (Rust: `DeveloperToolsCredential`).
  See `references/auth-best-practices.md`.

See `scripts/references/security.md` for the full checklists, MCP/CLI commands, RBAC
tables, and SDK package matrix.

Set `input.securityDone` to true when hardening is complete.
'@
        needs = @(
            @{ Path = 'input.securityDone'; Prompt = 'true when security hardening is complete' }
        )
    },
    @{
        id = 'functional-verify'; phase = 2; title = 'Functional verification'
        refs = @('references/functional-verification.md')
        guidance = @'
Verify the app works (UI + backend), locally where possible.
Set `input.functionalVerifyDone` to true when verification passes (or is N/A).
'@
        needs = @(
            @{ Path = 'input.functionalVerifyDone'; Prompt = 'true when functional verification is done' }
        )
    },
    @{
        id = 'handoff'; phase = 2; title = 'Update plan status and hand off (automatic)'
        refs = @()
        guidance = ''
        needs = @()
        onDone = {
            param($State)
            Set-PlanStatus -Status 'Ready for Validation'
        }
    }
)

# ---------------------------------------------------------------------------
# Output emitters
# ---------------------------------------------------------------------------
function Write-NextAction {
    # Writes null placeholders for the missing keys, saves state, and prints the NEXT ACTION block telling the LM what to do and which keys to fill.
    param([hashtable]$State, [hashtable]$Step, [array]$Missing)

    # Ensure null placeholders exist for every missing need so the LM has a template.
    foreach ($n in $Missing) {
        if (-not (Test-Provided $State $n.Path)) { Set-ByPath $State $n.Path $null }
    }
    Save-State $State

    $phaseLabel = if ($Step.phase -eq 1) { 'Phase 1 — Planning' } else { 'Phase 2 — Execution' }

    Write-Output '=== AZURE-PREPARE-SCRIPT :: NEXT ACTION ==='
    Write-Output ''
    Write-Output "Step:  $($Step.id)  ($phaseLabel)"
    Write-Output "Title: $($Step.title)"
    Write-Output "State: $StateFile"
    Write-Output ''
    if ($Step.ContainsKey('gate') -and $Step.gate) {
        Write-Output '*** USER APPROVAL GATE — do not continue until the user approves. ***'
        Write-Output ''
    }
    Write-Output 'What to do:'
    foreach ($line in ($Step.guidance -split "`n")) { Write-Output ("  " + $line.TrimEnd()) }
    Write-Output ''
    if ($Step.refs.Count -gt 0) {
        Write-Output 'Read for detail:'
        foreach ($r in $Step.refs) { Write-Output "  - $r" }
        Write-Output ''
    }
    Write-Output 'Fill these keys in the state file (currently null):'
    foreach ($n in $Missing) {
        Write-Output "  - $($n.Path) : $($n.Prompt)"
    }
    Write-Output ''
    Write-Output 'Then re-run:'
    Write-Output "  pwsh <skill>/scripts/prepare.ps1 -RepoPath `"$RepoPath`""
    Write-Output ''
    Write-Output '=== END NEXT ACTION ==='
}

function Write-Complete {
    # Saves state and prints the COMPLETE block directing the LM to hand off to azure-validate.
    param([hashtable]$State)
    Save-State $State
    $plan = Join-Path $RepoPath '.azure/deployment-plan.md'
    Write-Output '=== AZURE-PREPARE-SCRIPT :: COMPLETE ==='
    Write-Output ''
    Write-Output 'All preparation steps are done.'
    Write-Output "Plan: $plan  (Status: Ready for Validation)"
    Write-Output ''
    Write-Output 'Next: invoke the azure-validate skill.'
    Write-Output 'Do NOT run azd up / azd deploy / terraform apply directly.'
    Write-Output ''
    Write-Output '=== END COMPLETE ==='
}

# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------
$State = Get-State
Invoke-AutoCollect -State $State

foreach ($step in $Steps) {
    $id = $step.id
    if (-not $State['steps'].ContainsKey($id)) { $State['steps'][$id] = 'pending' }
    if ($State['steps'][$id] -eq 'done') { continue }

    # Run the step's auto collector (may satisfy needs programmatically).
    if ($step.ContainsKey('auto') -and $step.auto) { & $step.auto $State }

    # Determine missing needs.
    $missing = @()
    foreach ($n in @($step.needs)) {
        if (-not (Test-Provided $State $n.Path)) { $missing += $n }
    }

    if ($missing.Count -gt 0) {
        Write-NextAction -State $State -Step $step -Missing $missing
        return
    }

    # All needs satisfied — finalize the step.
    if ($step.ContainsKey('onDone') -and $step.onDone) { & $step.onDone $State }
    $State['steps'][$id] = 'done'
    Save-State $State
}

Write-Complete -State $State
