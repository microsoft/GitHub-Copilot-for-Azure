# =============================================================================
# steps.ps1 -- Ordered step definitions ($Steps): metadata, needs, auto/onDone, guidance.
# Dot-sourced by prepare.ps1; shares script scope ($RepoPath, $StateFile, $Steps).
# Not a standalone script.
# =============================================================================

# ---------------------------------------------------------------------------
# Step definitions (ordered). Each step:
#   id          unique id, also key under state.steps
#   phase       1 (planning) or 2 (execution)
#   title       short human title
#   refs        reference files (relative to skill root) the LM should read for detail
#   dynamicRefs optional scriptblock ($State) returning extra ref paths computed from
#               detected languages / chosen architecture (merged with refs at output time)
#   needs       array of @{ Path = 'input.x'; Prompt = '...' } — LM-provided fields
#   auto        optional scriptblock ($State) that fills fields / may satisfy needs
#   onDone      optional scriptblock ($State) run once when the step completes
#   gate        $true if this step is a user-approval gate
# Per-step LM instruction text is not stored inline; Get-StepGuidance loads it
# from lib/guidance/<id>.txt at output time (see below).
# ---------------------------------------------------------------------------
# Per-step LM guidance text is stored as plain-text files in lib/guidance/
# <step-id>.txt and shared verbatim with the Bash driver (guidance.sh reads
# the same files). Get-StepGuidance loads a step's text; automatic steps with
# no guidance file yield an empty string.
# ---------------------------------------------------------------------------
$GuidanceDir = Join-Path $PSScriptRoot 'guidance'

function Get-StepGuidance([string]$Id) {
    $f = Join-Path $GuidanceDir "$Id.txt"
    if (Test-Path -LiteralPath $f) { (Get-Content -LiteralPath $f -Raw).TrimEnd("`r", "`n") } else { '' }
}

$Steps = @(
    @{
        id = 'specialized-check'; phase = 1; title = 'Specialized technology check'
        refs = @()
        needs = @(
            @{ Path = 'input.specializedRouting'; Prompt = 'Routing decision object: { matched, skill, notes }' }
        )
    },
    @{
        id = 'analyze'; phase = 1; title = 'Analyze workspace (NEW / MODIFY / MODERNIZE)'
        refs = @()
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
        needs = @(
            @{ Path = 'input.requirements'; Prompt = 'Requirements object: { classification, scale, budget, compliance }' }
        )
    },
    @{
        id = 'scan'; phase = 1; title = 'Scan codebase'
        refs = @()
        needs = @(
            @{ Path = 'input.components'; Prompt = 'Array of components: { name, type, technology, path, dependsOn }' }
        )
    },
    @{
        id = 'recipe'; phase = 1; title = 'Select recipe'
        refs = @(
            'scripts/references/recipes/azd/README.md',
            'scripts/references/recipes/azcli/README.md',
            'scripts/references/recipes/bicep/README.md',
            'scripts/references/recipes/terraform/README.md'
        )
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
        needs = @(
            @{ Path = 'input.stack'; Prompt = 'Stack: Containers | Serverless | App Service' },
            @{ Path = 'input.architecture'; Prompt = 'Array of mappings: { component, azureService, sku, rationale }' }
        )
    },
    @{
        id = 'azure-context'; phase = 1; title = 'Confirm Azure subscription and location'
        refs = @('scripts/references/region-availability.md')
        needs = @(
            @{ Path = 'input.subscription'; Prompt = 'Confirmed subscription name or id (auto.azContext has the detected one)' },
            @{ Path = 'input.location'; Prompt = 'Confirmed Azure region' }
        )
        auto = {
            param($State)
            # Enumerate subscriptions once: auto-confirm when exactly one exists,
            # otherwise cache the list to a separate file the LM can read on demand.
            if (-not (Test-Provided $State 'input.subscription')) {
                $subFile = Join-Path $StateDir 'subscriptions.json'
                if (-not (Test-Path -LiteralPath $subFile)) {
                    $subs = @(Get-Subscriptions)
                    if ($subs.Count -eq 1) {
                        Set-ByPath $State 'input.subscription' $subs[0].id
                    }
                    elseif ($subs.Count -gt 1) {
                        ($subs | ConvertTo-Json -Compress -Depth 5) | Set-Content -LiteralPath $subFile -Encoding utf8
                        Set-ByPath $State 'auto.subscriptionsFile' $subFile
                        Set-ByPath $State 'auto.subscriptionCount' $subs.Count
                    }
                }
            }
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
        onDone = {
            param($State)
            # Subscription is now confirmed; discover Azure Policy constraints and the
            # signed-in principal programmatically so the LM no longer queries them itself
            # (records auto.policyConstraints, auto.principalId, auto.principalName).
            Set-ByPath $State 'auto.policyConstraints' (Get-PolicyConstraints $State)
            $principal = Get-Principal
            Set-ByPath $State 'auto.principalId' $principal['id']
            Set-ByPath $State 'auto.principalName' $principal['name']
        }
    },
    @{
        id = 'quota'; phase = 1; title = 'Validate provisioning limits'
        refs = @('scripts/references/resources-limits-quotas.md', 'scripts/references/plan-template.md')
        needs = @(
            @{ Path = 'input.quotaChecklistMarkdown'; Prompt = 'Completed provisioning-limit checklist as markdown (no _TBD_ entries)' }
        )
        auto = {
            param($State)
            # Fetch quota limit/usage/available for the architecture's providers once per region
            # and cache to a separate file, so the LM formats the checklist instead of running
            # az quota itself. Re-fetch only when the region changes or the cache is missing.
            $region = Get-ByPath $State 'input.location'
            $quotaFile = Join-Path $StateDir 'quota-data.json'
            $fetchedRegion = $null
            $qd = Get-ByPath $State 'auto.quotaData'
            if ($qd -is [hashtable] -and $qd.ContainsKey('region')) { $fetchedRegion = $qd['region'] }
            if ($region -and (-not (Test-Path -LiteralPath $quotaFile) -or $fetchedRegion -ne $region)) {
                $data = Get-QuotaData $State
                if ($data -is [hashtable] -and $data.ContainsKey('region') -and $data['region']) {
                    ($data | ConvertTo-Json -Depth 8 -Compress) | Set-Content -LiteralPath $quotaFile -Encoding utf8
                    Set-ByPath $State 'auto.quotaFile' $quotaFile
                    $counts = @{}
                    foreach ($p in $data['providers'].Keys) { $counts[$p] = @($data['providers'][$p]).Count }
                    Set-ByPath $State 'auto.quotaData' @{
                        region      = $data['region']
                        providers   = @($data['providers'].Keys)
                        quotaCounts = $counts
                        unsupported = $data['unsupported']
                    }
                }
            }
        }
    },
    @{
        id = 'finalize-plan'; phase = 1; title = 'Generate deployment plan (automatic)'
        refs = @()
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
        refs = @('scripts/references/region-availability.md')
        dynamicRefs = {
            param($State)
            # Name the exact per-service README for every service in the architecture so the
            # LM reads the right reference rather than resolving a <service> placeholder.
            $r = @(Get-ServiceReadmeRefs $State)
            $r += Get-DurableRefs $State
            $r
        }
        auto = {
            param($State)
            # For existing Functions code, detect the trigger resource + language from the source so the
            # driver can fetch the template without asking the LM (greenfield still asks via the need).
            if ((Test-FunctionsIntent $State) -and -not (Test-Provided $State 'input.functionsTemplate')) {
                $fres = Get-FunctionsResource $State
                $flang = Get-FunctionsLanguage $State
                if ($fres -and $flang) {
                    Set-ByPath $State 'input.functionsTemplate' @{ resource = $fres; language = $flang }
                }
            }
            # Once resource+language are known, list the matching templates ONCE (filter by resource +
            # IaC). Auto-select when exactly one matches; when several match, cache the list so the LM
            # can pick (need below); when none match, cache an empty list so the driver stops asking.
            if ((Test-FunctionsIntent $State) -and (Test-Provided $State 'input.functionsTemplate') `
                    -and -not (Test-Provided $State 'input.functionsTemplate.templateName') `
                    -and -not ($State['auto'].ContainsKey('functionsTemplateCandidates'))) {
                $fsel = Get-ByPath $State 'input.functionsTemplate'
                $cres = "$($fsel['resource'])"; $clang = "$($fsel['language'])"
                if ($cres -and $clang) {
                    $ciac = Get-FunctionsRecipeIac $State
                    $cands = Get-FunctionsCandidates $State $clang.ToLower() $cres $ciac
                    if ($null -ne $cands) {
                        $arr = @($cands)
                        if ($arr.Count -eq 1) { Set-ByPath $State 'input.functionsTemplate.templateName' $arr[0].templateName }
                        else { Set-ByPath $State 'auto.functionsTemplateCandidates' $arr }
                    }
                }
            }
        }
        needs = {
            param($State)
            $n = @()
            if ((Test-FunctionsIntent $State) -and -not (Test-Provided $State 'input.functionsTemplate')) {
                $n += @{ Path = 'input.functionsTemplate'; Prompt = 'Azure Functions template selection { "resource": <http|timer|cosmos|eventhub|servicebus|blob|sql|mcp|durable|connector>, "language": <CSharp|Python|TypeScript|JavaScript|Java|PowerShell> } — pick from the trigger/binding the app uses; the driver lists and fetches the template' }
            }
            elseif ((Test-FunctionsIntent $State) -and -not (Test-Provided $State 'input.functionsTemplate.templateName') `
                    -and @(Get-ByPath $State 'auto.functionsTemplateCandidates').Count -gt 1) {
                $n += @{ Path = 'input.functionsTemplate.templateName'; Prompt = 'Choose ONE template: set to the templateName of your pick from auto.functionsTemplateCandidates (each entry lists templateName + description). The driver then fetches it.' }
            }
            $n += @{ Path = 'input.researchDone'; Prompt = 'true when component research is complete' }
            $n
        }
    },
    @{
        id = 'generate'; phase = 2; title = 'Generate artifacts'
        refs = @(
            'scripts/references/recipes/azd/README.md',
            'scripts/references/recipes/azcli/README.md',
            'scripts/references/recipes/bicep/README.md',
            'scripts/references/recipes/terraform/README.md'
        )
        dynamicRefs = {
            param($State)
            $r = @()
            # azd deployment quick-reference applies to any azd-based recipe.
            if ((Get-ByPath $State 'input.recipe') -match 'AZD') { $r += 'scripts/references/sdk/azd-deployment.md' }
            # Durable Functions + DTS references when the architecture uses them.
            $r += Get-DurableRefs $State
            # App Configuration SDK reference, per project language, when it's in the architecture.
            if (Test-ArchitectureUsesService $State 'App Configuration') {
                foreach ($c in (Get-SdkLanguageCodes $State 'appconfig')) { $r += "scripts/references/sdk/azure-appconfiguration-$c.md" }
            }
            $r
        }
        auto = {
            param($State)
            # For .NET Aspire, let azd generate azure.yaml + infra/ from the AppHost; otherwise
            # pre-create the deterministic infra/ scaffold + parameter stub so the LM fills
            # templates rather than re-creating boilerplate.
            # For Azure Functions, first fetch the selected template into the repo (or a staging dir).
            if ((Test-FunctionsIntent $State) -and (Test-Provided $State 'input.functionsTemplate') `
                    -and -not ($State['auto'].ContainsKey('functionsTemplate'))) {
                Invoke-FunctionsTemplateFetch $State
            }
            $ft = Get-ByPath $State 'auto.functionsTemplate'
            if ((Get-ByPath $State 'auto.componentSignals.aspire') -eq $true) {
                Initialize-AzdProject $State
            }
            elseif ($ft -is [hashtable] -and $ft['fetched'] -eq $true -and $ft['placement'] -eq 'repo-root') {
                # template extracted into the repo root already carries infra/; skip the recipe scaffold
            }
            else {
                $made = New-RecipeScaffold $State
                Set-ByPath $State 'auto.scaffold' $made
            }
        }
        onDone = {
            param($State)
            # azure.yaml now exists; create/configure the azd environment programmatically
            # (order-safe -- runs after generation, never during planning).
            Apply-AzdEnvironment $State
        }
        needs = @(
            @{ Path = 'input.generateDone'; Prompt = 'true when infrastructure/config artifacts are generated' }
        )
    },
    @{
        id = 'security'; phase = 2; title = 'Harden security'
        refs = @('scripts/references/security.md')
        dynamicRefs = {
            param($State)
            # Surface the Azure Identity quick-reference for each language in the project so the
            # LM wires DefaultAzureCredential / ManagedIdentityCredential correctly per stack.
            $r = @()
            foreach ($c in (Get-SdkLanguageCodes $State 'identity')) { $r += "scripts/references/sdk/azure-identity-$c.md" }
            $r
        }
        needs = @(
            @{ Path = 'input.securityDone'; Prompt = 'true when security hardening is complete' }
        )
    },
    @{
        id = 'functional-verify'; phase = 2; title = 'Functional verification'
        refs = @()
        needs = @(
            @{ Path = 'input.functionalVerifyDone'; Prompt = 'true when functional verification is done' }
        )
    },
    @{
        id = 'handoff'; phase = 2; title = 'Update plan status and hand off (automatic)'
        refs = @()
        needs = @()
        onDone = {
            param($State)
            Set-PlanStatus -Status 'Ready for Validation'
        }
    }
)

