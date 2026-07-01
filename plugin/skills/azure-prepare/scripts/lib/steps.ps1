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
            @{ Path = 'input.location'; Prompt = 'Confirmed Azure region' },
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
        refs = @('scripts/references/resources-limits-quotas.md', 'scripts/references/plan-template.md')
        needs = @(
            @{ Path = 'input.quotaChecklistMarkdown'; Prompt = 'Completed provisioning-limit checklist as markdown (no _TBD_ entries)' }
        )
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
            Get-ServiceReadmeRefs $State
        }
        needs = @(
            @{ Path = 'input.researchDone'; Prompt = 'true when component research is complete' }
        )
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
            # App Configuration SDK reference, per project language, when it's in the architecture.
            if (Test-ArchitectureUsesService $State 'App Configuration') {
                foreach ($c in (Get-SdkLanguageCodes $State 'appconfig')) { $r += "scripts/references/sdk/azure-appconfiguration-$c.md" }
            }
            $r
        }
        auto = {
            param($State)
            # Pre-create the deterministic infra/ scaffold + parameter stub so the LM fills
            # templates rather than re-creating boilerplate; records what it made in auto.scaffold.
            $made = New-RecipeScaffold $State
            Set-ByPath $State 'auto.scaffold' $made
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

