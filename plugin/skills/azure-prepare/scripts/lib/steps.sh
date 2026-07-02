# =============================================================================
# steps.sh — Ordered step definitions and per-step dispatch (metadata, needs, auto, ondone).
# Sourced by prepare.sh; shares globals (STATE, RepoPath, StateFile, FILES, STEP_IDS).
# Not a standalone script.
# =============================================================================

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
            printf 'input.location\t%s\n' 'Confirmed Azure region' ;;
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
                local suggest avail subs sub_count sub_file
                # Enumerate subscriptions once: auto-confirm when exactly one exists,
                # otherwise cache the list to a separate file the LM can read on demand.
                sub_file="$StateDir/subscriptions.json"
                if [[ ! -f "$sub_file" ]]; then
                    subs="$(get_subscriptions)"
                    sub_count="$(jq 'length' <<<"$subs" 2>/dev/null || printf 0)"
                    if [[ "$sub_count" -eq 1 ]]; then
                        set_str 'input.subscription' "$(jq -r '.[0].id' <<<"$subs")"
                    elif [[ "$sub_count" -gt 1 ]]; then
                        printf '%s' "$subs" > "$sub_file"
                        set_str 'auto.subscriptionsFile' "$sub_file"
                        set_by_path 'auto.subscriptionCount' "$sub_count"
                    fi
                fi
            fi
            if ! test_provided 'input.subscription'; then
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
    local path principal
    case "$1" in
        finalize-plan)
            path="$(write_deployment_plan)"
            set_str 'auto.planFile' "$path" ;;
        azure-context)
            # Subscription is now confirmed; discover Azure Policy constraints and the
            # signed-in principal programmatically so the LM no longer queries them itself
            # (records auto.policyConstraints, auto.principalId, auto.principalName).
            set_by_path 'auto.policyConstraints' "$(get_policy_constraints)"
            principal="$(get_principal)"
            set_by_path 'auto.principalId' "$(jq -c '.id // null' <<<"$principal")"
            set_by_path 'auto.principalName' "$(jq -c '.name // null' <<<"$principal")" ;;
        approval)
            set_plan_status 'Approved' ;;
        generate)
            # azure.yaml now exists; create/configure the azd environment programmatically
            # (order-safe — runs after generation, never during planning).
            apply_azd_environment ;;
        handoff)
            set_plan_status 'Ready for Validation' ;;
    esac
}

