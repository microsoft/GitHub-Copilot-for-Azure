#!/usr/bin/env bash
#
# Prepare or clean up a reversible Azure Diagnostics live AKS scenario.
#
# Exit codes: 0 = success, 1 = scenario setup/cleanup failure,
# 2 = usage or argument error.

set -euo pipefail

usage() {
    cat <<'EOF'
Usage: manage-scenario.sh <setup|cleanup> <scenario>

Scenarios:
  coredns-scheduling
  missing-service-endpoints
  dns-network-policy
EOF
}

wait_for_coredns_ready() {
    kubectl -n kube-system rollout status deployment/coredns --timeout=10m
}

cleanup_coredns_scheduling() {
    kubectl taint nodes --all diagnostics-live-coredns- >/dev/null 2>&1 || true
    wait_for_coredns_ready
}

setup_coredns_scheduling() {
    cleanup_coredns_scheduling
    kubectl taint nodes --all diagnostics-live-coredns=true:NoSchedule --overwrite
    kubectl -n kube-system delete pod -l k8s-app=kube-dns --wait=false

    attempts=0
    while [ "$attempts" -lt 60 ]; do
        phases=$(kubectl -n kube-system get pods -l k8s-app=kube-dns \
            -o jsonpath='{range .items[*]}{.status.phase}{"\n"}{end}')
        pending=$(printf '%s\n' "$phases" | grep -c '^Pending$' || true)
        running=$(printf '%s\n' "$phases" | grep -c '^Running$' || true)
        if [ "$pending" -ge 1 ] && [ "$running" -eq 0 ]; then
            return
        fi
        attempts=$((attempts + 1))
        sleep 5
    done

    echo "CoreDNS did not reach the expected unschedulable state." >&2
    kubectl -n kube-system get pods -l k8s-app=kube-dns -o wide >&2
    exit 1
}

cleanup_missing_service_endpoints() {
    kubectl delete namespace diagnostics-endpoints --ignore-not-found --wait=true
}

setup_missing_service_endpoints() {
    cleanup_missing_service_endpoints
    kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Namespace
metadata:
  name: diagnostics-endpoints
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: inventory
  namespace: diagnostics-endpoints
spec:
  replicas: 1
  selector:
    matchLabels:
      app: inventory
  template:
    metadata:
      labels:
        app: inventory
    spec:
      containers:
        - name: inventory
          image: registry.k8s.io/e2e-test-images/agnhost:2.53
          args:
            - netexec
            - --http-port=8080
          ports:
            - containerPort: 8080
---
apiVersion: v1
kind: Service
metadata:
  name: inventory
  namespace: diagnostics-endpoints
spec:
  selector:
    app: inventory-v2
  ports:
    - name: http
      port: 80
      targetPort: 8080
EOF
    kubectl -n diagnostics-endpoints rollout status deployment/inventory --timeout=5m

    endpoints=$(kubectl -n diagnostics-endpoints get endpoints inventory \
        -o jsonpath='{.subsets[*].addresses[*].ip}')
    if [ -n "$endpoints" ]; then
        echo "The intentionally mismatched Service unexpectedly has endpoints." >&2
        exit 1
    fi
}

cleanup_dns_network_policy() {
    kubectl delete namespace diagnostics-network --ignore-not-found --wait=true
}

setup_dns_network_policy() {
    cleanup_dns_network_policy
    kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Namespace
metadata:
  name: diagnostics-network
---
apiVersion: v1
kind: Pod
metadata:
  name: dns-client
  namespace: diagnostics-network
  labels:
    app: dns-client
spec:
  containers:
    - name: client
      image: registry.k8s.io/e2e-test-images/dnsutils:1.3
      command:
        - sleep
        - "3600"
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-dns-egress
  namespace: diagnostics-network
spec:
  podSelector:
    matchLabels:
      app: dns-client
  policyTypes:
    - Egress
  egress:
    - ports:
        - protocol: TCP
          port: 443
EOF
    kubectl -n diagnostics-network wait --for=condition=Ready pod/dns-client --timeout=5m
    if kubectl -n diagnostics-network exec dns-client -- \
        nslookup kubernetes.default.svc.cluster.local; then
        echo "The DNS-blocking NetworkPolicy did not block the selected pod." >&2
        exit 1
    fi
}

if [ "$#" -eq 1 ] && { [ "$1" = "-h" ] || [ "$1" = "--help" ]; }; then
    usage
    exit 0
fi

if [ "$#" -ne 2 ]; then
    usage >&2
    exit 2
fi

action=$1
scenario=$2

if [ "$action" != "setup" ] && [ "$action" != "cleanup" ]; then
    echo "Unknown action: $action" >&2
    usage >&2
    exit 2
fi

case "$scenario" in
    coredns-scheduling)
        "${action}_coredns_scheduling"
        ;;
    missing-service-endpoints)
        "${action}_missing_service_endpoints"
        ;;
    dns-network-policy)
        "${action}_dns_network_policy"
        ;;
    *)
        echo "Unknown scenario: $scenario" >&2
        usage >&2
        exit 2
        ;;
esac
