# Azure Kubernetes Service (AKS) Cost and Utilization Anomalies

Detect unexplained AKS cost changes or investigate a supplied cluster or
namespace window. Keep billed-cost evidence separate from operational signals.

## Choose Mode

| Request | Mode |
|---|---|
| Did anything unusual happen? | Detect across about 60 complete billing days |
| User supplies a date or window | Investigate that window plus 28-56 preceding days |

Confirm the cluster or namespace, timezone, and exact interval. Use only
complete billing days and report each currency separately.

## Collect Cost Evidence

1. Follow [AKS cost analysis](aks-cost-analysis.md) and the
   [cost query workflow](cost-query/workflow.md). `query_aks_costs` accepts only
   `/subscriptions/{subscriptionId}` and supports daily or monthly granularity,
   not hourly cost attribution.
2. Use billed cost for invoice reconciliation and amortized cost when
   Reservation or Savings Plan allocation affects the operational comparison.
   Preserve the returned metric, period, currency, and coverage.
3. Query cluster allocation first, then the affected cluster and namespaces.
   Separate real namespaces from `#idle charges#`, `#service charges#`,
   `#system charges#`, and `#unallocated charges#`.
4. When resource-level contributors such as VM scale sets, disks, networking,
   or monitoring must be attributed, use the narrowest supported `query_costs`
   call or the approved [fallback process](tools-and-safety.md). Do not assign a
   shared workspace's full cost to one cluster.

Missing add-on data, inaccessible scopes, incomplete days, and absent rows are
unavailable evidence, not zero cost.

## Detect Candidate Windows

Prefer native Cost Management anomaly insights when the available tool exposes
them. Otherwise compare complete daily values with comparable preceding
weekdays. Report expected cost, actual cost, absolute delta, and percentage
delta.

Use the anomaly score returned by native Cost Management anomaly insights when
available, preserving its reported meaning and threshold. Otherwise, report the
absolute and percentage difference from comparable preceding weekdays and describe
the result as a candidate anomaly. For insufficient or strongly seasonal history,
report the limitation instead of forcing a baseline.

## Explain Contributors

Query only candidate and comparable baseline windows:

- Compare namespace allocation and idle/system/service/unallocated categories.
- Identify resource-level cost deltas when the available dimensions support it.
- Compare workload creation and schedules, resource-request or limit changes,
  autoscaler decisions, disruption controls, node-local blockers, and
  scale-down eligibility before and during the candidate window.
- Correlate scaling, upgrades, SKU, node-pool, storage, monitoring, and network
  changes through Resource Graph change history. Validate generated queries
  before execution; empty history is inconclusive.
- Use historical Azure Monitor or Container Insights node count, workload,
  autoscaler, storage, and ingestion evidence when available.
- Treat current Kubernetes metrics only as evidence that a condition persists,
  not as proof of a historical cause.

Distinguish verified from likely contributors, quantify attributable portions
when supported, and report any material unexplained remainder.

## Route Follow-up

| Finding | Handoff |
|---|---|
| Pod rightsizing, VPA, Cluster Autoscaler, or Spot configuration | `azure-kubernetes` |
| NAP readiness or node-pool fragmentation | `aks-cost-optimization` when available |
| PVC/PV-to-Azure storage optimization | `aks-cost-optimization` when available |
| Reservation or Savings Plan effect | `cost-optimization` |
| Namespace allocation unavailable | [AKS enablement](aks-enablement.md) |
| Budget or alert creation | `cost-governance` |

Do not resize pools, change autoscaling, enable add-ons, create alerts, or
modify workloads without the owning workflow's required confirmation.

## Output

For each anomaly, report the period and timezone, baseline method and coverage,
cost metric and currency, expected and actual cost, absolute and percentage
delta, affected cluster/namespaces/resources, verified and likely contributors,
unexplained remainder, evidence gaps, confidence, and next handoff.
