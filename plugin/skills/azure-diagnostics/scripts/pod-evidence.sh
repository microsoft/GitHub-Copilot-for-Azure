#!/usr/bin/env bash
# pod-evidence.sh
# Collects the invariant, read-only AKS pod-failure evidence bundle for one or more
# pods and prints a single labeled digest. Works identically regardless of the pod
# symptom (CrashLoopBackOff, OOMKilled, Pending, probe failures, ImagePullBackOff).
#
# For each pod it gathers and summarizes:
#   STATUS     - READY / phase / restart count          (kubectl get pod -o wide)
#   STATE      - exit code, reason, last-state snippet   (jsonpath over containerStatuses)
#   EVENTS     - the Events section                      (kubectl describe pod)
#   LOGS       - current container logs (tailed)         (kubectl logs)
#   PREV LOGS  - previous/crashed container logs (tailed)(kubectl logs --previous)
#   RESOURCES  - requests/limits vs live usage           (jsonpath + kubectl top pod)
#
# This script only GATHERS and DIGESTS evidence. It never mutates cluster state.
# Interpreting the digest to pick a fix (exit-code / event / probe decision tables)
# stays with the caller.
#
# Usage:
#   ./pod-evidence.sh <pod> -n <namespace> [--tail <n>]
#   ./pod-evidence.sh --all-failing [-n <namespace>] [--tail <n>]
#
# Options:
#   -n, --namespace <ns>  Namespace of the pod. Required in single-pod mode.
#                         In --all-failing mode, limits the scan to this namespace.
#       --all-failing     Auto-select every pod not in Running/Succeeded phase
#                         (across all namespaces unless -n is given) and digest each.
#       --tail <n>        Number of log lines to show per stream (default 50).
#   -h, --help            Show this help.
#
# Examples:
#   ./pod-evidence.sh my-api-7d9f-abcde -n prod
#   ./pod-evidence.sh --all-failing
#   ./pod-evidence.sh --all-failing -n prod --tail 100

set -euo pipefail

POD=""
NAMESPACE=""
ALL_FAILING=false
TAIL=50

usage() {
    sed -n '2,40p' "$0" | sed 's/^# \{0,1\}//'
}

while [ $# -gt 0 ]; do
    case "$1" in
        -n|--namespace) NAMESPACE="${2:?--namespace requires a value}"; shift 2 ;;
        --all-failing)  ALL_FAILING=true; shift ;;
        --tail)         TAIL="${2:?--tail requires a value}"; shift 2 ;;
        -h|--help)      usage; exit 0 ;;
        -*)             echo "Unknown option: $1" >&2; usage; exit 2 ;;
        *)              POD="$1"; shift ;;
    esac
done

if ! command -v kubectl >/dev/null 2>&1; then
    echo "ERROR: kubectl not found on PATH." >&2
    exit 1
fi

# Digest a single pod. Args: <namespace> <pod>
digest_pod() {
    local ns="$1" pod="$2"

    echo "=================================================================="
    echo "POD: $pod   NAMESPACE: $ns"
    echo "=================================================================="

    echo "--- STATUS (ready / phase / restarts) ---"
    kubectl get pod "$pod" -n "$ns" -o wide 2>&1 || echo "(unable to get pod)"
    echo ""

    echo "--- STATE (exit code / reason / last state) ---"
    kubectl get pod "$pod" -n "$ns" -o jsonpath='{range .status.containerStatuses[*]}container={.name}{"\n"}  ready={.ready} restarts={.restartCount}{"\n"}  current: waiting={.state.waiting.reason} running={.state.running.startedAt} terminated={.state.terminated.reason}(exit={.state.terminated.exitCode}){"\n"}  lastState: terminated={.lastState.terminated.reason}(exit={.lastState.terminated.exitCode}) at {.lastState.terminated.finishedAt}{"\n"}{end}' 2>/dev/null \
        || echo "(no container status available)"
    echo ""

    echo "--- EVENTS ---"
    if kubectl describe pod "$pod" -n "$ns" >/dev/null 2>&1; then
        kubectl describe pod "$pod" -n "$ns" 2>/dev/null | sed -n '/^Events:/,$p' | head -n 25
    else
        echo "(unable to describe pod)"
    fi
    echo ""

    echo "--- LOGS (current, last $TAIL lines) ---"
    kubectl logs "$pod" -n "$ns" --tail="$TAIL" 2>&1 || echo "(no current logs)"
    echo ""

    echo "--- PREV LOGS (previous instance, last $TAIL lines) ---"
    if kubectl logs "$pod" -n "$ns" --previous --tail="$TAIL" 2>/dev/null; then
        :
    else
        echo "(no previous-instance logs - pod has not restarted or they were rotated)"
    fi
    echo ""

    echo "--- RESOURCES (requests/limits vs live usage) ---"
    echo "requests/limits:"
    kubectl get pod "$pod" -n "$ns" -o jsonpath='{range .spec.containers[*]}  {.name}: requests={.resources.requests} limits={.resources.limits}{"\n"}{end}' 2>/dev/null \
        || echo "  (unable to read resources)"
    echo "live usage:"
    kubectl top pod "$pod" -n "$ns" 2>&1 | sed 's/^/  /' || echo "  (metrics-server unavailable)"
    echo ""
}

if [ "$ALL_FAILING" = true ]; then
    echo "pod-evidence: scanning for pods not in Running/Succeeded${NAMESPACE:+ in namespace '$NAMESPACE'}..."
    if [ -n "$NAMESPACE" ]; then
        mapfile -t ROWS < <(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase!=Running,status.phase!=Succeeded --no-headers -o custom-columns=NS:.metadata.namespace,NAME:.metadata.name 2>/dev/null)
    else
        mapfile -t ROWS < <(kubectl get pods -A --field-selector=status.phase!=Running,status.phase!=Succeeded --no-headers -o custom-columns=NS:.metadata.namespace,NAME:.metadata.name 2>/dev/null)
    fi

    if [ "${#ROWS[@]}" -eq 0 ]; then
        echo "No unhealthy pods found (all pods are Running or Succeeded)."
        exit 0
    fi

    echo "Found ${#ROWS[@]} unhealthy pod(s). Collecting evidence for each below."
    echo ""
    for row in "${ROWS[@]}"; do
        [ -z "$row" ] && continue
        ns="${row%% *}"
        name="${row##* }"
        digest_pod "$ns" "$name"
    done
    echo "pod-evidence: done. Reviewed ${#ROWS[@]} failing pod(s) - use the STATE/EVENTS/LOGS above to pick a fix."
else
    if [ -z "$POD" ]; then
        echo "ERROR: a pod name is required (or use --all-failing)." >&2
        usage
        exit 2
    fi
    if [ -z "$NAMESPACE" ]; then
        echo "ERROR: -n/--namespace is required in single-pod mode." >&2
        exit 2
    fi
    echo "pod-evidence: collecting the read-only evidence bundle for pod '$POD' in namespace '$NAMESPACE'."
    echo ""
    digest_pod "$NAMESPACE" "$POD"
    echo "pod-evidence: done. Use the STATE/EVENTS/LOGS/RESOURCES digest above to pick a fix."
fi
