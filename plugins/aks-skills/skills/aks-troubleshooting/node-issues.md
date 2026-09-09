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

## Cluster or Node Pool in `provisioningState: Failed`

Read the failed operation record before reasoning from node or VMSS symptoms:

```bash
# 1. Operation record first. `az aks operation` is part of the aks-preview extension;
#    the CLI auto-installs it on first use, which may be disallowed on managed hosts.
az aks operation show-latest -g <rg> -n <cluster>
az aks operation show-latest -g <rg> -n <cluster> --nodepool-name <pool>
az aks operation show -g <rg> -n <cluster> --operation-id <id>

# 2. Activity-log fallback (documented Learn path; the only evidence if aks-preview is unavailable)
az monitor activity-log list -g <rg> --resource <cluster-resource-id> --status Failed --offset 24h -o table

# 3. Pool, scale set, and instance provisioning state
az aks nodepool show -g <rg> --cluster-name <cluster> -n <pool> --query '{state:provisioningState,power:powerState.code}'
az vmss show -g <node-rg> -n <vmss> --query provisioningState -o tsv
az vmss list-instances -g <node-rg> -n <vmss> --query '[].{id:instanceId,state:provisioningState}' -o table
```

- The operation record carries the exact error code and message for the failing
  operation. An exact catalog error (for example the `VMExtensionError_*` codes)
  routes to `aks-known-issues`; quota errors follow the quota section below.
- If the extension is missing and cannot be installed, say so and label the
  activity-log entry as degraded evidence: it identifies the failed operation
  and status message but is not the full operation record.
- `az resource update --ids <cluster-id>` (reconcile) and `az vmss update-instances`
  are mutations. Report them as the documented recovery path only after the
  cause is understood and the owner approves.

## Node Pool Not Scaling

### Cluster Autoscaler Not Triggering

Confirm the precondition first: the cluster autoscaler scales up on **Pending
(unschedulable) pods**, not on node CPU/memory pressure and not on HPA state. If
the HPA is at `maxReplicas` and every pod is `Running`, the ceiling is the HPA,
not the autoscaler; if `kubectl get pods -A --field-selector=status.phase=Pending`
is empty, there is nothing for the autoscaler to act on.

**Diagnostics:**

```bash
# Autoscaler logs
kubectl logs -n kube-system -l app=cluster-autoscaler --tail=100

# Autoscaler status
kubectl get configmap cluster-autoscaler-status -n kube-system -o yaml

# Verify autoscaler is enabled on the node pool
az aks nodepool show -g <rg> --cluster-name <cluster> -n <nodepool> \
  --query "{autoscaleEnabled:enableAutoScaling, min:minCount, max:maxCount}"

# HPA ceiling versus autoscaler: are any pods actually unschedulable?
kubectl get hpa -A
kubectl get pods -A --field-selector=status.phase=Pending
```

**Platform metrics (Azure Monitor, `Microsoft.ContainerService/managedClusters`):**
`cluster_autoscaler_unschedulable_pods_count` (pods the autoscaler must place),
`cluster_autoscaler_cluster_safe_to_autoscale` (0 means the autoscaler is
refusing to act, for example after failed scale-ups or too many unready nodes),
`cluster_autoscaler_scale_down_in_cooldown`, `cluster_autoscaler_unneeded_nodes_count`,
and `cluster_autoscaler_failed_scale_ups_total`. Read them through an Azure
Monitor capability or `az monitor metrics list --resource <cluster-id> --metric <name>`;
Pending pods with `safe_to_autoscale=0` is the autoscaler branch, Running pods
with the HPA at max is not.

**Autoscaler won't scale up - common reasons:**

- No Pending pods: the HPA is at `maxReplicas`, or requests fit on existing nodes
- Node pool already at `maxCount`
- VM quota exhausted (confirm the binding tier and operation evidence below)
- Pod `nodeAffinity` is unsatisfiable on any new node template
- A recent autoscaler decision is still governed by the cluster's configured autoscaler profile; compare the status ConfigMap timestamps and profile settings before concluding scaling is stuck

#### Quota evidence and owner action

Stay read-only by default. Do not conclude that quota is exhausted from an autoscaler symptom or a quota-usage listing alone. Require the failed activity or operation error plus the quota evidence exposed by that error for the same subscription and region. `QuotaExceeded` records provide `Current Usage`, `Current Limit`, and `Additional Required`; `ErrCode_InsufficientVCPUQuota` records provide requested and remaining vCPUs. Record the subscription ID, region, intended node-pool scale target, VM size and family, and other quota consumers. Report any missing item as an evidence gap.

Standard vCPU quota is enforced at two tiers per subscription and region: total regional vCPUs and VM-family vCPUs. Identify the binding tier from the exact error and usage evidence. `Total Regional Cores` identifies the regional tier, while a named family such as `standardDSv5Family` identifies the family tier. A scale operation must fit within both tiers.

If stating a minimum new limit for `QuotaExceeded`, calculate only `Current Limit + Additional Required`. Do not add unrequested headroom. Leave any larger request to the owner based on planned capacity.

For a binding quota limit, direct an authorized owner to the Azure portal **Quotas** flow for **Compute** and the affected region and VM family or regional tier. Submitting the request changes subscription quota state, so it requires owner approval and suitable subscription-scope permission. A request is reviewed; do not promise approval, timing, or retries, and do not submit quota changes by default.

After any approved quota change, re-read the AKS operation, node-pool state, and activity evidence before proposing a follow-up action. Do not assume the failed operation will or will not self-heal, and do not prescribe a retry without observing the post-approval state. Suggest another VM family, SKU, region, or scale target only after verifying support, quota, and capacity for the exact subscription and target; that choice belongs to the workload owner.

Sources: [AKS `QuotaExceeded` troubleshooting](https://learn.microsoft.com/en-us/troubleshoot/azure/azure-kubernetes/create-upgrade-delete/quota-exceeded-during-creation-upgrade), [VM-family vCPU quota requests](https://learn.microsoft.com/en-us/azure/quotas/per-vm-quota-requests), and the [`az quota` reference](https://learn.microsoft.com/en-us/cli/azure/quota?view=azure-cli-latest). The portal is preferred for requests; CLI `create` and `update` operations are writes and must remain owner-executed.

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
- [Auto-upgrade evidence](references/auto-upgrade-evidence.md) when an expected automatic cluster or node OS upgrade did not happen.
- [Spot And Zone Issues](spot-and-zone-issues.md) for spot evictions, tolerations, zone skew, and zonal storage or service behavior.
