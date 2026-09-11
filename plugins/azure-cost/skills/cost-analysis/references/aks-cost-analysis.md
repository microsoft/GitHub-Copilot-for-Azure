# AKS Cost Analysis

1. Use Resource Graph to list AKS clusters and inspect
   `properties.metricsProfile.costAnalysis.enabled`. Validate every generated
   query and follow `skipToken` pages.
2. If cost analysis is disabled, load [AKS enablement](aks-enablement.md).
   Missing add-on data is unavailable data, not zero spend.
3. Call `query_aks_costs` grouped by cluster for month-to-date with `top` set to
   5000. If empty early in the billing cycle, retry the last full month and
   label the period. If 5000 rows are returned, narrow the query and disclose
   that the first result may be incomplete.
4. For the top clusters, query the same period grouped by cluster and namespace.
   Use the full cluster ARM resource ID when filtering.
5. Separate real namespaces from `#idle charges#`, `#service charges#`,
   `#system charges#`, and `#unallocated charges#`. Report allocated, idle, and
   overhead spend without treating category rows as deletable workloads.
6. Rank clusters and namespaces, identify ownership, and hand idle-capacity
   remediation to `cost-optimization`.

For a time-specific cluster spike, load
[AKS anomaly investigation](aks-anomaly.md). Confirm namespace ownership before
chargeback attribution.
