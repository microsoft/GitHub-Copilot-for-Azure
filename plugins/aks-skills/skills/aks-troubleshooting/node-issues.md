# Node & Cluster Troubleshooting

## Node NotReady — executable evidence first

Every identifier in this block is derivable or enumerable — exhaust derivation before asking the user for one. If no node was named, enumerate candidates with `kubectl get nodes --no-headers | awk '$2 !~ /^Ready(,|$)/'` and run the block for each; an empty result means no node in the current cluster is NotReady, so reconfirm the cluster identity before concluding. The VMSS name and instance id are computed from the node's `providerID` inside the block — never request them.

If the cluster name or resource group is unknown, capture the current kubeconfig server and enumerate AKS clusters in every enabled subscription available to the current Azure CLI identity:

```bash
KUBECONFIG_SERVER=$(kubectl config view --minify \
  -o jsonpath='{.clusters[0].cluster.server}')
printf 'kubeconfigServer=%s\n' "$KUBECONFIG_SERVER"

az account list --query "[?state=='Enabled'].id" -o tsv |
  while IFS= read -r SUBSCRIPTION_ID; do
    printf 'subscriptionId=%s\n' "$SUBSCRIPTION_ID"
    if ! az aks list \
      --subscription "$SUBSCRIPTION_ID" \
      --query "[].{id:id,name:name,resourceGroup:resourceGroup,fqdn:fqdn,privateFqdn:privateFqdn}" \
      -o json; then
      printf 'aksEnumeration=inaccessible; subscriptionId=%s\n' \
        "$SUBSCRIPTION_ID"
    fi
  done
```

Match the kubeconfig server host against `fqdn` or `privateFqdn`, then take the cluster name and resource group from the matching resource ID. Only ask the user if this read-only cross-subscription enumeration cannot produce a unique match.

```bash
AKS_RG="<cluster-resource-group>"
AKS_NAME="<cluster-name>"
NODE="<node-name>"

# Kubernetes description, conditions, and node-scoped events
kubectl describe node "$NODE"
kubectl get node "$NODE" \
  -o jsonpath='{range .status.conditions[*]}{.lastTransitionTime}{"\t"}{.type}{"\t"}{.status}{"\t"}{.reason}{"\t"}{.message}{"\n"}{end}'
kubectl get events --all-namespaces \
  --field-selector involvedObject.kind=Node,involvedObject.name="$NODE" \
  --sort-by='.metadata.creationTimestamp'

# AKS node resource group and Kubernetes node to VMSS instance mapping
NODE_RG=$(az aks show \
  --resource-group "$AKS_RG" \
  --name "$AKS_NAME" \
  --query nodeResourceGroup -o tsv)
AGENT_POOL=$(kubectl get node "$NODE" \
  -o jsonpath='{.metadata.labels.agentpool}')
PROVIDER_ID=$(kubectl get node "$NODE" \
  -o jsonpath='{.spec.providerID}')
VMSS=$(printf '%s\n' "$PROVIDER_ID" |
  awk -F'/virtualMachineScaleSets/' '{print $2}' | cut -d/ -f1)
INSTANCE_ID=${PROVIDER_ID##*/}

printf 'nodeResourceGroup=%s\nagentPool=%s\nvmss=%s\ninstanceId=%s\n' \
  "$NODE_RG" "$AGENT_POOL" "$VMSS" "$INSTANCE_ID"

# AKS pool state
az aks nodepool show \
  --resource-group "$AKS_RG" \
  --cluster-name "$AKS_NAME" \
  --name "$AGENT_POOL" \
  --query '{provisioningState:provisioningState,powerState:powerState.code,nodeImageVersion:nodeImageVersion,orchestratorVersion:orchestratorVersion}' \
  -o yaml

# Exact VMSS instance view and extension statuses
az vmss get-instance-view \
  --resource-group "$NODE_RG" \
  --name "$VMSS" \
  --instance-id "$INSTANCE_ID" \
  -o json
az vmss get-instance-view \
  --resource-group "$NODE_RG" \
  --name "$VMSS" \
  --instance-id "$INSTANCE_ID" \
  --query 'extensions[].{name:name,statuses:statuses,substatuses:substatuses}' \
  -o json
```

This block is the minimum Node NotReady evidence. It is incomplete until every command in it has produced output or the inability to collect it is recorded. Collect it before narrowing the failure to kubelet, host, provisioning, pressure, or network causes.

### Privileged and service mutation boundary

Kubelet/service inspection through privileged node access requires explicit approval after the mandatory block identifies a node-local evidence gap. Restarting kubelet, cordoning, draining, deleting, reimaging, or replacing a node are separate remediations and require explicit approval with workload, PodDisruptionBudget, and change-control impact understood. None is part of the default evidence path.

**Condition decision tree:**

| Condition | Value | Evidence boundary | Next investigation |
|---|---|---|---|
| `Ready` | `False` | Compare the transition time and reason with VMSS instance and extension statuses | Determine whether the failure is kubelet, host, provisioning, or network related before requesting node access |
| `MemoryPressure` | `True` | Review allocated resources, pod requests/limits, eviction events, and metrics | Identify the workload or node-pool capacity constraint |
| `DiskPressure` | `True` | Review eviction events, pod ephemeral-storage requests/limits, and node image/OS state | Determine whether workload storage use or node storage capacity is responsible |
| `PIDPressure` | `True` | Correlate condition transitions with workload placement and process evidence | Use IG `snapshot_process` if process-level evidence is required |
| `NetworkUnavailable` | `True` | Review CNI pod state and logs plus node NIC routes and NSG evidence | Continue with [Networking Troubleshooting](networking.md) |

Do not infer that a `Ready=False` condition requires a kubelet restart or node replacement. The Kubernetes condition reason, node events, VMSS provisioning state, and extension substatus determine the next branch.

---

## Node Pool Not Scaling

### Cluster Autoscaler Not Triggering

**Diagnostics:**

```bash
# Autoscaler logs
kubectl logs -n kube-system -l app=cluster-autoscaler --tail=100

# Autoscaler status
kubectl get configmap cluster-autoscaler-status -n kube-system -o yaml

# Verify autoscaler is enabled on the node pool
az aks nodepool show -g <rg> --cluster-name <cluster> -n <nodepool> \
  --query "{autoscaleEnabled:enableAutoScaling, min:minCount, max:maxCount}"
```

**Autoscaler won't scale up - common reasons:**

- Node pool already at `maxCount`
- VM quota exhausted: `az vm list-usage -l <region> -o table | grep -i "DSv3\|quota"`
- Pod `nodeAffinity` is unsatisfiable on any new node template
- A recent autoscaler decision is still governed by the cluster's configured autoscaler profile; compare the status ConfigMap timestamps and profile settings before concluding scaling is stuck

**Autoscaler won't scale down - common reasons:**

- Pods with `emptyDir` local storage (configure `--skip-nodes-with-local-storage=false` if safe)
- Standalone pods with no controller (not in a ReplicaSet)
- `cluster-autoscaler.kubernetes.io/safe-to-evict: "false"` annotation on a pod

### Manual Scaling

```bash
az aks nodepool scale -g <rg> --cluster-name <cluster> -n <nodepool> --node-count <n>
```

---

## Resource Pressure & Capacity Planning

**Check actual vs allocatable:**

```bash
kubectl describe node <node> | grep -A6 "Allocated resources:"
```

See [AKS resource reservations](https://learn.microsoft.com/azure/aks/concepts-clusters-workloads#resource-reservations) for allocatable math.

**Ephemeral storage pressure:**

```bash
# Correlate node pressure with workload requests, limits, placement, and events
kubectl describe node <node>
kubectl get pods -A --field-selector spec.nodeName=<node> \
  -o custom-columns='NAMESPACE:.metadata.namespace,NAME:.metadata.name,EPHEMERAL_REQUESTS:.spec.containers[*].resources.requests.ephemeral-storage,EPHEMERAL_LIMITS:.spec.containers[*].resources.limits.ephemeral-storage'
kubectl get events --all-namespaces \
  --field-selector involvedObject.kind=Node,involvedObject.name=<node> \
  --sort-by='.metadata.creationTimestamp'
```

If this evidence cannot identify the consumer, request approval before privileged node filesystem inspection.

**Deep diagnostics with Inspektor Gadget** (PID pressure or unknown process load):

Use `snapshot_process` (timeout 5) to list all processes on the node. For node-wide scope, omit pod filters. See [references/inspektor-gadget.md](references/inspektor-gadget.md).

---

## Detailed Node And Cluster Guides

- [Upgrade Operations](upgrade-operations.md) for node images, Kubernetes version upgrades, surge settings, and PDB-related drain blockers.
- [Spot And Zone Issues](spot-and-zone-issues.md) for spot evictions, tolerations, zone skew, and zonal storage or service behavior.
