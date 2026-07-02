# =============================================================================
# collect.sh — Programmatic auto-collection of repo/azd/az context.
# Sourced by prepare.sh; shares globals (STATE, RepoPath, StateFile, FILES, STEP_IDS).
# Not a standalone script.
# =============================================================================

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

    # Merge collector output over any existing auto.* keys so that values recorded by
    # step onDone hooks in earlier invocations (e.g. auto.policyConstraints) survive.
    STATE="$(printf '%s' "$STATE" | jq --argjson a "$auto" '.auto = ((.auto // {}) + $a)')"
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

# Lists the caller's Azure subscriptions as a JSON array of {name,id,isDefault,state}.
# Best-effort: prints an empty array when az is missing, not logged in, or the query fails.
get_subscriptions() {
    local out
    command -v az >/dev/null 2>&1 || { printf '[]'; return; }
    out="$(az account list --all --query '[].{name:name, id:id, isDefault:isDefault, state:state}' -o json 2>/dev/null)"
    if [[ -n "$out" ]] && jq -e . >/dev/null 2>&1 <<<"$out"; then
        jq -c '.' <<<"$out"
    else
        printf '[]'
    fi
}

# Fetches the signed-in user's object id and display name as a JSON object {id,name}.
# Best-effort: yields an empty object when az is missing, not logged in, or the caller is a
# service principal (az ad signed-in-user fails for SPs; azd auto-populates the id at provision).
# Invoked from the azure-context ondone hook so it adds no extra script invocation.
get_principal() {
    local out
    command -v az >/dev/null 2>&1 || { printf '{}'; return; }
    out="$(az ad signed-in-user show --query '{id:id, name:displayName}' -o json 2>/dev/null)"
    if [[ -n "$out" ]] && jq -e '.id != null' >/dev/null 2>&1 <<<"$out"; then
        jq -c '{id: (.id // null), name: (.name // null)}' <<<"$out"
    else
        printf '{}'
    fi
}

# Fetches enforced Azure Policy assignments for the confirmed subscription and distills
# them into a short array of constraint strings. Best-effort: yields an empty array when
# az is unavailable, unauthenticated, or the subscription cannot be resolved. Invoked from
# the azure-context ondone hook (after input.subscription is set) so it adds no extra
# script invocation.
get_policy_constraints() {
    local raw subid out arr
    command -v az >/dev/null 2>&1 || { printf '[]'; return; }
    raw="$(get_by_path 'input.subscription' 2>/dev/null || true)"
    if [[ "$raw" =~ ^[0-9a-fA-F-]{36}$ ]]; then
        subid="$raw"
    else
        subid="$(printf '%s' "$STATE" | jq -r '.auto.azContext.subscriptionId // empty')"
        [[ -z "$subid" && -n "$raw" ]] && subid="$(az account show --subscription "$raw" --query id -o tsv 2>/dev/null)"
    fi
    [[ -z "$subid" ]] && { printf '[]'; return; }
    out="$(az policy assignment list --scope "/subscriptions/$subid" -o json 2>/dev/null)"
    if [[ -z "$out" ]] || ! jq -e . >/dev/null 2>&1 <<<"$out"; then printf '[]'; return; fi
    arr="$(jq -c '
        [ .[]
          | select((.enforcementMode // "Default") != "DoNotEnforce")
          | ((.displayName // .name // "policy")
             + (if (.parameters.effect.value // "") != "" then " [" + (.parameters.effect.value) + "]" else "" end)) ]
        | map(select(. != null and . != "")) | unique' <<<"$out" 2>/dev/null)"
    [[ -z "$arr" ]] && arr='[]'
    printf '%s' "$arr"
}

# Maps an Azure service name (from input.architecture) to its ARM resource provider
# namespace, or empty when unknown. Used to decide which providers to query for quota.
map_service_to_provider() {
    local s; s="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
    case "$s" in
        *"container app"*) printf 'Microsoft.App' ;;
        *aks*|*kubernetes*) printf 'Microsoft.ContainerService' ;;
        *"virtual machine"*|*"vm scale"*|*"virtual-machine"*) printf 'Microsoft.Compute' ;;
        *"machine learning"*|*"ai foundry"*|*"azure ml"*|*" ml "*) printf 'Microsoft.MachineLearningServices' ;;
        *storage*|*blob*) printf 'Microsoft.Storage' ;;
        *"public ip"*|*"load balancer"*|*"virtual network"*|*vnet*|*"application gateway"*) printf 'Microsoft.Network' ;;
        *"app service"*|*"web app"*|*function*) printf 'Microsoft.Web' ;;
        *cosmos*) printf 'microsoft.documentdb' ;;
        *) printf '' ;;
    esac
}

# Returns 0 when a provider namespace is queryable via the az quota API. Providers with no
# quota API (App Service/Functions, Cosmos DB) return non-zero so the LM uses the docs fallback.
is_quota_supported_provider() {
    case "$1" in
        ''|Microsoft.Web|microsoft.documentdb) return 1 ;;
        *) return 0 ;;
    esac
}

# Fetches quota limit/usage/available for every provider implied by the chosen architecture,
# in the confirmed region, and returns one JSON object {region, subscriptionId, providers, unsupported}.
# Best-effort: installs the quota extension if needed; providers that error (BadRequest) or map to
# unsupported namespaces are listed under `unsupported` for the LM to resolve via docs.
get_quota_data() {
    local region subid raw services provider supported unsupported providers_obj quotas usages joined
    command -v az >/dev/null 2>&1 || { printf '{}'; return; }
    region="$(get_by_path 'input.location' 2>/dev/null || true)"
    [[ -z "$region" ]] && { printf '{}'; return; }

    # Resolve the subscription to an id (GUID preferred; fall back to azContext or az lookup).
    raw="$(get_by_path 'input.subscription' 2>/dev/null || true)"
    if [[ "$raw" =~ ^[0-9a-fA-F-]{36}$ ]]; then
        subid="$raw"
    else
        subid="$(printf '%s' "$STATE" | jq -r '.auto.azContext.subscriptionId // empty')"
        [[ -z "$subid" && -n "$raw" ]] && subid="$(az account show --subscription "$raw" --query id -o tsv 2>/dev/null)"
    fi
    [[ -z "$subid" ]] && subid="$(az account show --query id -o tsv 2>/dev/null)"
    [[ -z "$subid" ]] && { printf '{}'; return; }

    # Distinct provider namespaces implied by the architecture's azureService values.
    services="$(printf '%s' "$STATE" | jq -r '[.input.architecture[]?.azureService // empty] | .[]' 2>/dev/null)"
    supported=(); unsupported=()
    while IFS= read -r svc; do
        [[ -z "$svc" ]] && continue
        provider="$(map_service_to_provider "$svc")"
        if is_quota_supported_provider "$provider"; then
            [[ " ${supported[*]} " == *" $provider "* ]] || supported+=("$provider")
        elif [[ -n "$provider" ]]; then
            [[ " ${unsupported[*]} " == *" $provider "* ]] || unsupported+=("$provider")
        fi
    done <<<"$services"

    # Ensure the quota CLI extension is present (idempotent; first run only).
    if [[ ${#supported[@]} -gt 0 ]] && ! az extension list --query "[?name=='quota'].name" -o tsv 2>/dev/null | grep -q quota; then
        az extension add --name quota --yes >/dev/null 2>&1 || true
    fi

    providers_obj='{}'
    for provider in "${supported[@]}"; do
        local scope; scope="/subscriptions/$subid/providers/$provider/locations/$region"
        quotas="$(MSYS_NO_PATHCONV=1 az quota list --scope "$scope" -o json 2>/dev/null)"
        if [[ -z "$quotas" ]] || ! jq -e 'type == "array"' >/dev/null 2>&1 <<<"$quotas"; then
            unsupported+=("$provider"); continue
        fi
        usages="$(MSYS_NO_PATHCONV=1 az quota usage list --scope "$scope" -o json 2>/dev/null)"
        jq -e 'type == "array"' >/dev/null 2>&1 <<<"$usages" || usages='[]'
        # Join limits with usages by quota name and compute available capacity.
        joined="$(jq -c -n --argjson q "$quotas" --argjson u "$usages" '
            ($u | map({key: .name, value: (.properties.usages.value // 0)}) | from_entries) as $um
            | $q | map({
                name: .name,
                limit: (.properties.limit.value // 0),
                usage: ($um[.name] // 0),
                available: ((.properties.limit.value // 0) - ($um[.name] // 0))
              })' 2>/dev/null)"
        [[ -z "$joined" ]] && joined='[]'
        providers_obj="$(jq -c --arg p "$provider" --argjson rows "$joined" '. + {($p): $rows}' <<<"$providers_obj")"
    done

    local unsup_json; unsup_json="$(printf '%s\n' "${unsupported[@]}" | jq -R . | jq -s -c 'map(select(length > 0)) | unique')"
    jq -c -n --arg r "$region" --arg s "$subid" --argjson p "$providers_obj" --argjson un "$unsup_json" \
        '{region: $r, subscriptionId: $s, providers: $p, unsupported: $un}'
}

# Derives a valid azd environment name: an existing env name, else a sanitized repo basename, else "dev".
get_azd_env_name() {
    local existing base name
    existing="$(printf '%s' "$STATE" | jq -r '.auto.azdContext.env.name // empty')"
    if [[ -n "$existing" ]]; then printf '%s' "$existing"; return; fi
    base="${RepoPath##*/}"
    name="$(printf '%s' "$base" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9-]+/-/g; s/-+/-/g; s/^-+//; s/-+$//')"
    [[ -z "$name" ]] && name='dev'
    printf '%s' "$name"
}

# Creates/selects the azd environment and applies subscription/location for AZD recipes.
# Guarded by the existence of azure.yaml so `azd env new` never runs before the project
# exists; records the outcome under auto.azdEnv. No-op (with a reason) for non-AZD recipes,
# a missing azure.yaml, or an unavailable azd CLI.
apply_azd_environment() {
    local recipe envname subid loc existing applied vsub vloc vals pid pname vpid
    recipe="$(get_by_path 'input.recipe' 2>/dev/null || true)"
    if [[ "$recipe" != *AZD* && "$recipe" != *Aspire* ]]; then
        set_by_path 'auto.azdEnv' "$(jq -n '{applied:false, name:"n/a", reason:"non-azd recipe"}')"
        return
    fi
    if [[ ! -f "$RepoPath/azure.yaml" && ! -f "$RepoPath/azure.yml" ]]; then
        set_by_path 'auto.azdEnv' "$(jq -n '{applied:false, name:null, reason:"azure.yaml not found; project not initialized"}')"
        return
    fi
    if ! command -v azd >/dev/null 2>&1; then
        set_by_path 'auto.azdEnv' "$(jq -n '{applied:false, name:null, reason:"azd not available"}')"
        return
    fi
    envname="$(get_azd_env_name)"
    subid="$(printf '%s' "$STATE" | jq -r '.auto.azContext.subscriptionId // empty')"
    [[ -z "$subid" ]] && subid="$(get_by_path 'input.subscription' 2>/dev/null || true)"
    loc="$(get_by_path 'input.location' 2>/dev/null || true)"
    pid="$(printf '%s' "$STATE" | jq -r '.auto.principalId // empty')"
    pname="$(printf '%s' "$STATE" | jq -r '.auto.principalName // empty')"

    # Create the env only when it does not already exist; azd env new errors on a duplicate.
    existing="$(cd "$RepoPath" && azd env list -o json 2>/dev/null | jq -r --arg n "$envname" 'try ([.[] | select(.Name == $n)] | length) catch 0' 2>/dev/null)"
    if [[ -z "$existing" || "$existing" == "0" ]]; then
        ( cd "$RepoPath" && azd env new "$envname" --no-prompt >/dev/null 2>&1 ) || true
    else
        ( cd "$RepoPath" && azd env select "$envname" >/dev/null 2>&1 ) || true
    fi
    [[ -n "$subid" ]] && { ( cd "$RepoPath" && azd env set AZURE_SUBSCRIPTION_ID "$subid" >/dev/null 2>&1 ) || true; }
    [[ -n "$loc" ]] && { ( cd "$RepoPath" && azd env set AZURE_LOCATION "$loc" >/dev/null 2>&1 ) || true; }
    [[ -n "$pid" ]] && { ( cd "$RepoPath" && azd env set AZURE_PRINCIPAL_ID "$pid" >/dev/null 2>&1 ) || true; }
    [[ -n "$pname" ]] && { ( cd "$RepoPath" && azd env set AZURE_PRINCIPAL_NAME "$pname" >/dev/null 2>&1 ) || true; }

    applied=false; vsub=null; vloc=null; vpid=null
    vals="$(cd "$RepoPath" && azd env get-values -o json 2>/dev/null)"
    if [[ -n "$vals" ]] && jq -e . >/dev/null 2>&1 <<<"$vals"; then
        applied=true
        vsub="$(jq -c '.AZURE_SUBSCRIPTION_ID // null' <<<"$vals")"
        vloc="$(jq -c '.AZURE_LOCATION // null' <<<"$vals")"
        vpid="$(jq -c '.AZURE_PRINCIPAL_ID // null' <<<"$vals")"
    fi
    set_by_path 'auto.azdEnv' "$(jq -n --arg n "$envname" --argjson applied "$applied" --argjson sub "$vsub" --argjson loc "$vloc" --argjson pid "$vpid" \
        '{applied:$applied, name:$n, subscriptionId:$sub, location:$loc, principalId:$pid}')"
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
