#!/usr/bin/env bash
# Submit an eval run to MSBench, wait for it, and pass only if every task is resolved.
#
# Usage: run-eval.sh
# Run signed in to Azure as the MSBench submitter.
# Environment:
#   BENCHMARK, MODEL, BACKEND, PACKAGE_DIR, RESULTS_DIR
#   CAPI               ours    = our CAPI integration: GITHUB_COPILOT_INTEGRATION_ID, CAPI_HMAC_KEY
#                      msbench = MSBench's workflow-managed autodev-test credentials
#   USE_RUN_IDENTITY   True or False. True needs RUN_IDENTITY_CLIENT_ID,
#                      RUN_IDENTITY_TENANT_ID and RUN_IDENTITY_SUBSCRIPTION_ID.
# Exit codes: 0 all tasks resolved, 1 the run or a task failed, 2 missing or invalid input.
set -euo pipefail

fail() {
  echo "$1" >&2
  exit 2
}
require() {
  for name in "$@"; do
    value="${!name:-}"
    # An unset ADO variable arrives as the literal text $(name).
    if [ -z "$value" ] || [[ "$value" == '$('*')' ]]; then
      fail "Missing $name."
    fi
  done
  unset value
}

require BENCHMARK MODEL BACKEND PACKAGE_DIR RESULTS_DIR CAPI USE_RUN_IDENTITY
unset CES_PROXY_BYPASS CES_PROXY_FORCE CES_PROXY_INTEGRATION_ID

args=(
  --agent "$PACKAGE_DIR"
  --runner "$PACKAGE_DIR/runner.sh"
  --runner_type harbor
  --benchmark "$BENCHMARK"
  --model "$MODEL"
  --backend "$BACKEND"
  --workers 1
  --tag purpose=azurebench-eval
  --no-kusto
  --events "$RESULTS_DIR/events.jsonl"
  --output "$RESULTS_DIR/report.json"
  -y
)

case "$CAPI" in
  ours)
    # MSBench only allows our BYOI identity with CES_PROXY_BYPASS=true, and with
    # that flag MSBench rejects our own CAPI_HMAC_KEY.
    if [ "$USE_RUN_IDENTITY" = "True" ]; then
      fail "CAPI=ours cannot be used with the run identity (BYOI); use CAPI=msbench."
    fi
    require GITHUB_COPILOT_INTEGRATION_ID CAPI_HMAC_KEY
    args+=(--encrypted-env GITHUB_COPILOT_INTEGRATION_ID CAPI_HMAC_KEY)
    ;;
  msbench)
    unset GITHUB_COPILOT_INTEGRATION_ID CAPI_HMAC_KEY
    export CES_PROXY_BYPASS=true
    ;;
  *) fail "CAPI must be ours or msbench." ;;
esac

if [ "$USE_RUN_IDENTITY" = "True" ]; then
  require RUN_IDENTITY_CLIENT_ID RUN_IDENTITY_TENANT_ID RUN_IDENTITY_SUBSCRIPTION_ID
  args+=(
    --run_identity_client_id "$RUN_IDENTITY_CLIENT_ID"
    --run_identity_tenant_id "$RUN_IDENTITY_TENANT_ID"
    --run_identity_subscription_id "$RUN_IDENTITY_SUBSCRIPTION_ID"
    --tag harbor.keepIdentityForRun=true
  )
fi

mkdir -p "$RESULTS_DIR"
status=0
msbench-cli run "${args[@]}" || status=$?

here="$(cd "$(dirname "$0")" && pwd)"
python3 "$here/check-results.py" "$RESULTS_DIR" "$status"
