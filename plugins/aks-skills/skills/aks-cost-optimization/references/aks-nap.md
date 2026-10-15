# AKS Node Auto-Provisioning (NAP)

Assess whether enabling Node Auto-Provisioning (NAP) would benefit the AKS cluster and whether the cluster is ready for enablement. Recommend it only when dynamic provisioning has a demonstrated placement, cost, or operational advantage over fixed pools or Cluster Autoscaler (CAS).

Use Azure MCP AKS when its schema supplies the required fields. Otherwise use [NAP evidence collection](nap-evidence-collection.md) only with approved capabilities and a bound target context.

## 1. Prerequisites - Check if NAP is already enabled and if cluster is eligible

Collect the cluster mode, identity, networking, and pool configuration.

Stop if `nodeProvisioningProfile.mode` is already `Auto` or if the cluster uses Windows node pools, IPv6, service-principal identity, or a Basic Load Balancer in a custom virtual network. Confirm acceptance of losing cluster stop and outbound-type changes.

If CAS is enabled, explain the transition to NAP and obtain explicit approval before changing or disabling CAS. Staged coexistence requires `AllowClusterAutoscalerAndNAP` feature flag registered, exclusive taints/tolerations, custom pools, and `--node-provisioning-default-pools None`; warn about double provisioning.

## 2. Scheduling Evidence

Read pods and events first. For scheduling issues, fetch nodes once and compare them with affected pod requirements; otherwise skip nodes. If Kubernetes access is unavailable, analyze supplied evidence or provide a scoped collection plan.

Use current, unassigned pods with a `status.conditions` entry matching `type: PodScheduled`, `status: "False"`, and `reason: Unschedulable`. Correlate scheduling events by pod UID/time.

For each affected pod, retain node selectors, required affinity/anti-affinity, topology-spread constraints, tolerations, and referenced volume topology. Compare them with existing nodes, including capacity excluded by taints.

### Seven-Day Scheduling History

Retrieve seven days of available unschedulable-pod metrics unless equivalent history was already collected or provided.

Use metrics to identify persistent or recurring scheduling pressure and events to determine whether NAP could address it. If history is missing or incomplete, report that limitation.

### Capacity and Cost History

Reuse verified stranded-capacity and workload-shape findings from [bin-packing analysis](./aks-bin-packing.md) when available. Otherwise collect
only enough node-count, pool-floor, request, utilization, scaling, and cost history to determine whether fixed pools serve the demand poorly. NAP does not
repeat consolidation or placement-relaxation modeling. Low utilization alone is not evidence that NAP will save cost.

If `cost-analysis` is available, invoke it for attributable cluster compute cost. Compare current fixed-pool cost with the expected NAP capacity and any
migration overlap. Keep unavailable cost or savings unknown rather than zero.

## 3. Assess NAP Signals

Require at least one confirmed primary signal. For each signal, identify an allowed NAP node configuration that fits workload requests, DaemonSet overhead,
architecture, zones, networking, storage, policy, quota, and budget.

| Class / signal | Evidence to use | Decision role |
|----------------|-----------------|---------------|
| Primary: insufficient resources | Matching `FailedScheduling` message reports insufficient CPU/memory or exhausted pod capacity; affected pod's resource requests | Adding compatible capacity could resolve the shortage |
| Primary: missing compatible node | Matching scheduling failure; pod selectors, required affinity/anti-affinity, topology spread, tolerations, zones, and volume topology compared with existing capacity | A different node configuration is valid only when the restriction is intentional or preferable to safely relaxing it |
| Primary: stranded or mismatched fixed capacity | Verified bin-packing findings, or minimal pool-floor, node-count, request/utilization, scaling, workload-shape, and cost evidence | Dynamic configurations could serve the same requirements with less stranded total capacity |
| Confidence: persistence/recurrence | Available seven-day scheduling history correlated with event or incident causes | Distinguishes sustained or repeated failures from an isolated incident; it does not establish a primary signal by itself |

Compare the same demand under NAP, CAS tuning, raised pool limits, and an added fixed pool. Prefer NAP only when varying requirements or stranded fixed
capacity create a supported advantage in total cost or operations. Prefer simpler scaling when demand is stable and fits an existing pool. Respect
intentional capacity, availability, reservation, and budget limits.

Do not count a likely stale or unnecessarily hard placement rule as a confirmed primary signal. Route it to [bin-packing analysis](./aks-bin-packing.md) and preserve the rule until its owner confirms that it can be relaxed.

## 4. Conditional Readiness Checks

After identifying a potential primary signal, use the minimal triggered checks in [NAP evidence collection](nap-evidence-collection.md) for VM compatibility, quota, subnet capacity, policy, or volume topology. Reuse collected data and do not perform broad readiness audits.

## 5. Decide

| Verdict | Rule |
|---------|------|
| Recommend | Eligibility and applicable readiness checks pass, a confirmed primary signal persists or recurs, and NAP has a clear advantage over simpler scaling |
| Recommend a limited trial | Eligibility and applicable readiness checks pass and NAP has a clear advantage over simpler scaling, but history is limited. Agree on trial workloads, capacity limits, and success criteria before enablement |
| Insufficient evidence | No confirmed primary signal or missing cause/fit data |
| Do not enable now | Readiness failed or is unknown, migration is unapproved, only non-NAP causes exist, or simpler scaling suffices |

Report the verdict, supporting evidence, affected workloads, source/timeframe, current cost or capacity baseline, expected NAP effect and assumptions,
advantage over simpler scaling, readiness gaps, risk, and confidence.

## 6. Approved Enablement

Only if requested: resolve prerequisites and obtain approval to enable NAP using the default configuration or proposed custom NodePool/AKSNodeClass settings. Explain capacity limits, disruption behavior (including expiration or termination deadlines if proposed), and any required CAS migration. Agree on an observation period, cost and capacity bounds, workload SLOs, success/failure criteria, and rollback before enablement.

For default pools with CAS disabled:

```bash
az aks update \
  --name "<CLUSTER_NAME>" --resource-group "<RESOURCE_GROUP>" \
  --node-provisioning-mode Auto
```

When enabling NAP with custom pools, add `--node-provisioning-default-pools None` to disable default-pool creation, then apply the approved NodePool/AKSNodeClass manifests.

After enablement, verify pending-pod time, provisioned configurations, node count, workload SLOs, and cost against the agreed criteria. Do not remove
fallback fixed capacity until validation succeeds. If criteria fail, stop expansion and use the approved rollback.