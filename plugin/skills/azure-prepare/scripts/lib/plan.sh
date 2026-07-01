# =============================================================================
# plan.sh — Deployment-plan generation and recipe scaffolding.
# Sourced by prepare.sh; shares globals (STATE, RepoPath, StateFile, FILES, STEP_IDS).
# Not a standalone script.
# =============================================================================


# ---------------------------------------------------------------------------
# Plan file generation (.azure/deployment-plan.md) from collected state
# ---------------------------------------------------------------------------

# Returns the value at a dotted path, or the given fallback (default "_TBD_") when missing/empty.
get_or_tbd() {
    local v
    if v="$(get_by_path "$1")" && [[ -n "$v" ]]; then printf '%s' "$v"; else printf '%s' "${2:-_TBD_}"; fi
}

# Generates (or regenerates) .azure/deployment-plan.md from the collected state and prints its path.
write_deployment_plan() {
    local planDir="$RepoPath/.azure" planFile="$RepoPath/.azure/deployment-plan.md"
    mkdir -p "$planDir"

    local ts goal mode recipe recipeWhy stack sub loc
    ts="$(now_iso)"
    goal="$(get_or_tbd 'input.goal')"
    mode="$(get_or_tbd 'input.mode')"
    recipe="$(get_or_tbd 'input.recipe')"
    recipeWhy="$(get_or_tbd 'input.recipeRationale')"
    stack="$(get_or_tbd 'input.stack')"
    sub="$(printf '%s' "$STATE" | jq -r '.auto.azContext.subscriptionName // .input.subscription // empty')"
    [[ -z "$sub" ]] && sub='_TBD_ — confirm with user'
    loc="$(get_or_tbd 'input.location' '_TBD_ — confirm with user')"

    local classification scale budget compliance
    classification="$(printf '%s' "$STATE" | jq -r '.input.requirements.classification // "_TBD_"')"
    scale="$(printf '%s' "$STATE" | jq -r '.input.requirements.scale // "_TBD_"')"
    budget="$(printf '%s' "$STATE" | jq -r '.input.requirements.budget // "_TBD_"')"
    compliance="$(printf '%s' "$STATE" | jq -r '(.input.requirements.compliance // "") | if . == "" then "_TBD_" else . end')"

    {
        echo '# Azure Deployment Plan'
        echo ''
        echo '> **Status:** Planning | Approved | Executing | Ready for Validation | Validated | Deployed'
        echo ''
        echo "Generated: $ts"
        echo ''
        echo '---'
        echo ''
        echo '## 1. Project Overview'
        echo ''
        echo "**Goal:** $goal"
        echo ''
        echo "**Path:** $mode"
        echo ''
        echo '---'
        echo ''
        echo '## 2. Requirements'
        echo ''
        echo '| Attribute | Value |'
        echo '|-----------|-------|'
        echo "| Classification | $classification |"
        echo "| Scale | $scale |"
        echo "| Budget | $budget |"
        echo "| Compliance | $compliance |"
        echo "| **Subscription** | $sub |"
        echo "| **Location** | $loc |"
        echo ''
        if [[ "$(printf '%s' "$STATE" | jq '((.auto.policyConstraints // .input.policyConstraints) // []) | length')" -gt 0 ]]; then
            echo '### Policy Constraints'
            echo ''
            printf '%s' "$STATE" | jq -r '((.auto.policyConstraints // .input.policyConstraints) // [])[] | "- \(.)"'
            echo ''
        fi
        echo '---'
        echo ''
        echo '## 3. Components Detected'
        echo ''
        echo '| Component | Type | Technology | Path |'
        echo '|-----------|------|------------|------|'
        if [[ "$(printf '%s' "$STATE" | jq '(.input.components // []) | length')" -gt 0 ]]; then
            printf '%s' "$STATE" | jq -r '.input.components[] | "| \(.name) | \(.type) | \(.technology) | \(.path) |"'
        else
            local langStr
            langStr="$(printf '%s' "$STATE" | jq -r '(.auto.detectedLanguages // []) | join(", ")')"
            [[ -z "$langStr" ]] && langStr='_TBD_'
            echo "| _detected_ | _TBD_ | $langStr | . |"
        fi
        echo ''
        echo '---'
        echo ''
        echo '## 4. Recipe Selection'
        echo ''
        echo "**Selected:** $recipe"
        echo ''
        echo "**Rationale:** $recipeWhy"
        echo ''
        echo '---'
        echo ''
        echo '## 5. Architecture'
        echo ''
        echo "**Stack:** $stack"
        echo ''
        echo '### Service Mapping'
        echo ''
        echo '| Component | Azure Service | SKU |'
        echo '|-----------|---------------|-----|'
        if [[ "$(printf '%s' "$STATE" | jq '(.input.architecture // []) | length')" -gt 0 ]]; then
            printf '%s' "$STATE" | jq -r '.input.architecture[] | "| \(.component) | \(.azureService) | \(.sku) |"'
        else
            echo '| _TBD_ | _TBD_ | _TBD_ |'
        fi
        echo ''
        echo '---'
        echo ''
        echo '## 6. Provisioning Limit Checklist'
        echo ''
        if test_provided 'input.quotaChecklistMarkdown'; then
            printf '%s' "$STATE" | jq -r '.input.quotaChecklistMarkdown'
        else
            echo '_Populate via the quota step (invoke azure-quotas). No "_TBD_" entries allowed before user presentation._'
        fi
        echo ''
        echo '---'
        echo ''
        echo '## 7. Execution Checklist'
        echo ''
        echo '### Phase 1: Planning'
        echo '- [ ] Analyze workspace'
        echo '- [ ] Gather requirements'
        echo '- [ ] Confirm subscription and location with user'
        echo '- [ ] Scan codebase'
        echo '- [ ] Select recipe'
        echo '- [ ] Plan architecture'
        echo '- [ ] Validate provisioning limits'
        echo '- [ ] **User approved this plan**'
        echo ''
        echo '### Phase 2: Execution'
        echo '- [ ] Research components'
        echo '- [ ] Generate infrastructure and configuration'
        echo '- [ ] Harden security'
        echo '- [ ] Functional verification'
        echo '- [ ] **Update plan status to "Ready for Validation"**'
        echo ''
        echo '### Phase 3: Validation'
        echo '- [ ] Invoke azure-validate skill'
        echo ''
        echo '### Phase 4: Deployment'
        echo '- [ ] Invoke azure-deploy skill'
        echo ''
    } >"$planFile"

    printf '%s' "$planFile"
}

# Rewrites the Status line in the existing deployment-plan.md to the given status (no-op if the plan is missing).
set_plan_status() {
    local status="$1" planFile="$RepoPath/.azure/deployment-plan.md" tmp
    [[ -f "$planFile" ]] || return 0
    tmp="$(mktemp)"
    sed "s/^> \*\*Status:\*\*.*\$/> **Status:** $status/" "$planFile" >"$tmp" && mv "$tmp" "$planFile"
}

# Deterministically creates the ./infra tree and writes the standard IaC parameter stub
# for the selected recipe (main.parameters.json for Bicep, main.tfvars.json for
# azd+Terraform). Idempotent: never overwrites existing files, skips .NET Aspire, and
# prints the list of created paths (one per line).
new_recipe_scaffold() {
    local recipe aspire infra modules paramFile tfvars
    recipe="$(get_by_path 'input.recipe')" || return 0
    [[ -n "$recipe" ]] || return 0
    aspire="$(printf '%s' "$STATE" | jq -r '.auto.componentSignals.aspire // false')"
    [[ "$aspire" == true ]] && return 0

    local created=()
    infra="$RepoPath/infra"
    modules="$infra/modules"
    [[ -d "$infra" ]] || { mkdir -p "$infra"; created+=('infra/'); }
    [[ -d "$modules" ]] || { mkdir -p "$modules"; created+=('infra/modules/'); }

    # Bicep-based recipes share the same ARM-JSON parameters stub.
    if [[ "$recipe" == *Bicep* || "$recipe" == 'AZCLI' ]]; then
        paramFile="$infra/main.parameters.json"
        if [[ ! -f "$paramFile" ]]; then
            cat >"$paramFile" <<'JSON'
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "environmentName": { "value": "${AZURE_ENV_NAME}" },
    "location": { "value": "${AZURE_LOCATION}" }
  }
}
JSON
            created+=('infra/main.parameters.json')
        fi
    # azd+Terraform uses a ${VAR}-substituted tfvars file that azd resolves via envsubst.
    elif [[ "$recipe" == 'AZD (Terraform)' ]]; then
        tfvars="$infra/main.tfvars.json"
        if [[ ! -f "$tfvars" ]]; then
            cat >"$tfvars" <<'JSON'
{
  "environment_name": "${AZURE_ENV_NAME}",
  "location": "${AZURE_LOCATION}",
  "subscription_id": "${AZURE_SUBSCRIPTION_ID}"
}
JSON
            created+=('infra/main.tfvars.json')
        fi
    fi

    (( ${#created[@]} )) && printf '%s\n' "${created[@]}"
    return 0
}
