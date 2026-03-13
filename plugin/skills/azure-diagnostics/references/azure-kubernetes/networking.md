# Networking Troubleshooting

> For CNI-specific issues (IP exhaustion, Azure CNI Overlay, eBPF/Cilium, egress/UDR, private cluster egress), check CNI pod health: `kubectl get pods -n kube-system -l k8s-app=azure-cni` and review [AKS networking concepts](https://learn.microsoft.com/azure/aks/concepts-network).

## Service Unreachable / Connection Refused

**Diagnostics — always start here:**

```bash
# 1. Verify service exists and has endpoints
kubectl get svc <service-name> -n <ns>
kubectl get endpoints <service-name> -n <ns>

# 2. Test connectivity from inside the namespace
kubectl run netdebug --image=curlimages/curl -it --rm -n <ns> -- \
  curl -sv http://<service>.<ns>.svc.cluster.local:<port>/healthz
```

**Decision tree:**

| Observation                             | Cause                              | Fix                                             |
| --------------------------------------- | ---------------------------------- | ----------------------------------------------- |
| Endpoints shows `<none>`                | Label selector mismatch            | Align selector with pod labels; check for typos |
| Endpoints has IPs but unreachable       | Port mismatch or app not listening | Confirm `targetPort` = actual container port    |
| Works from some pods, fails from others | Network policy blocking            | See Network Policy section                      |
| Works inside cluster, fails externally  | Load balancer issue                | See Load Balancer section                       |
| `ECONNREFUSED` immediately              | App not listening on that port     | `kubectl exec <pod> -- netstat -tlnp`           |

**Running but not Ready = removed from Endpoints silently.** Check `kubectl get pod <pod> -n <ns>` — READY must show `n/n`. If not, readiness probe is failing; fix probe or app health endpoint.

---

## DNS Resolution Failures

**Diagnostics:**

```bash
# Confirm CoreDNS is running and healthy
kubectl get pods -n kube-system -l k8s-app=kube-dns -o wide
kubectl top pod -n kube-system -l k8s-app=kube-dns  # Check if CPU-throttled

# Live DNS test from the same namespace as the failing pod
kubectl run dnstest --image=busybox:1.28 -it --rm -n <ns> -- \
  nslookup <service-name>.<ns>.svc.cluster.local

# CoreDNS logs — errors show here first
kubectl logs -n kube-system -l k8s-app=kube-dns --tail=100
```

**CoreDNS configmap:** `kubectl get configmap coredns -n kube-system -o yaml` — check `forward` plugin (upstream DNS), `cache` TTL, and any custom rewrites.

**AKS DNS failure patterns:**

| Symptom                               | Cause                                        | Fix                                              |
| ------------------------------------- | -------------------------------------------- | ------------------------------------------------ |
| `NXDOMAIN` for `svc.cluster.local`    | CoreDNS down or pod network broken           | Restart CoreDNS pods; check CNI                  |
| Internal resolves, external NXDOMAIN  | Custom DNS not forwarding to `168.63.129.16` | Fix upstream forwarder                           |
| Intermittent SERVFAIL under load      | CoreDNS CPU throttled                        | Remove CPU limits or add replicas                |
| Private cluster — external names fail | Custom DNS missing privatelink forwarder     | Add conditional forwarder to Azure DNS           |
| `i/o timeout` not `NXDOMAIN`          | Port 53 blocked by NetworkPolicy or NSG      | Allow UDP/TCP 53 from pods to kube-dns ClusterIP |

**Custom DNS on VNet — the most common AKS DNS trap:**
Custom VNet DNS servers must forward `.cluster.local` to the CoreDNS ClusterIP and everything else to `168.63.129.16`. Breaking either path causes split DNS failures.

```bash
kubectl get svc kube-dns -n kube-system -o jsonpath='{.spec.clusterIP}'
# This IP must be the forward target for cluster.local in your custom DNS
```

**CoreDNS under load:** Check `kubectl get hpa coredns -n kube-system` and `kubectl top pod -n kube-system -l k8s-app=kube-dns`. If CPU-throttled and no HPA, manually scale: `kubectl scale deployment coredns -n kube-system --replicas=3`.

---

## Load Balancer Stuck in Pending

**Diagnostics:**

```bash
kubectl describe svc <svc> -n <ns>
# Events section reveals the actual Azure error

kubectl logs -n kube-system -l component=cloud-controller-manager --tail=100
# Azure cloud provider logs — more detail than kubectl events
```

**Error decision table:**

| Error in Events / CCM Logs                             | Cause                                  | Fix                                                                                 |
| ------------------------------------------------------ | -------------------------------------- | ----------------------------------------------------------------------------------- |
| `InsufficientFreeAddresses`                            | Subnet has no free IPs                 | Expand subnet CIDR; use Azure CNI Overlay; use NAT gateway instead                  |
| `ensure(default/svc): failed... PublicIPAddress quota` | Public IP quota exhausted              | Request quota increase for Public IP Addresses in the region                        |
| `cannot find NSG`                                      | NSG name changed or detached           | Re-associate NSG to the AKS subnet; check `az aks show` for NSG name                |
| `reconciling NSG rules: failed`                        | NSG is locked or has conflicting rules | Remove resource lock; check for deny-all rules above AKS-managed rules              |
| `subnet not found`                                     | Wrong subnet name in annotation        | Verify subnet name: `az network vnet subnet list -g <rg> --vnet-name <vnet>`        |
| No events, stuck Pending                               | CCM can't authenticate to Azure        | Check cluster managed identity has `Network Contributor` on the VNet resource group |

**Internal LB annotations:** Set `service.beta.kubernetes.io/azure-load-balancer-internal: "true"` and `azure-load-balancer-internal-subnet: "<subnet-name>"`. Add `azure-load-balancer-ipv4: "10.x.x.x"` for a static private IP.

**CCM identity check:** If no events and LB is stuck, verify the cluster's managed identity has `Network Contributor` on the VNet resource group: `az aks show -g <rg> -n <cluster> --query "identity.principalId" -o tsv` then check role assignments.

---

## Ingress Not Routing Traffic

**Diagnostics:**

```bash
# Confirm controller is running
kubectl get pods -n <ingress-ns> -l 'app.kubernetes.io/name in (ingress-nginx,nginx-ingress)'
kubectl logs -n <ingress-ns> -l app.kubernetes.io/name=ingress-nginx --tail=100

# Check the ingress resource state
kubectl describe ingress <name> -n <ns>
kubectl get ingress <name> -n <ns>  # ADDRESS must be populated

# Check backend
kubectl get endpoints <backend-svc> -n <ns>
```

**Ingress failure patterns:**

| Symptom                          | Cause                                          | Fix                                                          |
| -------------------------------- | ---------------------------------------------- | ------------------------------------------------------------ |
| ADDRESS empty                    | LB not provisioned or wrong `ingressClassName` | Check controller service; set correct `ingressClassName`     |
| 404 for all paths                | No matching host rule                          | Check `host` field; `pathType: Prefix` vs `Exact`            |
| 404 for some paths               | Trailing slash mismatch                        | `Prefix /api` matches `/api/foo` not `/api` — add both       |
| 502 Bad Gateway                  | Backend pods unhealthy or wrong port           | Verify Endpoints has IPs; confirm `targetPort` and readiness |
| 503 Service Unavailable          | All backend pods down                          | Check pod restarts and readiness probe                       |
| TLS handshake fail               | cert-manager not issuing                       | `kubectl describe certificate -n <ns>`; check ACME challenge |
| Works for host-a, 404 for host-b | DNS not pointing to ingress IP                 | `nslookup <host>` must resolve to ingress ADDRESS            |

**Application Routing add-on:** `az aks show -g <rg> -n <cluster> --query "ingressProfile"` — if enabled, use `ingressClassName: webapprouting.kubernetes.azure.com`.

---

## Network Policy Blocking Traffic

**Finding which policy is blocking (the hard part):**

```bash
# List all policies in the namespace — check both ingress and egress
kubectl get networkpolicy -n <ns> -o yaml

# Check for a default-deny policy (blocks everything unless explicitly allowed)
kubectl get networkpolicy -n <ns> -o jsonpath='{range .items[?(@.spec.podSelector=={})]}
  {.metadata.name}{"\n"}{end}'

# Simulate traffic to identify the block
kubectl run probe --image=curlimages/curl -n <source-ns> -it --rm -- \
  curl -v --connect-timeout 3 http://<target-pod-ip>:<port>
# Timeout = network policy blocking. Connection refused = reached pod but app issue.
```

**Policy audit checklist:** (1) Get source pod labels. (2) Get destination pod labels. (3) Check destination namespace for ingress policy — does it allow from source labels? (4) Check source namespace for egress policy — does it allow to destination labels? Both directions need explicit allow rules if default-deny exists.

**AKS network policy engine check:** Azure NPM (Azure CNI): `kubectl get pods -n kube-system -l k8s-app=azure-npm`. Calico: `kubectl get pods -n calico-system`.

**Common default-deny escape:** Always add an egress policy allowing UDP/TCP port 53 to the kube-dns service IP — this is the most frequently forgotten rule when adding a default-deny NetworkPolicy.
