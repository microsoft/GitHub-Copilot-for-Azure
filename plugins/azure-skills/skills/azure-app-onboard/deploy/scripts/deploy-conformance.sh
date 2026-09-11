#!/usr/bin/env bash
# Deploy -> Handoff conformance gate (bash twin of deploy-conformance.ps1).
# Deterministically checks the Step 8 finalization artifacts instead of relying on the
# model to remember and re-verify a prose checklist late in a long, compaction-heavy session.
#
# Usage:  deploy-conformance.sh <sessionPath> [infraPath]
# Output: JSON { passed, failures:[{id,detail,file}] } to stdout.
# Exit:   0 = pass, 1 = one or more BLOCK failures, 2 = usage error.
#
# All deploy-result.json / context.json field checks require `jq`. If `jq` is absent,
# those checks are skipped (reported as such) and only the file-existence and
# deployment-summary.md checks run.
set -u
SESSION_PATH="${1:?usage: deploy-conformance.sh <sessionPath> [infraPath]}"
INFRA_PATH="${2:-infra}"

DEPLOY_RESULT="$SESSION_PATH/deploy-result.json"
SUMMARY="$SESSION_PATH/deployment-summary.md"
AUDIT_LOG="$SESSION_PATH/deploy-audit.log"
CONTEXT="$SESSION_PATH/context.json"
PLAN="$SESSION_PATH/prepare-plan.json"
CHECKLIST="$SESSION_PATH/deploy-checklist.md"
MAIN_BICEP="$INFRA_PATH/main.bicep"
MAIN_PARAMS="$INFRA_PATH/main.parameters.json"

HAVE_JQ=0; command -v jq >/dev/null 2>&1 && HAVE_JQ=1

fails=""
add_fail() { # id detail file
  local obj; obj="$(printf '{"id":"%s","detail":"%s","file":"%s"}' "$1" "$2" "$3")"
  fails="${fails:+$fails,}$obj"
}

# 1. DEPLOY-RESULT-EXISTS
if [ ! -f "$DEPLOY_RESULT" ]; then
  add_fail "DEPLOY-RESULT-EXISTS" "deploy-result.json missing — must exist before handoff" "deploy-result.json"
elif [ "$HAVE_JQ" -eq 1 ]; then
  status="$(jq -r '.status // ""' "$DEPLOY_RESULT" 2>/dev/null)"

  # 2. DEPLOY-RESULT-NOT-SKELETON
  if [ "$status" = "in-progress" ]; then
    add_fail "DEPLOY-RESULT-NOT-SKELETON" "status is still 'in-progress' — finalize to 'succeeded'/'failed' before handoff" "deploy-result.json"
  fi

  # 3. DEPLOY-RESULT-SCHEMA — ALL required (non-optional) DeployResult fields per deploy-schemas.ts.
  #    Evidence: B119 (07-20 Run 23d) hand-wrote a custom shape missing exactly this field set.
  for f in sessionId subscriptionId resourceGroupName status healthStatus warnings partial orphanedResourceGroups deploymentNames resourceIds endpoints resourceResults; do
    present="$(jq -r "if has(\"$f\") then \"yes\" else \"no\" end" "$DEPLOY_RESULT" 2>/dev/null)"
    if [ "$present" != "yes" ]; then
      add_fail "DEPLOY-RESULT-SCHEMA" "field '$f' missing — required by deploy-schemas.ts (empty array/false is valid, missing is not)" "deploy-result.json"
    fi
  done
  if [ "$status" = "succeeded" ]; then
    ridCount="$(jq -r '(.resourceIds // []) | length' "$DEPLOY_RESULT" 2>/dev/null)"
    [ "${ridCount:-0}" -eq 0 ] 2>/dev/null && add_fail "DEPLOY-RESULT-SCHEMA" "status is 'succeeded' but resourceIds[] is empty" "deploy-result.json"
    completedUtc="$(jq -r '.duration.completedUtc // ""' "$DEPLOY_RESULT" 2>/dev/null)"
    [ -z "$completedUtc" ] && add_fail "DEPLOY-RESULT-SCHEMA" "status is 'succeeded' but duration.completedUtc is empty" "deploy-result.json"

    # 4. ENDPOINT-COMPLETENESS — exclude infra/non-routable entries: '... Plan' (compute SKU),
    #    '... Environment' (CAE, not an app), '... Job'/'worker' (background — no inbound HTTP endpoint).
    if [ -f "$PLAN" ]; then
      hostingCount="$(jq -r '[(.services // [])[] | select(((.name // "") | test("app service|functions|container app|static web app"; "i")) or ((.type // "") | test("app service|functions|container app|static web app"; "i"))) | select((.name // "") | test("\\b(plan|environment|job|worker)\\b"; "i") | not)] | length' "$PLAN" 2>/dev/null)"
      endpointCount="$(jq -r '(.endpoints // []) | length' "$DEPLOY_RESULT" 2>/dev/null)"
      if [ "${hostingCount:-0}" -gt 0 ] 2>/dev/null && [ "${endpointCount:-0}" -lt "${hostingCount:-0}" ] 2>/dev/null; then
        add_fail "ENDPOINT-COMPLETENESS" "plan has $hostingCount hosting service(s) but deploy-result.json.endpoints[] has $endpointCount entries" "deploy-result.json"
      fi
    fi
  fi
fi

# 5. AUDIT-LOG-EXISTS — must exist with >=2 entries (started + result for at least 1 command).
auditLineCount=0
if [ ! -f "$AUDIT_LOG" ]; then
  add_fail "AUDIT-LOG-EXISTS" "deploy-audit.log missing — required before handoff" "deploy-audit.log"
else
  auditLineCount="$(wc -l < "$AUDIT_LOG" | tr -d ' ')"
  if [ "${auditLineCount:-0}" -lt 2 ] 2>/dev/null; then
    add_fail "AUDIT-LOG-EXISTS" "deploy-audit.log exists but has fewer than 2 entries ($auditLineCount) — started+result pairs expected" "deploy-audit.log"
  fi
fi

# 6. AUDIT-VS-HEALING — a command that started more than once implies a retry occurred.
if [ -f "$AUDIT_LOG" ] && [ "$HAVE_JQ" -eq 1 ] && [ -f "$DEPLOY_RESULT" ]; then
  retried="$(grep -Eo '\| *(az [a-z ]+(sub create|group create|webapp deploy|acr build)) *\| *started' "$AUDIT_LOG" 2>/dev/null \
    | sed -E 's/^\| *//; s/ *\|.*$//' | sort | uniq -c | awk '$1 > 1 {print $0}')"
  if [ -n "$retried" ]; then
    healingCount="$(jq -r '(.healingAttempts // []) | length' "$DEPLOY_RESULT" 2>/dev/null)"
    if [ "${healingCount:-0}" -eq 0 ] 2>/dev/null; then
      add_fail "AUDIT-VS-HEALING" "deploy-audit.log shows a retried command but healingAttempts[] is empty" "deploy-result.json"
    fi
  fi
fi

# 7. DEPLOYMENT-SUMMARY-EXISTS + DEPLOYMENT-SUMMARY-SECTIONS
if [ ! -f "$SUMMARY" ]; then
  add_fail "DEPLOYMENT-SUMMARY-EXISTS" "deployment-summary.md missing — required before handoff" "deployment-summary.md"
else
  for section in status health cleanup portal; do
    if ! grep -qiF "$section" "$SUMMARY" 2>/dev/null; then
      add_fail "DEPLOYMENT-SUMMARY-SECTIONS" "deployment-summary.md missing a '$section' section" "deployment-summary.md"
    fi
  done
fi

# 8. CONTEXT-PHASE-COMPLETE
if [ ! -f "$CONTEXT" ]; then
  add_fail "CONTEXT-PHASE-COMPLETE" "context.json missing or unparsable" "context.json"
elif [ "$HAVE_JQ" -eq 1 ]; then
  hasDeploy="$(jq -r 'if ((.completedPhases // []) | index("deploy")) != null then "yes" else "no" end' "$CONTEXT" 2>/dev/null)"
  [ "$hasDeploy" != "yes" ] && add_fail "CONTEXT-PHASE-COMPLETE" "'deploy' missing from context.json.completedPhases" "context.json"
  currentPhase="$(jq -r '.currentPhase // ""' "$CONTEXT" 2>/dev/null)"
  [ -n "$currentPhase" ] && [ "$currentPhase" != "null" ] && add_fail "CONTEXT-PHASE-COMPLETE" "context.json.currentPhase is '$currentPhase' — must be null after handoff" "context.json"
fi

# 9. CHECKLIST-SCOPE-MATCH — the prescribed az deployment command must match the Bicep entry point's targetScope.
# Evidence: 08-13 Run 3 — deploy-checklist.md prescribed `az deployment group` while main.bicep declares
# `targetScope = 'subscription'`. Undetected, this fails the deployment before it ever runs.
if [ -f "$MAIN_BICEP" ] && [ -f "$CHECKLIST" ]; then
  target_scope="resourceGroup"
  scope_match="$(grep -oE "targetScope[[:space:]]*=[[:space:]]*'[A-Za-z]+'" "$MAIN_BICEP" 2>/dev/null | head -n1 | grep -oE "'[A-Za-z]+'" | tr -d "'")"
  [ -n "$scope_match" ] && target_scope="$scope_match"
  has_group_cmd=0; grep -qE 'az deployment group (what-if|create)' "$CHECKLIST" 2>/dev/null && has_group_cmd=1
  has_sub_cmd=0; grep -qE 'az deployment sub (what-if|create)' "$CHECKLIST" 2>/dev/null && has_sub_cmd=1
  if [ "$target_scope" = "subscription" ] && [ "$has_group_cmd" -eq 1 ] && [ "$has_sub_cmd" -eq 0 ]; then
    add_fail "CHECKLIST-SCOPE-MATCH" "main.bicep declares targetScope='subscription' but deploy-checklist.md prescribes 'az deployment group' — must be 'az deployment sub'" "deploy-checklist.md"
  elif [ "$target_scope" != "subscription" ] && [ "$has_sub_cmd" -eq 1 ] && [ "$has_group_cmd" -eq 0 ]; then
    add_fail "CHECKLIST-SCOPE-MATCH" "main.bicep has no subscription targetScope (resourceGroup-scoped) but deploy-checklist.md prescribes 'az deployment sub' — must be 'az deployment group'" "deploy-checklist.md"
  fi
fi

# 10. DEPLOYED-BY-NOT-SKILLNAME — the deployedBy parameter must never be the literal skill name.
# Evidence: B47 (08-12 Run 3) — main.parameters.json defaulted deployedBy to 'azure-app-onboard'
# (the skill name) instead of the signed-in user's identity.
if [ -f "$MAIN_PARAMS" ] && [ "$HAVE_JQ" -eq 1 ]; then
  hasDeployedBy="$(jq -e '.parameters.deployedBy' "$MAIN_PARAMS" >/dev/null 2>&1; echo $?)"
  if [ "$hasDeployedBy" -eq 0 ]; then
    deployed_by="$(jq -r '.parameters.deployedBy.value // ""' "$MAIN_PARAMS" 2>/dev/null)"
    if [ -z "$deployed_by" ] || [ "$deployed_by" = "azure-app-onboard" ]; then
      add_fail "DEPLOYED-BY-NOT-SKILLNAME" "main.parameters.json deployedBy='$deployed_by' — must be the signed-in user's identity ('az ad signed-in-user show --query displayName'), never the skill name or empty" "infra/main.parameters.json"
    fi
  fi
fi

if [ -n "$fails" ]; then
  printf '{"passed":false,"failures":[%s]}\n' "$fails"
  exit 1
else
  printf '{"passed":true,"failures":[]}\n'
  exit 0
fi
