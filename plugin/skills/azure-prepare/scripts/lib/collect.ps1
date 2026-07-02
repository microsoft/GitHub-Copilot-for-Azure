# =============================================================================
# collect.ps1 -- Programmatic auto-collection of repo/azd/az context.
# Dot-sourced by prepare.ps1; shares script scope ($RepoPath, $StateFile, $Steps).
# Not a standalone script.
# =============================================================================

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

    $fresh = @{
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
    # Merge collector output over any existing auto.* keys so that values recorded by
    # step onDone hooks in earlier invocations (e.g. auto.policyConstraints) survive.
    $existingAuto = $State['auto']
    if ($existingAuto -is [hashtable]) {
        foreach ($k in $fresh.Keys) { $existingAuto[$k] = $fresh[$k] }
    }
    else {
        $State['auto'] = $fresh
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

function Get-Subscriptions {
    # Lists the caller's Azure subscriptions as objects with name/id/isDefault/state.
    # Best-effort: returns an empty array when az is missing, not logged in, or the query fails.
    if (-not (Get-Command az -ErrorAction SilentlyContinue)) { return @() }
    try {
        $out = & az account list --all --query '[].{name:name, id:id, isDefault:isDefault, state:state}' -o json 2>$null
        if ($LASTEXITCODE -ne 0 -or -not $out) { return @() }
        return @($out | ConvertFrom-Json)
    }
    catch { return @() }
}

function Get-PolicyConstraints {
    # Fetches enforced Azure Policy assignments for the confirmed subscription and distills
    # them into a short array of constraint strings. Best-effort: returns an empty array when
    # az is unavailable, unauthenticated, or the subscription cannot be resolved. Called from
    # the azure-context onDone hook (after input.subscription is set) so it adds no extra invocation.
    param([hashtable]$State)
    if (-not (Get-Command az -ErrorAction SilentlyContinue)) { return @() }
    $raw = Get-ByPath $State 'input.subscription'
    $subid = $null
    if ($raw -and $raw -match '^[0-9a-fA-F-]{36}$') {
        $subid = $raw
    }
    else {
        $ctx = Get-ByPath $State 'auto.azContext'
        if ($ctx -and $ctx['subscriptionId']) { $subid = $ctx['subscriptionId'] }
        if (-not $subid -and $raw) {
            try { $subid = (& az account show --subscription "$raw" --query id -o tsv 2>$null) } catch { }
        }
    }
    if (-not $subid) { return @() }
    try {
        $out = & az policy assignment list --scope "/subscriptions/$subid" -o json 2>$null
        if ($LASTEXITCODE -ne 0 -or -not $out) { return @() }
        $assignments = ($out | ConvertFrom-Json)
    }
    catch { return @() }
    $result = [System.Collections.Generic.List[string]]::new()
    foreach ($a in @($assignments)) {
        try {
            if (($a.PSObject.Properties['enforcementMode']) -and ($a.enforcementMode -eq 'DoNotEnforce')) { continue }
            $name = $null
            if ($a.PSObject.Properties['displayName']) { $name = $a.displayName }
            if (-not $name -and $a.PSObject.Properties['name']) { $name = $a.name }
            if (-not $name) { $name = 'policy' }
            $effect = $null
            $p = $a.PSObject.Properties['parameters']
            if ($p -and $p.Value) {
                $e = $p.Value.PSObject.Properties['effect']
                if ($e -and $e.Value) {
                    $v = $e.Value.PSObject.Properties['value']
                    if ($v -and $v.Value) { $effect = $v.Value }
                }
            }
            $s = if ($effect) { "$name [$effect]" } else { "$name" }
            if ($s -and -not $result.Contains($s)) { [void]$result.Add($s) }
        }
        catch { }
    }
    return $result.ToArray()
}

function Get-AzdEnvName {
    # Derives a valid azd environment name: an existing env name, else a sanitized repo basename, else "dev".
    param([hashtable]$State)
    $existing = Get-ByPath $State 'auto.azdContext.env.name'
    if ($existing) { return $existing }
    $base = Split-Path -Leaf $RepoPath
    $name = ($base.ToLowerInvariant() -replace '[^a-z0-9-]+', '-') -replace '-+', '-'
    $name = $name.Trim('-')
    if (-not $name) { $name = 'dev' }
    return $name
}

function Apply-AzdEnvironment {
    # Creates/selects the azd environment and applies subscription/location for AZD recipes.
    # Guarded by the existence of azure.yaml so `azd env new` never runs before the project
    # exists; records the outcome under auto.azdEnv. No-op (with a reason) for non-AZD recipes,
    # a missing azure.yaml, or an unavailable azd CLI.
    param([hashtable]$State)
    $recipe = Get-ByPath $State 'input.recipe'
    if ($recipe -notmatch 'AZD' -and $recipe -notmatch 'Aspire') {
        Set-ByPath $State 'auto.azdEnv' @{ applied = $false; name = 'n/a'; reason = 'non-azd recipe' }
        return
    }
    $hasAzureYaml = (Test-Path -LiteralPath (Join-Path $RepoPath 'azure.yaml')) -or (Test-Path -LiteralPath (Join-Path $RepoPath 'azure.yml'))
    if (-not $hasAzureYaml) {
        Set-ByPath $State 'auto.azdEnv' @{ applied = $false; name = $null; reason = 'azure.yaml not found; project not initialized' }
        return
    }
    if (-not (Get-Command azd -ErrorAction SilentlyContinue)) {
        Set-ByPath $State 'auto.azdEnv' @{ applied = $false; name = $null; reason = 'azd not available' }
        return
    }
    $envname = Get-AzdEnvName $State
    $subid = $null
    $ctx = Get-ByPath $State 'auto.azContext'
    if ($ctx -and $ctx['subscriptionId']) { $subid = $ctx['subscriptionId'] }
    if (-not $subid) { $subid = Get-ByPath $State 'input.subscription' }
    $loc = Get-ByPath $State 'input.location'

    Push-Location -LiteralPath $RepoPath
    try {
        # Create the env only when it does not already exist; azd env new errors on a duplicate.
        $exists = $false
        try {
            $listed = & azd env list -o json 2>$null
            if ($LASTEXITCODE -eq 0 -and $listed) {
                $envs = $listed | ConvertFrom-Json
                if ($envs | Where-Object { $_.Name -eq $envname }) { $exists = $true }
            }
        }
        catch { }
        try {
            if ($exists) { & azd env select $envname 2>$null | Out-Null }
            else { & azd env new $envname --no-prompt 2>$null | Out-Null }
        }
        catch { }
        if ($subid) { try { & azd env set AZURE_SUBSCRIPTION_ID $subid 2>$null | Out-Null } catch { } }
        if ($loc) { try { & azd env set AZURE_LOCATION $loc 2>$null | Out-Null } catch { } }

        $applied = $false; $vsub = $null; $vloc = $null
        try {
            $vals = & azd env get-values -o json 2>$null
            if ($LASTEXITCODE -eq 0 -and $vals) {
                $v = $vals | ConvertFrom-Json
                $applied = $true
                $vsub = $v.AZURE_SUBSCRIPTION_ID
                $vloc = $v.AZURE_LOCATION
            }
        }
        catch { }
        Set-ByPath $State 'auto.azdEnv' @{ applied = $applied; name = $envname; subscriptionId = $vsub; location = $vloc }
    }
    finally { Pop-Location }
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

