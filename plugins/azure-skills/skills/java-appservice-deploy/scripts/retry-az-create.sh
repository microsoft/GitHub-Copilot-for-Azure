#!/usr/bin/env bash
# retry-az-create.sh
# Wraps the idempotent `(az ... show ...) || (az ... create ...)` pair with
# silent retries against transient ARM frontend errors (connection resets,
# 429/502/503/504, timeouts).
#
# Usage:
#   ./retry-az-create.sh --show <az-show-arguments...> --create <az-create-arguments...>
#
# Arguments are passed directly to az, never evaluated as shell code. The script:
#   - runs `show` first (short-circuits any partially-succeeded prior attempt
#     and avoids false NameAlreadyExists / Conflict errors);
#   - if `show` fails, runs `create`;
#   - on transient failure, retries up to 2 times (3 attempts total) with
#     5s then 15s backoff;
#   - on non-transient failure, surfaces the original error and exits 1.
#
# Examples:
#   ./retry-az-create.sh \
#       --show group show -n my-rg --only-show-errors \
#       --create group create -n my-rg -l eastus2
#
#   ./retry-az-create.sh \
#       --show appservice plan show -n my-plan -g my-rg --only-show-errors \
#       --create appservice plan create -n my-plan -g my-rg --is-linux --sku P0v3 -l eastus2
#
# Exit codes: 0 = success, 1 = command failure, 2 = invalid arguments.

set -uo pipefail

usage() {
    echo "Usage: $0 --show <az-show-arguments...> --create <az-create-arguments...>"
}

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then usage; exit 0; fi
if [ "${1:-}" != "--show" ]; then usage >&2; exit 2; fi
shift
if [ "$#" -eq 0 ] || [ "$1" = "--create" ]; then usage >&2; exit 2; fi
SHOW_ARGS=()
while [ "$#" -gt 0 ] && [ "$1" != "--create" ]; do
    SHOW_ARGS+=("$1")
    shift
done
if [ "$#" -eq 0 ]; then usage >&2; exit 2; fi
shift
if [ "$#" -eq 0 ]; then usage >&2; exit 2; fi
CREATE_ARGS=("$@")

TRANSIENT='Connection reset|Connection aborted|ConnectionError|Read timed out|BadGatewayConnection|ServiceUnavailable|Max retries exceeded|TooManyRequests|\b429\b|\b50[234]\b'
NON_RETRYABLE='AuthorizationFailed|SubscriptionNotFound|ResourceGroupNotFound|InvalidTemplateDeployment|SkuNotAvailable|QuotaExceeded|BadRequest|Forbidden|Unauthorized|\b(HTTP(/[0-9.]+)?|status( code)?)[: =]+4([01][0-9]|2[0-8]|[3-9][0-9])\b'

for attempt in 1 2 3; do
    # Run show silently; on failure, run create and capture stderr.
    if az "${SHOW_ARGS[@]}" -o none >/dev/null 2>&1; then
        exit 0
    fi
    if err=$(az "${CREATE_ARGS[@]}" -o none 2>&1); then
        exit 0
    fi

    if printf '%s\n' "$err" | grep -qiE "$NON_RETRYABLE" ||
       ! printf '%s\n' "$err" | grep -qiE "$TRANSIENT"; then
        echo "$err" >&2
        exit 1
    fi

    if [ "$attempt" -eq 3 ]; then
        echo "$err" >&2
        echo "ARM frontend is returning transient errors - please retry in a few minutes." >&2
        exit 1
    fi

    sleep "$([ "$attempt" -eq 1 ] && echo 5 || echo 15)"
done
