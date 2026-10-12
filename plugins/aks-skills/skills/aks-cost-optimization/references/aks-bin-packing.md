# AKS Bin-Packing and Placement Optimization

Find node consolidation and placement opportunities without claiming to reproduce the Kubernetes scheduler or guarantee the minimum possible node count. Never change workload placement, resize/delete pools, or drain nodes without approval.

## Collect Evidence

1. Use Azure MCP AKS for cluster mode, pool configuration, autoscaling/NAP, node resource group, CRG association, and upgrade surge. If that capability is unavailable, use an approved `az aks show` read instead.
2. When an approved shell capability and target-bound `kubectl` context are available, collect current scheduling state in batches:

```bash
kubectl get nodes -o json
kubectl get pods,deployments,statefulsets,daemonsets,pdb -A -o json
kubectl get events -A --field-selector reason=FailedScheduling -o json
```

Reuse rightsizing metrics; otherwise retrieve 7-14 days of available CPU/memory history in one query for all nodes/workloads. Current usage alone cannot justify consolidation. If resource requests or representative history are missing, invoke `azure-kubernetes` for pod rightsizing when it is available in the host skill inventory. Otherwise identify the workloads that require rightsizing, report that the specialized workflow is unavailable, and do not model consolidation from incomplete evidence. Read PVC/PV topology or candidate SKU/quota details only when they constrain a proposed placement.

When unexplained scale-out, blocked scale-down, evictions, or pending pods occur despite available CPU or memory, follow [node scaling bottlenecks](node-scaling-bottlenecks.md) to identify the actual limiting dimension and its cost impact before modeling consolidation.

## Assess

Calculate each node's allocatable CPU, memory, and pod slots; subtract the effective requests of all scheduled pods, including DaemonSet pods and pod overhead, counting each resource once. Report actual usage separately: requests determine scheduler fit, while history identifies candidates for the `azure-kubernetes` rightsizing workflow when that skill is available.

Flag:

- compatible small pools with sustained low requested and actual utilization;
- nodes with stranded CPU but insufficient memory, or the reverse;
- oversized pod requests that prevent otherwise available capacity from being used;
- required node/pod affinity, anti-affinity, topology spread, selectors, taints, zones, host ports, PV node/zone affinity, `maxPods`, or extended resources that restrict placement;
- PDBs, unmanaged pods, node-local storage, or do-not-disrupt settings that block safe eviction;
- pending pods whose `FailedScheduling` evidence identifies the limiting constraint.

Pools are merge candidates only when workload isolation, OS/architecture, priority, zones, networking, security/compliance, storage, accelerator, and availability requirements remain compatible. Preserve a dedicated production system pool.

### Placement Guardrails

For every workload and pool, inventory each control that limits eligible nodes or blocks eviction. Record its source, hard or preferred behavior, selectors, topology or resource scope, eligible nodes and domains, excluded capacity, and documented availability, isolation, or compliance intent. Include topology spread, affinity and anti-affinity, selectors, taints and tolerations, zones, host ports, storage locality, extended resources, and disruption controls.

Correlate each control with scheduling failures, evictions, blocked scale-down, or autoscaler/NAP node creation; its presence alone does not prove cost impact. Preserve confirmed requirements and controls whose intent is unknown. Flag a control for owner review only when evidence shows that it is stale, redundant, conflicting, broader than its stated intent, or disproportionately strands
capacity. Model one owner-approved relaxed alternative and verify replicas, failure domains, service SLOs, isolation, and compliance before recommending
the change.

## Model Scenarios

For each compatible target pool or SKU, calculate a **lower-bound** node count:

```text
max(
  ceil(total CPU requests / allocatable CPU per node),
  ceil(total memory requests / allocatable memory per node),
  ceil(total pods / available pod slots per node)
)
```

Apply the calculation separately to each required zone/placement partition and include the calculated per-node overhead, replicas, and operational headroom. Then verify that the largest pods fit individually and that required constraints have eligible nodes. If a known constraint prevents the pods from fitting, reject the scenario and identify the blocker. Otherwise, present it as a consolidation candidate requiring staged validation; do not claim the lower bound is achievable or optimal.

For an owner-approved placement change, compare the current lower bound with one relaxed alternative, such as `DoNotSchedule` to `ScheduleAnyway`, required to preferred anti-affinity, or a corrected taint/toleration. Report eligible nodes/domains and excluded capacity before and after.

For a pool associated with a Capacity Reservation Group, retrieve the reserved VM size, region, zone, quantity, associated instances, unused quantity, and surge requirement. Verify that the proposed SKU, zone, node count, and migration or upgrade surge fit the reservation. Disclose capacity that would remain billable but unused, or a required CRG change, before recommending consolidation.

Recommend in this order:

1. Route oversized requests to rightsizing using historical evidence.
2. Recommend removing or relaxing a selector, taint, topology-spread constraint, or required affinity/anti-affinity rule only when its owner confirms the original placement, isolation, and availability requirement no longer applies.
3. Merge compatible pools or adjust VM shape while preserving failure-domain and performance requirements.
4. When eligible nodes remain idle, invoke `azure-kubernetes` for Cluster Autoscaler tuning if it is available in the host skill inventory. Otherwise report the tuning opportunity and missing workflow without proposing unsupported settings. Assess [NAP](./aks-nap.md) for diverse or dynamic placement needs.

Do not recommend a VM solely for its CPU:memory ratio. For candidate SKUs, verify largest-pod fit, architecture, disk/network capabilities, regional availability, quota, and workload performance.

## Proposed Changes

Present the limiting constraint, causal evidence, cost consequence, proposed manifest/pool changes, CRG impact, staged validation, rollback, and confidence. After approval, test one workload/pool at a time, verify scheduling and SLOs, then scale down through the configured autoscaler/NAP path rather than deleting nodes directly.