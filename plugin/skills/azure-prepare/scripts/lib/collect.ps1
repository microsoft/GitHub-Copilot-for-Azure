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

    # --- .NET Aspire detection (AppHost project, Aspire.Hosting reference, or
    #     file-based AppHost using `#:sdk Aspire.AppHost.Sdk` / `#:package Aspire.Hosting` directives) ---
    $aspire = [bool]($files | Where-Object { $_.Name -like '*.AppHost.csproj' })
    if (-not $aspire) {
        foreach ($csproj in @($files | Where-Object { $_.Extension -eq '.csproj' })) {
            try {
                if ((Get-Content -LiteralPath $csproj.FullName -Raw) -match 'Aspire\.Hosting') { $aspire = $true; break }
            }
            catch { }
        }
    }
    if (-not $aspire) {
        foreach ($cs in @($files | Where-Object { $_.Extension -eq '.cs' })) {
            try {
                if ((Get-Content -LiteralPath $cs.FullName -Raw) -match '(?m)^\s*#:(sdk|package)\s+.*Aspire\.(AppHost|Hosting)') { $aspire = $true; break }
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

function Get-Principal {
    # Fetches the signed-in user's object id and display name as a hashtable @{id;name}.
    # Best-effort: returns empty values when az is missing, not logged in, or the caller is a
    # service principal (az ad signed-in-user fails for SPs; azd auto-populates the id at provision).
    if (-not (Get-Command az -ErrorAction SilentlyContinue)) { return @{ id = $null; name = $null } }
    try {
        $out = & az ad signed-in-user show --query '{id:id, name:displayName}' -o json 2>$null
        if ($LASTEXITCODE -ne 0 -or -not $out) { return @{ id = $null; name = $null } }
        $obj = $out | ConvertFrom-Json
        $id   = if ($obj.PSObject.Properties['id'])   { $obj.id }   else { $null }
        $name = if ($obj.PSObject.Properties['name']) { $obj.name } else { $null }
        return @{ id = $id; name = $name }
    }
    catch { return @{ id = $null; name = $null } }
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

function Get-ServiceProvider {
    # Maps an Azure service name (from input.architecture) to its ARM resource provider
    # namespace, or $null when unknown. Used to decide which providers to query for quota.
    param([string]$Service)
    $s = ($Service ?? '').ToLowerInvariant()
    switch -Wildcard ($s) {
        '*container app*'   { return 'Microsoft.App' }
        '*aks*'             { return 'Microsoft.ContainerService' }
        '*kubernetes*'      { return 'Microsoft.ContainerService' }
        '*virtual machine*' { return 'Microsoft.Compute' }
        '*vm scale*'        { return 'Microsoft.Compute' }
        '*machine learning*' { return 'Microsoft.MachineLearningServices' }
        '*ai foundry*'      { return 'Microsoft.MachineLearningServices' }
        '*azure ml*'        { return 'Microsoft.MachineLearningServices' }
        '*storage*'         { return 'Microsoft.Storage' }
        '*blob*'            { return 'Microsoft.Storage' }
        '*public ip*'       { return 'Microsoft.Network' }
        '*load balancer*'   { return 'Microsoft.Network' }
        '*virtual network*' { return 'Microsoft.Network' }
        '*vnet*'            { return 'Microsoft.Network' }
        '*application gateway*' { return 'Microsoft.Network' }
        '*app service*'     { return 'Microsoft.Web' }
        '*web app*'         { return 'Microsoft.Web' }
        '*function*'        { return 'Microsoft.Web' }
        '*cosmos*'          { return 'microsoft.documentdb' }
        default             { return $null }
    }
}

function Test-QuotaSupportedProvider {
    # Returns $true when a provider namespace is queryable via the az quota API. Providers with no
    # quota API (App Service/Functions, Cosmos DB) return $false so the LM uses the docs fallback.
    param([string]$Provider)
    if (-not $Provider) { return $false }
    if ($Provider -in @('Microsoft.Web', 'microsoft.documentdb')) { return $false }
    return $true
}

function Get-QuotaData {
    # Fetches quota limit/usage/available for every provider implied by the chosen architecture,
    # in the confirmed region, and returns a hashtable {region, subscriptionId, providers, unsupported}.
    # Best-effort: installs the quota extension if needed; providers that error or map to unsupported
    # namespaces are listed under `unsupported` for the LM to resolve via docs.
    param([hashtable]$State)
    if (-not (Get-Command az -ErrorAction SilentlyContinue)) { return @{} }
    $region = Get-ByPath $State 'input.location'
    if (-not $region) { return @{} }

    # Resolve the subscription to an id (GUID preferred; fall back to azContext or az lookup).
    $raw = Get-ByPath $State 'input.subscription'
    $subid = $null
    if ($raw -and $raw -match '^[0-9a-fA-F-]{36}$') { $subid = $raw }
    else {
        $ctx = Get-ByPath $State 'auto.azContext'
        if ($ctx -and $ctx['subscriptionId']) { $subid = $ctx['subscriptionId'] }
        if (-not $subid -and $raw) { try { $subid = (& az account show --subscription "$raw" --query id -o tsv 2>$null) } catch { } }
    }
    if (-not $subid) { try { $subid = (& az account show --query id -o tsv 2>$null) } catch { } }
    if (-not $subid) { return @{} }

    # Distinct provider namespaces implied by the architecture's azureService values.
    $supported = [System.Collections.Generic.List[string]]::new()
    $unsupported = [System.Collections.Generic.List[string]]::new()
    $arch = Get-ByPath $State 'input.architecture'
    foreach ($item in @($arch)) {
        $svc = $null
        if ($item -is [hashtable] -and $item.ContainsKey('azureService')) { $svc = $item['azureService'] }
        if (-not $svc) { continue }
        $provider = Get-ServiceProvider $svc
        if (Test-QuotaSupportedProvider $provider) {
            if (-not $supported.Contains($provider)) { $supported.Add($provider) }
        }
        elseif ($provider) {
            if (-not $unsupported.Contains($provider)) { $unsupported.Add($provider) }
        }
    }

    # Ensure the quota CLI extension is present (idempotent; first run only).
    if ($supported.Count -gt 0) {
        $ext = az extension list --query "[?name=='quota'].name" -o tsv 2>$null
        if (-not $ext) { az extension add --name quota --yes 2>$null | Out-Null }
    }

    $providers = @{}
    foreach ($provider in $supported) {
        $scope = "/subscriptions/$subid/providers/$provider/locations/$region"
        $quotas = $null; $usages = $null
        try { $q = & az quota list --scope $scope -o json 2>$null; if ($LASTEXITCODE -eq 0 -and $q) { $quotas = $q | ConvertFrom-Json } } catch { }
        if ($null -eq $quotas) { $unsupported.Add($provider); continue }
        try { $u = & az quota usage list --scope $scope -o json 2>$null; if ($LASTEXITCODE -eq 0 -and $u) { $usages = $u | ConvertFrom-Json } } catch { }
        $usageLookup = @{}
        foreach ($x in @($usages)) {
            try { $usageLookup[$x.name] = $x.properties.usages.value } catch { }
        }
        $rows = foreach ($qq in @($quotas)) {
            $name = $qq.name
            $limit = 0; try { $limit = [double]$qq.properties.limit.value } catch { }
            $used = 0; if ($usageLookup.ContainsKey($name)) { try { $used = [double]$usageLookup[$name] } catch { } }
            @{ name = $name; limit = $limit; usage = $used; available = ($limit - $used) }
        }
        $providers[$provider] = @($rows)
    }

    return @{
        region         = $region
        subscriptionId = $subid
        providers      = $providers
        unsupported    = @($unsupported | Select-Object -Unique)
    }
}

function Test-AzureYamlHasServices {
    # Returns $true if the given azure.yaml declares a non-empty `services:` block (at least one
    # indented service key under it). Used to detect Aspire AppHosts that only contain local-only
    # resources, whose generated azure.yaml has an empty/missing services map.
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return $false }
    $inServices = $false
    foreach ($line in (Get-Content -LiteralPath $Path)) {
        if ($line -match '^services:\s*$') { $inServices = $true; continue }
        if ($line -match '^[^\s#]') { $inServices = $false }
        if ($inServices -and $line -match '^\s+[A-Za-z0-9_-]+:') { return $true }
    }
    return $false
}

function Initialize-AzdProject {
    # For .NET Aspire projects, runs `azd init --from-code -e <env>` so the driver generates
    # azure.yaml + infra/ from the AppHost instead of the LM. Idempotent (skips when azure.yaml
    # already exists); records the outcome under auto.azdInit. No-op (with a reason) when azd is
    # unavailable. On success, validates that the generated azure.yaml has deployable services.
    param([hashtable]$State)
    $hasAzureYaml = (Test-Path -LiteralPath (Join-Path $RepoPath 'azure.yaml')) -or (Test-Path -LiteralPath (Join-Path $RepoPath 'azure.yml'))
    if ($hasAzureYaml) {
        Set-ByPath $State 'auto.azdInit' @{ ran = $false; ok = $true; reason = 'azure.yaml already exists' }
        return
    }
    if (-not (Get-Command azd -ErrorAction SilentlyContinue)) {
        Set-ByPath $State 'auto.azdInit' @{ ran = $false; ok = $false; reason = 'azd not available' }
        return
    }
    $envname = Get-AzdEnvName $State
    Push-Location -LiteralPath $RepoPath
    try {
        $out = & azd init --from-code -e $envname --no-prompt 2>&1 | Out-String
        $rc = $LASTEXITCODE
    }
    catch { $out = "$_"; $rc = 1 }
    finally { Pop-Location }
    if ($rc -ne 0) {
        $reason = 'azd init failed'
        if ("$out" -match 'unsupported resource type') { $reason = 'unsupported-resource-type' }
        Set-ByPath $State 'auto.azdInit' @{ ran = $true; ok = $false; envName = $envname; servicesFound = $false; reason = $reason }
        return
    }
    $svc = (Test-AzureYamlHasServices (Join-Path $RepoPath 'azure.yaml')) -or (Test-AzureYamlHasServices (Join-Path $RepoPath 'azure.yml'))
    Set-ByPath $State 'auto.azdInit' @{ ran = $true; ok = $true; envName = $envname; servicesFound = $svc; reason = $null }
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
    $principalId = Get-ByPath $State 'auto.principalId'
    $principalName = Get-ByPath $State 'auto.principalName'

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
        if ($principalId) { try { & azd env set AZURE_PRINCIPAL_ID $principalId 2>$null | Out-Null } catch { } }
        if ($principalName) { try { & azd env set AZURE_PRINCIPAL_NAME $principalName 2>$null | Out-Null } catch { } }

        $applied = $false; $vsub = $null; $vloc = $null; $vpid = $null
        try {
            $vals = & azd env get-values -o json 2>$null
            if ($LASTEXITCODE -eq 0 -and $vals) {
                $v = $vals | ConvertFrom-Json
                $applied = $true
                $vsub = $v.AZURE_SUBSCRIPTION_ID
                $vloc = $v.AZURE_LOCATION
                if ($v.PSObject.Properties['AZURE_PRINCIPAL_ID']) { $vpid = $v.AZURE_PRINCIPAL_ID }
            }
        }
        catch { }
        Set-ByPath $State 'auto.azdEnv' @{ applied = $applied; name = $envname; subscriptionId = $vsub; location = $vloc; principalId = $vpid }
    }
    finally { Pop-Location }
}

# ---------------------------------------------------------------------------
# Azure Functions template fetch (folds the functions_template_get MCP tool
# into the driver by shelling out to the Azure MCP CLI, deterministically)
# ---------------------------------------------------------------------------

function Invoke-FunctionsCli {
    # Invokes the Azure MCP CLI's `functions template get` command and returns its parsed JSON result,
    # or $null when npx (or the CLI) is unavailable or the invocation fails.
    param([string[]]$CliArgs)
    if (-not (Get-Command npx -ErrorAction SilentlyContinue)) { return $null }
    try {
        $raw = & npx --yes '@azure/mcp@latest' functions template get @CliArgs 2>$null | Out-String
        if ($LASTEXITCODE -ne 0 -or -not $raw) { return $null }
        return ($raw | ConvertFrom-Json)
    }
    catch { return $null }
}

function Test-FunctionsIntent {
    # Returns $true when the project targets Azure Functions, using the detected host.json/SDK signal
    # or the LM-provided components/architecture (so greenfield NEW projects are covered too).
    param([hashtable]$State)
    if ((Get-ByPath $State 'auto.componentSignals.azureFunctions') -eq $true) { return $true }
    foreach ($c in @(Get-ByPath $State 'input.components')) {
        if ($c -is [hashtable] -and "$($c['type']) $($c['technology'])".ToLowerInvariant() -match 'function') { return $true }
    }
    foreach ($m in @(Get-ByPath $State 'input.architecture')) {
        if ($m -is [hashtable] -and "$($m['azureService'])".ToLowerInvariant() -match 'function') { return $true }
    }
    return $false
}

function Get-FunctionsLanguage {
    # Maps the driver's coarse language tags to the CLI's language names (later lowercased),
    # disambiguating Node.js into TypeScript vs JavaScript. Returns $null when undeterminable.
    param([hashtable]$State)
    $langs = @(Get-ByPath $State 'auto.detectedLanguages')
    if ($langs -contains 'dotnet') { return 'CSharp' }
    if ($langs -contains 'python') { return 'Python' }
    if ($langs -contains 'java')   { return 'Java' }
    if ($langs -contains 'nodejs') {
        if (@(Get-RepoFiles) | Where-Object { $_.Name -eq 'tsconfig.json' -or $_.Extension -eq '.ts' }) { return 'TypeScript' }
        return 'JavaScript'
    }
    return $null
}

function Get-FunctionsResource {
    # Scans existing function source for a trigger/binding indicator and returns the matching template
    # resource (durable/cosmos/eventhub/servicebus/blob/sql/mcp/timer/http), or $null. Specific triggers first.
    param([hashtable]$State)
    $files = @(Get-RepoFiles) | Where-Object { $_.Extension -in '.cs', '.py', '.js', '.ts', '.java', '.ps1', '.json' }
    if (-not $files) { return $null }
    $blob = ($files | ForEach-Object { try { Get-Content -LiteralPath $_.FullName -Raw -ErrorAction SilentlyContinue } catch { } }) -join "`n"
    if (-not $blob) { return $null }
    if ($blob -imatch 'DurableOrchestrationTrigger|orchestration_trigger|OrchestrationTrigger|df\.Orchestrator') { return 'durable' }
    if ($blob -imatch 'CosmosDBTrigger|cosmos_db_trigger') { return 'cosmos' }
    if ($blob -imatch 'EventHubTrigger|event_hub_message_trigger') { return 'eventhub' }
    if ($blob -imatch 'ServiceBus(Queue|Topic)?Trigger|service_bus_(queue|topic)_trigger') { return 'servicebus' }
    if ($blob -imatch 'BlobTrigger|blob_trigger') { return 'blob' }
    if ($blob -imatch 'SqlTrigger|sql_trigger') { return 'sql' }
    if ($blob -imatch 'McpToolTrigger|mcp_tool_trigger|mcpToolTrigger') { return 'mcp' }
    if ($blob -imatch 'TimerTrigger|timer_trigger|schedule') { return 'timer' }
    if ($blob -imatch 'HttpTrigger|http_trigger|@app\.route') { return 'http' }
    return $null
}

function Get-FunctionsRecipeIac {
    # Maps the chosen recipe to the IaC flavour used to filter templates (Terraform recipes -> terraform,
    # everything else -> bicep, since templates are provisioned with either bicep or terraform).
    param([hashtable]$State)
    if ("$(Get-ByPath $State 'input.recipe')" -match 'Terraform') { return 'terraform' }
    return 'bicep'
}

function Resolve-FunctionsTemplate {
    # Resolves the best template name for a language/resource/IaC by listing templates via the MCP CLI.
    # Prefers the canonical "<resource>-*" starter (skipping ai-* variants) and the "-trigger-" template,
    # breaking ties by shortest name. Returns the templateName, or $null when none match.
    param([hashtable]$State, [string]$Language, [string]$Resource, [string]$Iac)
    $res = Invoke-FunctionsCli @('--language', $Language)
    if (-not $res -or $res.status -ne 200 -or -not $res.results.templateList.triggers) { return $null }
    $rl = $Resource.ToLower()
    $isTf = ($Iac.ToLower() -eq 'terraform')
    $cand = @($res.results.templateList.triggers | Where-Object {
            $_.resource.ToLower() -eq $rl -and
            (($isTf -and $_.infrastructure.ToLower() -eq 'terraform') -or
            ((-not $isTf) -and $_.infrastructure.ToLower() -eq 'bicep')) })
    if (-not $cand) { return $null }
    $canon = @($cand | Where-Object { $_.templateName.ToLower().StartsWith($rl + '-') })
    if ($canon) { $cand = $canon }
    $best = $cand | Sort-Object `
        @{ Expression = { if ($_.templateName -like '*-trigger-*') { 0 } else { 1 } } }, `
        @{ Expression = { $_.templateName.Length } }, templateName | Select-Object -First 1
    return $best.templateName
}

function Expand-FunctionsTemplate {
    # Fetches the named template's files via the MCP CLI (--output New) and writes each {fileName, content}
    # under $Dest, creating parent directories. Returns the written files (relative to $Dest), or $null
    # on any CLI/parse failure or when the template has no files.
    param([string]$Language, [string]$Template, [string]$Dest)
    $res = Invoke-FunctionsCli @('--language', $Language, '--template', $Template, '--output', 'New')
    if (-not $res -or $res.status -ne 200) { return $null }
    $files = @($res.results.functionTemplate.files)
    if (-not $files -or $files.Count -eq 0) { return $null }
    New-Item -ItemType Directory -Force -Path $Dest | Out-Null
    $enc = [System.Text.UTF8Encoding]::new($false)
    $written = @()
    foreach ($f in $files) {
        $fn = "$($f.fileName)"
        if (-not $fn) { continue }
        $rel = $fn -replace '\\', '/'
        $full = Join-Path $Dest $rel
        $dir = Split-Path -Parent $full
        if ($dir) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
        $content = if ($null -ne $f.content) { [string]$f.content } else { '' }
        [System.IO.File]::WriteAllText($full, $content, $enc)
        $written += $rel
    }
    return $written
}

function Invoke-FunctionsTemplateFetch {
    # Fetches the template selected in input.functionsTemplate and records the outcome under
    # auto.functionsTemplate. Greenfield (NEW) templates land in the repo root; existing projects
    # land in a staging dir. Records a reason when no template exists or the fetch fails.
    param([hashtable]$State)
    $sel = Get-ByPath $State 'input.functionsTemplate'
    if (-not ($sel -is [hashtable])) { return }
    $resource = "$($sel['resource'])"; $language = "$($sel['language'])"
    if (-not $resource -or -not $language) { return }
    $cliLang = $language.ToLower()
    $iac = Get-FunctionsRecipeIac $State
    $id = Resolve-FunctionsTemplate $State $cliLang $resource $iac
    if (-not $id) {
        Set-ByPath $State 'auto.functionsTemplate' @{ fetched = $false; id = $null; resource = $resource; language = $language; iac = $iac; placement = $null; files = @(); reason = 'no-template-use-references' }
        return
    }
    if ((Get-ByPath $State 'input.mode') -eq 'NEW' -or (Get-ByPath $State 'auto.workspaceEmpty') -eq $true) {
        $dest = $RepoPath; $placement = 'repo-root'
    }
    else {
        $dest = Join-Path $StateDir 'functions-template'; $placement = 'staging'
        if (Test-Path -LiteralPath $dest) { Remove-Item -LiteralPath $dest -Recurse -Force -ErrorAction SilentlyContinue }
    }
    $files = Expand-FunctionsTemplate $cliLang $id $dest
    if ($null -eq $files) {
        Set-ByPath $State 'auto.functionsTemplate' @{ fetched = $false; id = $id; placement = $null; files = @(); reason = 'fetch-failed' }
        return
    }
    Set-ByPath $State 'auto.functionsTemplate' @{ fetched = $true; id = $id; placement = $placement; path = $dest; files = @($files); reason = $null }
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

