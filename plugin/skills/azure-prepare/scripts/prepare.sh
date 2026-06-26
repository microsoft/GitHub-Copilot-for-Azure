#!/usr/bin/env bash
# =============================================================================
# State-machine driver for the azure-prepare skill (Bash port of prepare.ps1).
#
# Drives the "prepare an app for Azure deployment" workflow as a deterministic
# state machine. The script owns <RepoPath>/.azure-prepare/prepare-info.json and
# advances the workflow as far as it can PROGRAMMATICALLY on each invocation.
# When it needs information only the language model (LM) can provide, it writes
# null placeholder keys under `input.*`, prints a NEXT ACTION block describing
# exactly what to collect, and exits. The LM fills the keys and re-runs the
# script. The cycle repeats until the script prints a COMPLETE block.
#
# Usage:
#     bash ./prepare.sh <RepoPath>
# =============================================================================
set -o pipefail

# ---------------------------------------------------------------------------
# Argument parsing and paths
# ---------------------------------------------------------------------------
if [[ $# -lt 1 || -z "${1:-}" ]]; then
    echo "Usage: prepare.sh <RepoPath>" >&2
    exit 2
fi
RepoPath="$1"
if [[ ! -d "$RepoPath" ]]; then
    echo "RepoPath does not exist: $RepoPath" >&2
    exit 1
fi
if ! command -v jq >/dev/null 2>&1; then
    echo "prepare.sh requires the 'jq' command-line JSON processor." >&2
    exit 1
fi
RepoPath="$(cd "$RepoPath" && pwd)"
StateDir="$RepoPath/.azure-prepare"
StateFile="$StateDir/prepare-info.json"
SchemaVersion=1

# STATE holds the entire JSON state document in memory between get/set helpers.
STATE='{}'

# ---------------------------------------------------------------------------
# Small utilities
# ---------------------------------------------------------------------------

# Emits a UTC timestamp used for the created/updated/scanned fields in state.
now_iso() { date -u +%Y-%m-%dT%H:%M:%SZ; }

# Converts a dotted path (e.g. "input.mode") into a jq index filter like .["input"]["mode"].
path_filter() {
    local IFS='.' s f="."
    local segs; read -ra segs <<<"$1"
    for s in "${segs[@]}"; do f+="[\"$s\"]"; done
    printf '%s' "$f"
}

# Converts a dotted path into a JSON array of segments for use with jq's setpath().
path_array() {
    local IFS='.' s out=""
    local segs; read -ra segs <<<"$1"
    for s in "${segs[@]}"; do out+="\"$s\","; done
    printf '[%s]' "${out%,}"
}

# Returns true if the given value is present in the remaining arguments (array membership test).
in_list() { local needle="$1"; shift; local x; for x in "$@"; do [[ "$x" == "$needle" ]] && return 0; done; return 1; }

# ---------------------------------------------------------------------------
# Nested get/set helpers (dotted paths into the state document)
# ---------------------------------------------------------------------------

# Returns the value at a dotted path within STATE (raw scalar / compact JSON), or non-zero if missing/null.
get_by_path() {
    local f v
    f="$(path_filter "$1")"
    v="$(printf '%s' "$STATE" | jq -r "$f // empty" 2>/dev/null)"
    [[ -z "$v" ]] && return 1
    printf '%s' "$v"
}

# Sets the value at a dotted path within STATE to the given JSON value, creating intermediate objects as needed.
set_by_path() {
    local p
    p="$(path_array "$1")"
    STATE="$(printf '%s' "$STATE" | jq --argjson v "$2" --argjson p "$p" 'setpath($p; $v)')"
}

# Sets the value at a dotted path to a JSON string (encodes the given text safely).
set_str() { local j; j="$(jq -n --arg s "$2" '$s')"; set_by_path "$1" "$j"; }

# Sets the value at a dotted path to JSON null (the placeholder the LM must fill).
set_null() { set_by_path "$1" 'null'; }

# A need is "provided" when the key exists and is not null and not an empty/whitespace string.
test_provided() {
    local f t s
    f="$(path_filter "$1")"
    t="$(printf '%s' "$STATE" | jq -r "($f) | type" 2>/dev/null)"
    [[ -z "$t" || "$t" == "null" ]] && return 1
    if [[ "$t" == "string" ]]; then
        s="$(printf '%s' "$STATE" | jq -r "$f" 2>/dev/null)"
        [[ -z "${s//[[:space:]]/}" ]] && return 1
    fi
    return 0
}

# ---------------------------------------------------------------------------
# State load / save
# ---------------------------------------------------------------------------

# Builds a fresh, empty state object for a repo that has no prepare-info.json yet.
new_state() {
    jq -n --arg rp "$RepoPath" --arg ts "$(now_iso)" --argjson sv "$SchemaVersion" \
        '{schemaVersion:$sv, repoPath:$rp, createdAtUtc:$ts, updatedAtUtc:$ts, auto:{}, steps:{}, input:{}}'
}

# Loads the existing state file (ensuring core keys exist), or creates the state directory and a new state object.
get_state() {
    if [[ -f "$StateFile" ]]; then
        STATE="$(jq '.auto = (.auto // {}) | .steps = (.steps // {}) | .input = (.input // {})' "$StateFile")"
    else
        mkdir -p "$StateDir"
        STATE="$(new_state)"
    fi
}

# Stamps the updated timestamp and writes the state object back to prepare-info.json as JSON.
save_state() {
    STATE="$(printf '%s' "$STATE" | jq --arg t "$(now_iso)" '.updatedAtUtc = $t')"
    mkdir -p "$StateDir"
    printf '%s\n' "$STATE" | jq '.' >"$StateFile"
}

# ---------------------------------------------------------------------------
# Programmatic collectors (idempotent; run every invocation)
# ---------------------------------------------------------------------------

# Top-level + shallow file scan into the global FILES (newline-separated paths), excluding noise directories.
get_repo_files() {
    FILES="$(find "$RepoPath" -maxdepth 4 \
        \( -name .git -o -name .azure-prepare -o -name node_modules -o -name bin -o -name obj -o -name .venv -o -name dist -o -name .terraform \) -prune \
        -o -type f -print 2>/dev/null)"
}

# Returns 0 if any scanned file's basename matches the given shell glob pattern.
has_file_glob() {
    local pat="$1" f b
    while IFS= read -r f; do
        [[ -n "$f" ]] || continue
        b="${f##*/}"
        # shellcheck disable=SC2254
        case "$b" in $pat) return 0 ;; esac
    done < <(printf '%s\n' "$FILES")
    return 1
}

# Returns the full path of the first scanned file whose path ends with the given suffix regex.
first_file_matching() { printf '%s\n' "$FILES" | grep -m1 -E "$1" || true; }

# Scans the repo and refreshes the state's `auto.*` block (languages, frameworks, existing infra, markers, git, Azure context).
invoke_auto_collect() {
    get_repo_files

    local file_count
    file_count="$(printf '%s\n' "$FILES" | grep -c . )"

    # --- languages ---
    local langs=()
    has_file_glob 'package.json' && langs+=(nodejs)
    { has_file_glob '*.csproj' || has_file_glob '*.sln'; } && langs+=(dotnet)
    { has_file_glob 'requirements.txt' || has_file_glob 'pyproject.toml' || has_file_glob 'setup.py'; } && langs+=(python)
    { has_file_glob 'pom.xml' || has_file_glob 'build.gradle'; } && langs+=(java)
    has_file_glob 'go.mod' && langs+=(go)
    has_file_glob 'Cargo.toml' && langs+=(rust)

    # --- frameworks (best-effort from package.json / python files) ---
    local frameworks=() copilot_sdk=false
    local pkg deps fw
    pkg="$(first_file_matching '/package\.json$')"
    if [[ -n "$pkg" && -f "$pkg" ]]; then
        deps="$(jq -r '((.dependencies // {}) + (.devDependencies // {})) | keys[]?' "$pkg" 2>/dev/null)"
        for fw in react next express fastify '@angular/core' vue svelte nestjs '@nestjs/core'; do
            grep -qxF "$fw" <<<"$deps" && frameworks+=("$fw")
        done
        grep -qxF '@github/copilot-sdk' <<<"$deps" && copilot_sdk=true
    fi
    local rf f
    for rf in 'requirements.txt' 'pyproject.toml'; do
        f="$(first_file_matching "/$rf\$")"
        [[ -n "$f" && -f "$f" ]] || continue
        for fw in flask django fastapi uvicorn gunicorn; do
            if grep -qiE "^[[:space:]]*$fw\b" "$f" && ! in_list "$fw" "${frameworks[@]:-}"; then
                frameworks+=("$fw")
            fi
        done
    done

    # --- existing infrastructure ---
    local azure_yaml=false bicep=false terraform=false dockerfile=false gha=false azpipe=false provider=null
    { has_file_glob 'azure.yaml' || has_file_glob 'azure.yml'; } && azure_yaml=true
    has_file_glob '*.bicep' && bicep=true
    has_file_glob '*.tf' && terraform=true
    has_file_glob 'Dockerfile*' && dockerfile=true
    grep -qE '/\.github/workflows/' <<<"$FILES" && gha=true
    has_file_glob 'azure-pipelines.yml' && azpipe=true

    # --- azure.yaml IaC provider (terraform vs bicep/default) ---
    local ayfile
    ayfile="$(first_file_matching '/azure\.ya?ml$')"
    if [[ -n "$ayfile" && -f "$ayfile" ]]; then
        if grep -qiE 'provider[[:space:]]*:[[:space:]]*terraform' "$ayfile"; then provider='"terraform"'; else provider='"bicep"'; fi
    fi

    # --- .NET Aspire detection (AppHost project or Aspire.Hosting reference) ---
    local aspire=false csproj
    has_file_glob '*.AppHost.csproj' && aspire=true
    if [[ "$aspire" == false ]]; then
        while IFS= read -r csproj; do
            [[ -n "$csproj" && -f "$csproj" ]] || continue
            if grep -q 'Aspire\.Hosting' "$csproj"; then aspire=true; break; fi
        done < <(printf '%s\n' "$FILES" | grep -iE '\.csproj$')
    fi

    # --- Azure Functions detection (host.json, SDK dependency, or WebJobs reference) ---
    local azure_functions=false
    has_file_glob 'host.json' && azure_functions=true
    if [[ "$azure_functions" == false && -n "$pkg" && -f "$pkg" ]]; then
        grep -qE '@azure/functions|azure-functions' "$pkg" && azure_functions=true
    fi
    if [[ "$azure_functions" == false ]]; then
        while IFS= read -r csproj; do
            [[ -n "$csproj" && -f "$csproj" ]] || continue
            if grep -qE 'Microsoft\.Azure\.(Functions|WebJobs)' "$csproj"; then azure_functions=true; break; fi
        done < <(printf '%s\n' "$FILES" | grep -iE '\.csproj$')
    fi

    # --- pure static site detection (HTML/assets only, no build tooling or framework) ---
    local has_html=false pure_static=false
    { has_file_glob '*.html' || has_file_glob '*.htm'; } && has_html=true
    if [[ "$has_html" == true && ${#langs[@]} -eq 0 && ${#frameworks[@]} -eq 0 ]]; then pure_static=true; fi

    # --- workspace emptiness ---
    local workspace_empty=false
    [[ "$file_count" -eq 0 ]] && workspace_empty=true

    # --- existing plan ---
    local existing_plan=false
    [[ -f "$RepoPath/.azure/deployment-plan.md" ]] && existing_plan=true

    # --- git ---
    local git_root=null
    [[ -d "$RepoPath/.git" ]] && git_root="$(jq -n --arg p "$RepoPath" '$p')"

    # --- assemble JSON fragments ---
    local langs_json fw_json
    langs_json="$(json_string_array "${langs[@]:-}")"
    fw_json="$(json_string_array "${frameworks[@]:-}")"

    local existing_infra
    existing_infra="$(jq -n \
        --argjson azureYaml "$azure_yaml" --argjson bicep "$bicep" --argjson terraform "$terraform" \
        --argjson dockerfile "$dockerfile" --argjson githubActions "$gha" --argjson azurePipelines "$azpipe" \
        --argjson azureYamlProvider "$provider" \
        '{azureYaml:$azureYaml, bicep:$bicep, terraform:$terraform, dockerfile:$dockerfile, githubActions:$githubActions, azurePipelines:$azurePipelines, azureYamlProvider:$azureYamlProvider}')"

    local comp_signals markers az_ctx azd_ctx auto
    comp_signals="$(jq -n --argjson aspire "$aspire" --argjson azureFunctions "$azure_functions" --argjson pureStaticSite "$pure_static" \
        '{aspire:$aspire, azureFunctions:$azureFunctions, pureStaticSite:$pureStaticSite}')"
    markers="$(jq -n --argjson copilotSdk "$copilot_sdk" '{copilotSdk:$copilotSdk}')"
    az_ctx="$(get_az_context)"
    azd_ctx="$(get_azd_context)"

    auto="$(jq -n \
        --arg scannedAtUtc "$(now_iso)" \
        --argjson fileCount "$file_count" \
        --argjson workspaceEmpty "$workspace_empty" \
        --argjson detectedLanguages "$langs_json" \
        --argjson detectedFrameworks "$fw_json" \
        --argjson existingInfra "$existing_infra" \
        --argjson componentSignals "$comp_signals" \
        --argjson codebaseMarkers "$markers" \
        --argjson gitRoot "$git_root" \
        --argjson existingPlan "$existing_plan" \
        --argjson azContext "$az_ctx" \
        --argjson azdContext "$azd_ctx" \
        '{scannedAtUtc:$scannedAtUtc, fileCount:$fileCount, workspaceEmpty:$workspaceEmpty, detectedLanguages:$detectedLanguages, detectedFrameworks:$detectedFrameworks, existingInfra:$existingInfra, componentSignals:$componentSignals, codebaseMarkers:$codebaseMarkers, gitRoot:$gitRoot, existingPlan:$existingPlan, azContext:$azContext, azdContext:$azdContext}')"

    STATE="$(printf '%s' "$STATE" | jq --argjson a "$auto" '.auto = $a')"
}

# Builds a compact JSON array of (deduped) strings from the given shell arguments.
json_string_array() {
    if [[ $# -eq 0 || ( $# -eq 1 && -z "$1" ) ]]; then printf '[]'; return; fi
    printf '%s\n' "$@" | jq -R . | jq -s -c 'map(select(length > 0)) | unique_by(.) as $u | reduce .[] as $x ([]; if any(.[]; . == $x) then . else . + [$x] end)'
}

# Best-effort read of azd's configured defaults and current environment values (subscription/location), or an "unavailable" result if azd is missing.
get_azd_context() {
    local res sub=null loc=null envname=null envsub=null envloc=null def vals
    res='{"available":false,"defaults":{"subscription":null,"location":null},"env":{"name":null,"subscriptionId":null,"location":null}}'
    command -v azd >/dev/null 2>&1 || { printf '%s' "$res"; return; }
    def="$(cd "$RepoPath" && azd config get defaults -o json 2>/dev/null)"
    if [[ -n "$def" ]] && jq -e . >/dev/null 2>&1 <<<"$def"; then
        sub="$(jq -c '.subscription // null' <<<"$def")"
        loc="$(jq -c '.location // null' <<<"$def")"
    fi
    if [[ -f "$RepoPath/azure.yaml" || -f "$RepoPath/azure.yml" ]]; then
        vals="$(cd "$RepoPath" && azd env get-values -o json 2>/dev/null)"
        if [[ -n "$vals" ]] && jq -e . >/dev/null 2>&1 <<<"$vals"; then
            envsub="$(jq -c '.AZURE_SUBSCRIPTION_ID // null' <<<"$vals")"
            envloc="$(jq -c '.AZURE_LOCATION // null' <<<"$vals")"
            envname="$(jq -c '.AZURE_ENV_NAME // null' <<<"$vals")"
        fi
    fi
    jq -n --argjson sub "$sub" --argjson loc "$loc" --argjson en "$envname" --argjson es "$envsub" --argjson el "$envloc" \
        '{available:true, defaults:{subscription:$sub, location:$loc}, env:{name:$en, subscriptionId:$es, location:$el}}'
}

# Returns the signed-in Azure subscription/tenant from `az account show`, or an "unavailable" result if the CLI is missing or not logged in.
get_az_context() {
    local res out
    res='{"available":false,"subscriptionId":null,"subscriptionName":null,"tenantId":null}'
    command -v az >/dev/null 2>&1 || { printf '%s' "$res"; return; }
    out="$(az account show -o json 2>/dev/null)"
    if [[ -n "$out" ]] && jq -e . >/dev/null 2>&1 <<<"$out"; then
        jq -c '{available:true, subscriptionId:.id, subscriptionName:.name, tenantId:.tenantId}' <<<"$out"
    else
        printf '%s' "$res"
    fi
}

# ---------------------------------------------------------------------------
# Proposed mode/recipe from programmatic signals (LM confirms)
# ---------------------------------------------------------------------------

# Proposes a workspace mode (NEW / MODIFY / MODERNIZE) from the auto-detected signals; the LM confirms it later.
get_proposed_mode() {
    local empty ay bi tf
    empty="$(printf '%s' "$STATE" | jq -r '.auto.workspaceEmpty // false')"
    [[ "$empty" == true ]] && { printf 'NEW'; return; }
    ay="$(printf '%s' "$STATE" | jq -r '.auto.existingInfra.azureYaml // false')"
    bi="$(printf '%s' "$STATE" | jq -r '.auto.existingInfra.bicep // false')"
    tf="$(printf '%s' "$STATE" | jq -r '.auto.existingInfra.terraform // false')"
    if [[ "$ay" == true || "$bi" == true || "$tf" == true ]]; then printf 'MODIFY'; return; fi
    printf 'MODERNIZE'
}

# Proposes an IaC recipe from the auto-detected signals (Aspire, azure.yaml provider, *.tf, *.bicep); the LM confirms it later.
get_proposed_recipe() {
    local aspire ay prov tf bi
    aspire="$(printf '%s' "$STATE" | jq -r '.auto.componentSignals.aspire // false')"
    [[ "$aspire" == true ]] && { printf 'AZD (Aspire, via azd init --from-code)'; return; }
    ay="$(printf '%s' "$STATE" | jq -r '.auto.existingInfra.azureYaml // false')"
    prov="$(printf '%s' "$STATE" | jq -r '.auto.existingInfra.azureYamlProvider // empty')"
    tf="$(printf '%s' "$STATE" | jq -r '.auto.existingInfra.terraform // false')"
    bi="$(printf '%s' "$STATE" | jq -r '.auto.existingInfra.bicep // false')"
    if [[ "$ay" == true ]]; then
        if [[ "$prov" == terraform ]]; then printf 'AZD (Terraform)'; else printf 'AZD (Bicep)'; fi
        return
    fi
    [[ "$tf" == true ]] && { printf 'AZD (Terraform)'; return; }
    [[ "$bi" == true ]] && { printf 'Bicep'; return; }
    printf 'AZD (Bicep)'
}

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
        if [[ "$(printf '%s' "$STATE" | jq '(.input.policyConstraints // []) | length')" -gt 0 ]]; then
            echo '### Policy Constraints'
            echo ''
            printf '%s' "$STATE" | jq -r '.input.policyConstraints[] | "- \(.)"'
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

# ---------------------------------------------------------------------------
# SDK / service reference helpers
# ---------------------------------------------------------------------------

# Maps the project's languages (auto-detected files + LM-provided component technologies)
# to Azure SDK quick-reference language codes (nodejs/js/ts -> ts, python -> py, etc.).
# $1 (Kind) filters to codes that actually have a reference file for that SDK family
# (App Configuration has no .NET quick-reference, so 'dotnet' is dropped for appconfig).
get_sdk_language_codes() {
    local kind="${1:-identity}" available codes=() l t tl
    if [[ "$kind" == 'appconfig' ]]; then available="py ts java"; else available="py dotnet ts java"; fi

    # Adds a code when it is available for this kind and not already collected.
    _add_code() {
        local c="$1"
        [[ " $available " == *" $c "* ]] || return 0
        in_list "$c" "${codes[@]:-}" && return 0
        codes+=("$c")
    }

    while IFS= read -r l; do
        [[ -n "$l" ]] || continue
        case "$l" in
            nodejs) _add_code ts ;;
            python) _add_code py ;;
            dotnet) _add_code dotnet ;;
            java)   _add_code java ;;
        esac
    done < <(printf '%s' "$STATE" | jq -r '(.auto.detectedLanguages // [])[]')

    local re_net='dotnet|c#|csharp|asp|\.net'
    while IFS= read -r t; do
        tl="${t,,}"
        [[ "$tl" =~ (node|javascript|typescript|(^|[^a-z])(ts|js)($|[^a-z])) ]] && _add_code ts
        [[ "$tl" =~ (python|(^|[^a-z])py($|[^a-z])|flask|django|fastapi) ]] && _add_code py
        [[ "$tl" =~ $re_net ]] && _add_code dotnet
        [[ "$tl" =~ (java|spring) ]] && _add_code java
    done < <(printf '%s' "$STATE" | jq -r '(.input.components // [])[] | .technology // ""')

    (( ${#codes[@]} )) && printf '%s\n' "${codes[@]}"
    return 0
}

# Returns 0 if any service named in the LM-provided architecture matches the given name regex.
test_architecture_uses_service() {
    local pattern="$1" svc
    while IFS= read -r svc; do
        [[ "$svc" =~ $pattern ]] && return 0
    done < <(printf '%s' "$STATE" | jq -r '(.input.architecture // [])[] | .azureService // ""')
    return 1
}

# Maps each Azure service named in the LM-provided architecture to its reference README
# under scripts/references/services/, so the research step can name the exact files to
# read instead of a <service> placeholder. Prints a deduped list of README paths.
get_service_readme_refs() {
    local svc_pat=(
        'container app' 'app service' 'static web' 'aks|kubernetes' 'cosmos' 'sql'
        'key vault' 'service bus' 'event grid' 'logic app' 'storage|blob'
        'application insights|app insights' 'openai|foundry|cognitive' 'durable' 'function'
    )
    local svc_dir=(
        container-apps app-service static-web-apps aks cosmos-db sql-database
        key-vault service-bus event-grid logic-apps storage
        app-insights foundry durable-task-scheduler functions
    )
    local dirs=() svc i
    while IFS= read -r svc; do
        svc="${svc,,}"
        for i in "${!svc_pat[@]}"; do
            if [[ "$svc" =~ ${svc_pat[$i]} ]]; then
                in_list "${svc_dir[$i]}" "${dirs[@]:-}" || dirs+=("${svc_dir[$i]}")
            fi
        done
    done < <(printf '%s' "$STATE" | jq -r '(.input.architecture // [])[] | .azureService // ""')
    local d
    for d in "${dirs[@]:-}"; do
        [[ -n "$d" ]] && printf 'scripts/references/services/%s/README.md\n' "$d"
    done
}

# ---------------------------------------------------------------------------
# Step definitions (ordered).
#   STEP_IDS         ordered list of step ids (also keys under state.steps)
#   step_phase       1 (planning) or 2 (execution)
#   step_title       short human title
#   step_gate        "true" if this step is a user-approval gate
#   step_refs        reference files the LM should read for detail
#   step_dynrefs     extra ref paths computed from detected languages / chosen architecture
#   step_needs       lines of "<path>\t<prompt>" — LM-provided fields
#   step_auto        fills fields / may satisfy needs programmatically
#   step_ondone      run once when the step completes
#   step_guidance    instruction text shown to the LM when the step needs LM input
# ---------------------------------------------------------------------------
STEP_IDS=(
    specialized-check analyze requirements scan recipe architecture azure-context
    quota finalize-plan approval research generate security functional-verify handoff
)

# Returns the phase number (1 or 2) for the given step id.
step_phase() {
    case "$1" in
        specialized-check|analyze|requirements|scan|recipe|architecture|azure-context|quota|finalize-plan|approval) echo 1 ;;
        *) echo 2 ;;
    esac
}

# Returns the short human title for the given step id.
step_title() {
    case "$1" in
        specialized-check) echo 'Specialized technology check' ;;
        analyze) echo 'Analyze workspace (NEW / MODIFY / MODERNIZE)' ;;
        requirements) echo 'Gather requirements' ;;
        scan) echo 'Scan codebase' ;;
        recipe) echo 'Select recipe' ;;
        architecture) echo 'Plan architecture' ;;
        azure-context) echo 'Confirm Azure subscription and location' ;;
        quota) echo 'Validate provisioning limits' ;;
        finalize-plan) echo 'Generate deployment plan (automatic)' ;;
        approval) echo 'Present plan and get approval' ;;
        research) echo 'Research components' ;;
        generate) echo 'Generate artifacts' ;;
        security) echo 'Harden security' ;;
        functional-verify) echo 'Functional verification' ;;
        handoff) echo 'Update plan status and hand off (automatic)' ;;
    esac
}

# Echoes "true" when the given step is a user-approval gate.
step_gate() { case "$1" in approval) echo true ;; *) echo false ;; esac; }

# Prints the static reference paths (one per line) for the given step id.
step_refs() {
    case "$1" in
        recipe|generate)
            printf '%s\n' \
                'scripts/references/recipes/azd/README.md' \
                'scripts/references/recipes/azcli/README.md' \
                'scripts/references/recipes/bicep/README.md' \
                'scripts/references/recipes/terraform/README.md'
            ;;
        azure-context|research) printf '%s\n' 'scripts/references/region-availability.md' ;;
        quota) printf '%s\n' 'scripts/references/resources-limits-quotas.md' 'scripts/references/plan-template.md' ;;
        security) printf '%s\n' 'scripts/references/security.md' ;;
    esac
}

# Prints extra, dynamically-computed reference paths for the given step id.
step_dynrefs() {
    local recipe c
    case "$1" in
        research)
            get_service_readme_refs
            ;;
        generate)
            recipe="$(get_by_path 'input.recipe')" || recipe=''
            [[ "$recipe" == *AZD* ]] && echo 'scripts/references/sdk/azd-deployment.md'
            if test_architecture_uses_service 'App Configuration'; then
                while IFS= read -r c; do [[ -n "$c" ]] && echo "scripts/references/sdk/azure-appconfiguration-$c.md"; done < <(get_sdk_language_codes appconfig)
            fi
            ;;
        security)
            while IFS= read -r c; do [[ -n "$c" ]] && echo "scripts/references/sdk/azure-identity-$c.md"; done < <(get_sdk_language_codes identity)
            ;;
    esac
}

# Prints the LM-provided needs (lines of "<path>\t<prompt>") for the given step id.
step_needs() {
    case "$1" in
        specialized-check)
            printf 'input.specializedRouting\t%s\n' 'Routing decision object: { matched, skill, notes }' ;;
        analyze)
            printf 'input.mode\t%s\n' 'Workspace mode: NEW | MODIFY | MODERNIZE (proposed value is in auto.proposedMode)'
            printf 'input.goal\t%s\n' 'One-line goal of the project' ;;
        requirements)
            printf 'input.requirements\t%s\n' 'Requirements object: { classification, scale, budget, compliance }' ;;
        scan)
            printf 'input.components\t%s\n' 'Array of components: { name, type, technology, path, dependsOn }' ;;
        recipe)
            printf 'input.recipe\t%s\n' 'Recipe: AZD (Bicep) | AZD (Terraform) | AZCLI | Bicep | Terraform (see auto.suggestedRecipe)'
            printf 'input.recipeRationale\t%s\n' 'Why this recipe' ;;
        architecture)
            printf 'input.stack\t%s\n' 'Stack: Containers | Serverless | App Service'
            printf 'input.architecture\t%s\n' 'Array of mappings: { component, azureService, sku, rationale }' ;;
        azure-context)
            printf 'input.subscription\t%s\n' 'Confirmed subscription name or id (auto.azContext has the detected one)'
            printf 'input.location\t%s\n' 'Confirmed Azure region'
            printf 'input.azdEnvName\t%s\n' 'azd environment name applied with subscription/location ("n/a" for non-azd recipes)'
            printf 'input.policyConstraints\t%s\n' 'Array of policy constraint strings (empty array if none found)' ;;
        quota)
            printf 'input.quotaChecklistMarkdown\t%s\n' 'Completed provisioning-limit checklist as markdown (no _TBD_ entries)' ;;
        approval)
            printf 'input.userApproved\t%s\n' 'true when the user has approved the plan' ;;
        research)
            printf 'input.researchDone\t%s\n' 'true when component research is complete' ;;
        generate)
            printf 'input.generateDone\t%s\n' 'true when infrastructure/config artifacts are generated' ;;
        security)
            printf 'input.securityDone\t%s\n' 'true when security hardening is complete' ;;
        functional-verify)
            printf 'input.functionalVerifyDone\t%s\n' 'true when functional verification is done' ;;
    esac
}

# Runs the given step's programmatic auto-collector (may satisfy needs without LM input).
step_auto() {
    local made scaffold_json
    case "$1" in
        analyze)
            set_str 'auto.proposedMode' "$(get_proposed_mode)" ;;
        recipe)
            # Compute a suggested recipe from programmatic signals so the LM can confirm rather than derive it.
            set_str 'auto.suggestedRecipe' "$(get_proposed_recipe)" ;;
        azure-context)
            # Prefill the suggested subscription from azd env, then azd defaults, then az account, when the LM has not chosen one.
            if ! test_provided 'input.subscription'; then
                local suggest avail
                suggest=''
                avail="$(printf '%s' "$STATE" | jq -r '.auto.azdContext.available // false')"
                if [[ "$avail" == true ]]; then
                    suggest="$(printf '%s' "$STATE" | jq -r '.auto.azdContext.env.subscriptionId // .auto.azdContext.defaults.subscription // empty')"
                fi
                if [[ -z "$suggest" ]]; then
                    avail="$(printf '%s' "$STATE" | jq -r '.auto.azContext.available // false')"
                    [[ "$avail" == true ]] && suggest="$(printf '%s' "$STATE" | jq -r '.auto.azContext.subscriptionName // .auto.azContext.subscriptionId // empty')"
                fi
                [[ -n "$suggest" ]] && set_str 'auto.suggestedSubscription' "$suggest"
            fi
            ;;
        generate)
            # Pre-create the deterministic infra/ scaffold + parameter stub so the LM fills
            # templates rather than re-creating boilerplate; records what it made in auto.scaffold.
            made="$(new_recipe_scaffold)"
            scaffold_json="$(printf '%s\n' "$made" | jq -R . | jq -s -c 'map(select(length > 0))')"
            set_by_path 'auto.scaffold' "$scaffold_json"
            ;;
    esac
}

# Runs the given step's one-time completion hook (e.g. generate the plan, update its status).
step_ondone() {
    local path
    case "$1" in
        finalize-plan)
            path="$(write_deployment_plan)"
            set_str 'auto.planFile' "$path" ;;
        approval)
            set_plan_status 'Approved' ;;
        handoff)
            set_plan_status 'Ready for Validation' ;;
    esac
}

# Prints the LM instruction text (guidance) for the given step id.
step_guidance() {
    case "$1" in
    specialized-check) cat <<'EOG'
MANDATORY before any planning: decide whether a specialized skill should handle this
request FIRST. Check the user's PROMPT TEXT, not just existing code — critical for
greenfield projects with no codebase. Codebase markers already scanned by the script
are in `auto.codebaseMarkers`.

Routing table — check TOP TO BOTTOM, first match wins:
1. (HIGHEST) Python + Azure App Service AND NOT any of: Terraform, Bicep, IaC, VNet,
   private endpoint, Key Vault, Cosmos, Postgres, MySQL, SQL, Front Door,
   multi-environment, Lambda, migrate from AWS/GCP, Fargate, Cloud Run, ECS, EKS, GKE
   (e.g. "deploy Python to App Service", "Flask on App Service")
     -> invoke **python-appservice-deploy** (code-only deploy; do NOT resume here).
   If ANY of those IaC/infra/migration keywords are present, SKIP this row.
2. Lambda / AWS Lambda / migrate from AWS or GCP / Lambda to Functions / Fargate /
   Cloud Run / ECS / EKS / GKE  (wins even if Azure Functions also mentioned)
     -> invoke **azure-cloud-migrate** (does assessment + code conversion, then
        re-run this script for infrastructure).
3. copilot SDK / copilot app / @github/copilot-sdk / CopilotClient / sendAndWait /
   copilot-sdk-service
     -> invoke **azure-hosted-copilot-sdk**, then resume by re-running this script.
4. Azure Functions / function app / serverless / timer|HTTP|queue trigger / func new
     -> STAY here; prefer Azure Functions templates at architecture/generate.
5. (LOWEST) workflow / orchestration / multi-step / pipeline / fan-out-fan-in / saga /
   long-running process / durable / order processing
     -> STAY here; select the **durable** recipe. You MUST load the durable + DTS
        references (scripts/references/services/functions/durable.md, scripts/references/services/durable-task-scheduler/
        README.md, scripts/references/services/durable-task-scheduler/bicep.md) at architecture/generate.

Re-entry guard: if this run is a RESUME from a specialized skill that already executed
(e.g. azure-hosted-copilot-sdk handing back, or python-appservice-deploy needing full
infra like VNet/Key Vault/DB), set matched=false with notes="resumed from <skill>" so
the workflow proceeds — do NOT re-route.

Set `input.specializedRouting` to an object:
  { "matched": true|false, "skill": "<skill-name or null>", "notes": "<why>" }
If matched (and not a resume), invoke that skill first, then re-run this script.
EOG
        ;;
    analyze) cat <<'EOG'
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
EOG
        ;;
    requirements) cat <<'EOG'
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
EOG
        ;;
    scan) cat <<'EOG'
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
    See `scripts/references/aspire.md` for the full procedure.

Set `input.components` to an array of objects:
  [ { "name": "...", "type": "Frontend|API|Worker|Function|Aspire|Static|...",
      "technology": "...", "path": "...", "dependsOn": ["PostgreSQL", "api", ...] } ]
EOG
        ;;
    recipe) cat <<'EOG'
Choose the IaC recipe. The script computed a suggestion in `auto.suggestedRecipe`
from existing tooling (`auto.existingInfra`, including `azureYamlProvider`) and
`auto.componentSignals.aspire`. Confirm or override it.

Special case — .NET Aspire (`auto.componentSignals.aspire` true):
  Always use AZD with auto-generated config (`azd init --from-code`). Do NOT
  manually select a recipe or hand-author artifacts. See `scripts/references/aspire.md`.

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
EOG
        ;;
    architecture) cat <<'EOG'
Select a hosting stack, map each component to an Azure service + SKU, and record
rationale. Load per-service detail under `scripts/references/services/<service>/README.md`
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
    backends. See `scripts/references/services/functions/durable.md`.
  - Low-code / visual workflow → Logic Apps.

Supporting services — ALWAYS include: Log Analytics (logging), Application
Insights (monitoring/APM), Key Vault (secrets), Managed Identity (svc-to-svc auth).

Set `input.stack` to "Containers" | "Serverless" | "App Service" (or a hybrid label).
Set `input.architecture` to an array of objects:
  [ { "component": "...", "azureService": "...", "sku": "...", "rationale": "..." } ]
Include the supporting services as their own entries.
EOG
        ;;
    azure-context) cat <<'EOG'
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
4. Confirm region via `ask_user`. Present ONLY regions that support ALL selected
   services — a region missing a service will fail deployment. Most services
   (Container Apps, Functions, App Service, SQL, Cosmos, Key Vault, Storage, Service
   Bus, Event Grid, App Insights/Log Analytics) are broadly available. LIMITED ones
   need a region check: Static Web Apps (~5 regions), Azure AI Foundry (very limited,
   by model), AKS and Azure Database for PostgreSQL (limited in some regions) — use
   the Azure quota MCP tool (`quota_region_availability_list`) and the service-specific
   region-availability references to verify. See `scripts/references/region-availability.md`.
   Honor any data-residency constraint in `input.requirements.compliance`.
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
EOG
        ;;
    quota) cat <<'EOG'
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
EOG
        ;;
    approval) cat <<'EOG'
Present `.azure/deployment-plan.md` (the script just generated/updated it) to the user
and ask for explicit approval. Do NOT proceed without it.
Set `input.userApproved` to true once the user approves (false/keep null to revise).
If the user requests changes, update the relevant `input.*` fields and re-run so the
plan regenerates before asking again.
EOG
        ;;
    research) cat <<'EOG'
For each Azure service in `input.architecture`, gather best practices BEFORE
generating artifacts, then record findings.

Process:
  1. List all services from the architecture plan.
  2. Load each service's `scripts/references/services/<service>/README.md` first, then
     specific files (bicep.md / terraform.md / scaling.md / auth.md / sdk.md / etc.)
     only as needed (progressive loading).
  3. Check resource naming rules (valid chars, length, uniqueness scope) per
     learn.microsoft.com resource-name-rules.
  4. Load the selected recipe's guide + its IaC rules / MCP best practices / schema
     tools (see the recipe README chosen earlier).
  5. Verify every service is available in the target region
     (`scripts/references/region-availability.md`).
  6. Provisioning limits/quota were validated in the quota step — re-check if the
     architecture changed.
  7. For containerized apps, load runtime production settings (e.g.
     `scripts/references/runtimes/nodejs.md`).
  8. Invoke related skills for deeper guidance (see routing below).
  9. Document findings in `.azure/deployment-plan.md` under `## Research Summary`.

Service → reference / related skill (load README under scripts/references/services/<svc>/):
  - Container Apps / App Service → +azure-diagnostics, azure-observability, azure-nodejs-production
  - AKS → +azure-networking
  - Functions → (stay here; see composition mandate below)
  - Storage → +azure-storage
  - API Management → scripts/references/apim.md, +azure-aigateway (AI Gateway policies)
  - Durable Functions → scripts/references/services/functions/durable.md + scripts/references/services/durable-task-scheduler/
  - Key Vault → +azure-keyvault-expiration-audit;  Managed Identity → +entra-app-registration
  - Application Insights → +appinsights-instrumentation;  Log Analytics → +azure-observability, azure-kusto
  - Azure OpenAI → scripts/references/services/foundry/ + microsoft-foundry;  AI Search → +azure-ai

Skill routing for special scenarios:
  - GitHub Copilot SDK → invoke **azure-hosted-copilot-sdk** (scaffold+config), then resume.
  - Azure Functions → STAY here: load scripts/references/services/functions/templates/selection.md (decision
    tree) → follow scripts/references/services/functions/templates/recipes/composition.md (algorithm). Never
    synthesize IaC by hand.
  - PostgreSQL passwordless / security hardening → handle directly with service refs.
  - App Insights instrumentation → appinsights-instrumentation; AI apps → microsoft-foundry;
    cost-sensitive → azure-cost.

Set `input.researchDone` to true when finished.
EOG
        ;;
    generate) cat <<'EOG'
Generate infrastructure and configuration files for the selected recipe. Research
(prior step) MUST be complete and its findings applied.

⛔ FIRST — .NET Aspire (`auto.componentSignals.aspire` true): do NOT hand-create
azure.yaml or infra/ files. USE `azd init --from-code -e <env>` (it generates infra
from the AppHost; both `--from-code` AND `-e <name>` are REQUIRED for non-interactive
runs). Then IMMEDIATELY `azd env set AZURE_SUBSCRIPTION_ID <id>` and `AZURE_LOCATION`.
After init, VALIDATE the generated azure.yaml has a non-empty `services:` section — if
empty/missing, the AppHost has only local-only resources (`.ExcludeFromManifest()`):
record a blocker and STOP, do NOT hand-author artifacts to work around it. If
`azd init` fails with "unsupported resource type", that is also a hard stop — do NOT
patch the source. For Aspire + Azure Functions, add
`.WithEnvironment("AzureWebJobsSecretStorageType", "Files")` to the
`AddAzureFunctionsProject` chain before `azd up`. See `scripts/references/aspire.md` and
`scripts/references/recipes/azd/aspire.md`. Manually authoring azure.yaml for Aspire is the most
common deployment failure.

Other special patterns: complex existing codebase → consider `azd init --from-code`;
existing azure.yaml (`auto.existingInfra.azureYaml`) → MODIFY the existing config.

⛔ Global rules (see `scripts/references/global-rules.md`): destructive actions
(delete/overwrite/purge/expensive provisioning/RBAC changes) ALWAYS require `ask_user`
first — never delete the user's project or workspace directory. `azd init -t <template>`
is for NEW projects only: run it ONLY in an empty/new directory. To re-init an existing
project, scaffold in a separate new dir and migrate changes in with confirmed edits;
`azd init` WITHOUT a template arg is fine in existing workspaces.

⛔ If the target compute is Azure Functions, load the composition algorithm BEFORE
generating any infrastructure:
  1. Load `scripts/references/services/functions/templates/selection.md` (base template + recipe).
  2. Load `scripts/references/services/functions/templates/recipes/composition.md` (the algorithm).
  3. Use the `functions_template_get` MCP tool to list/fetch templates and write
     functionFiles[] + projectFiles[] directly — NEVER hand-write Bicep/Terraform.
     Fallback to `azd init -t <template>` / `func init` / `func new` only when composing
     multiple recipes and the required templates are not found.
  The Functions bicep.md/terraform.md files are REFERENCE DOCS, not templates to copy —
  hand-writing from them yields missing RBAC and broken managed identity.
For other compute (Container Apps, App Service, Static Web Apps) load their
`scripts/references/services/<service>/README.md`. Load the selected recipe's README (above)
for detailed generation steps.

Before generating IaC, research best practices via MCP (per recipe):
  - Bicep recipes (AZD Bicep / AZCLI / Bicep): `mcp_bicep_get_bicep_best_practices`,
    `mcp_bicep_list_avm_metadata`, `mcp_bicep_get_az_resource_type_schema`.
  - Terraform recipes (AZD Terraform / Terraform): `mcp_azure_mcp_azureterraformbestpractices`.
  - General: `mcp_azure_mcp_get_azure_bestpractices`.
  AVM module selection order is MANDATORY: prefer AVM Pattern modules → AVM Resource
  modules → AVM Utility modules (same order for Bicep and Terraform); only fall back to
  non-AVM when no AVM module exists. See the recipe README + iac-rules.md for detail.

Generation order: (1) azure.yaml (AZD only) → (2) app code scaffolding (entry points,
health endpoints) → (3) Dockerfiles (if containerized) → (4) IaC in ./infra/ →
(5) CI/CD (if requested). Typical layout: .azure/, infra/{main.bicep|main.tf,modules/},
src/<component>/Dockerfile, azure.yaml.

⚠️ Create the full directory tree (`mkdir -p`) BEFORE writing files — the `create`
tool does NOT make parent directories. The script already scaffolded the `infra/` tree
and a standard parameters stub for the selected recipe — see `auto.scaffold` for the
files it created (do NOT recreate them; fill in `infra/main.bicep`/`main.tf` + modules).

Security requirements (MANDATORY):
  - No hardcoded secrets; Key Vault for sensitive values; Managed Identity for auth;
    HTTPS only, TLS 1.2+.
  - SQL Server Bicep MUST use Entra-only auth — omit administratorLogin /
    administratorLoginPassword entirely (incl. conditional branches); these names must
    not appear in any .bicep. See `scripts/references/services/sql-database/bicep.md`.
  - SQL + Managed Identity → MUST generate scripts/grant-sql-access.sh + .ps1 and a
    `postprovision` hook in azure.yaml (ARM role assignments only grant control-plane).
  - App Service Bicep → every Microsoft.Web/sites MUST carry
    tags: union(tags, { 'azd-service-name': serviceName }) or `azd deploy` can't find it.
  - Containerized apps → apply runtime production settings (e.g. `scripts/references/runtimes/nodejs.md`).

After generation: record the generated file list in `.azure/deployment-plan.md`.
Set `input.generateDone` to true when artifacts are written.
EOG
        ;;
    security) cat <<'EOG'
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
  See `scripts/references/auth-best-practices.md`.

See `scripts/references/security.md` for the full checklists, MCP/CLI commands, RBAC
tables, and SDK package matrix.

Set `input.securityDone` to true when hardening is complete.
EOG
        ;;
    functional-verify) cat <<'EOG'
Verify the app works — both UI and backend — BEFORE marking the plan Ready for
Validation. This catches broken functionality before it reaches Azure.

Use `ask_user` to offer testing:
  "Before we deploy, would you like to verify the app works as expected? We can test
   both the UI and backend to catch issues before they reach Azure."
If the user declines, set the keys below and move on.

Backend checks: app starts without errors; core API endpoints respond (curl health/
list/create); data/CRUD operations work against storage/db; auth flows work (tokens,
managed-identity fallback, login/logout); errors return meaningful responses.

UI checks (if any): page loads in a browser; interactive elements (buttons, forms,
file inputs, nav) work; data renders from the backend; the core user journey completes
end-to-end (e.g. upload → view → delete).

Run locally where possible, by detected runtime:
  - Node.js: `npm install && npm start` (set PORT=3000 if unconfigured)
  - Python:  `pip install -r requirements.txt && python app.py` (use a venv)
  - .NET:    `dotnet run` (check launchSettings.json for the port)
  - Java:    `mvn spring-boot:run` or `gradle bootRun`
API-only/no UI → test endpoints with curl. Static site → open in a browser.
WARNING: apps using Azure services (Blob, Cosmos, etc.) need `az login` with adequate
RBAC, or local emulators (e.g. Azurite). If issues are found, fix and re-test.

Record the outcome in `.azure/deployment-plan.md`:
  ## Functional Verification
  - Status: Verified / Skipped
  - Backend: Tested / Not applicable
  - UI: Tested / Not applicable
  - Notes: <any issues found and resolved>

Set `input.functionalVerifyDone` to true when verification passes, is skipped, or N/A.
EOG
        ;;
    esac
}

# ---------------------------------------------------------------------------
# Output emitters
# ---------------------------------------------------------------------------

# Writes null placeholders for the missing keys, saves state, and prints the NEXT ACTION block telling the LM what to do and which keys to fill.
write_next_action() {
    local id="$1"
    local i phaseLabel gate guidance allRefs

    # Ensure null placeholders exist for every missing need so the LM has a template.
    for i in "${!MISSING_PATHS[@]}"; do
        test_provided "${MISSING_PATHS[$i]}" || set_null "${MISSING_PATHS[$i]}"
    done
    save_state

    if [[ "$(step_phase "$id")" == 1 ]]; then phaseLabel='Phase 1 — Planning'; else phaseLabel='Phase 2 — Execution'; fi

    echo '=== AZURE-PREPARE :: NEXT ACTION ==='
    echo ''
    echo "Step:  $id  ($phaseLabel)"
    echo "Title: $(step_title "$id")"
    echo "State: $StateFile"
    echo ''
    gate="$(step_gate "$id")"
    if [[ "$gate" == true ]]; then
        echo '*** USER APPROVAL GATE — do not continue until the user approves. ***'
        echo ''
    fi
    echo 'What to do:'
    guidance="$(step_guidance "$id")"
    while IFS= read -r line; do printf '  %s\n' "${line%"${line##*[![:space:]]}"}"; done <<<"$guidance"
    echo ''
    allRefs="$( { step_refs "$id"; step_dynrefs "$id"; } | awk 'NF && !seen[$0]++')"
    if [[ -n "$allRefs" ]]; then
        echo 'Read for detail:'
        while IFS= read -r r; do echo "  - $r"; done <<<"$allRefs"
        echo ''
    fi
    echo 'Fill these keys in the state file (currently null):'
    for i in "${!MISSING_PATHS[@]}"; do
        echo "  - ${MISSING_PATHS[$i]} : ${MISSING_PROMPTS[$i]}"
    done
    echo ''
    echo 'Then re-run:'
    echo "  bash <skill>/scripts/prepare.sh \"$RepoPath\""
    echo ''
    echo '=== END NEXT ACTION ==='
}

# Saves state and prints the COMPLETE block directing the LM to hand off to azure-validate.
write_complete() {
    save_state
    local plan="$RepoPath/.azure/deployment-plan.md"
    echo '=== AZURE-PREPARE :: COMPLETE ==='
    echo ''
    echo 'All preparation steps are done.'
    echo "Plan: $plan  (Status: Ready for Validation)"
    echo ''
    echo 'Next: invoke the azure-validate skill.'
    echo 'Do NOT run azd up / azd deploy / terraform apply directly.'
    echo ''
    echo '=== END COMPLETE ==='
}

# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------
get_state
invoke_auto_collect

for step in "${STEP_IDS[@]}"; do
    # Ensure a status entry exists for this step (default pending).
    if [[ "$(printf '%s' "$STATE" | jq -r --arg id "$step" '.steps | has($id)')" != true ]]; then
        set_str "steps.$step" 'pending'
    fi
    [[ "$(get_by_path "steps.$step")" == 'done' ]] && continue

    # Run the step's auto collector (may satisfy needs programmatically).
    step_auto "$step"

    # Determine missing needs.
    MISSING_PATHS=()
    MISSING_PROMPTS=()
    while IFS=$'\t' read -r np prompt; do
        [[ -n "$np" ]] || continue
        if ! test_provided "$np"; then
            MISSING_PATHS+=("$np")
            MISSING_PROMPTS+=("$prompt")
        fi
    done < <(step_needs "$step")

    if [[ ${#MISSING_PATHS[@]} -gt 0 ]]; then
        write_next_action "$step"
        exit 0
    fi

    # All needs satisfied — finalize the step.
    step_ondone "$step"
    set_str "steps.$step" 'done'
    save_state
done

write_complete
