# AKS Commitment-Demand Handoff

Prepare stable, post-optimization AKS compute demand for commitment analysis.
The optional `azure-cost` plugin owns Reservation and Savings Plan utilization,
coverage, expiry, recommendations, economics, and purchasing guidance.
This workflow supplies verified AKS context; it does not calculate or purchase
a commitment.

Do not use this workflow as the entry point for a direct Reservation or Savings
Plan request. Invoke `cost-optimization` for that request. Use this preparation
only after an AKS optimization assessment could materially change steady node
demand.

## Preconditions

Complete applicable rightsizing, autoscaler, NAP, and bin-packing analysis.
Confirm the cluster, representative lookback, planned SKU/region/architecture
changes, and whether associated Capacity Reservation Group (CRG) quantities
will remain required.

## Collect AKS Demand

1. Use a fitting host-advertised Azure MCP AKS read, or an approved `az aks
   show` fallback, to collect the node resource group and pools with VM size,
   current/min/max count, autoscaling, Spot priority, CRG association, and
   upgrade surge. Map each pool to its exact VMSS or VM resource IDs; verify the
   mapping from pool metadata rather than names alone.
2. Exclude Spot capacity from stable commitment demand.
3. Reuse representative node history. Otherwise, if Container Insights is
   available, query hourly node counts by pool over 30-60 days and summarize
   observed hours, minimum, p05, p50, p95, and maximum nodes. For candidate
   baseline counts, report hours at or above the count and the percentage of
   observed hours covered. These values are evidence, not purchase quantities.
   Missing history means stable demand is unknown.
4. Query associated CRGs through Resource Graph. Keep SKU, region, zone,
   reserved, associated, unused, and planned retained quantities separate from
   discount benefits. Unused CRG capacity remains billable.
5. Account for approved rightsizing, consolidation, NAP, migration, and
   reliability changes before calculating the demand handoff. Record seasonal,
   temporary, maintenance-surge, outage, and planned growth or decline periods
   that make the lookback unrepresentative.

## Handoff

Provide `cost-optimization` with:

| Field | Content |
|---|---|
| AKS scope | Cluster ID, node resource group, region |
| Compute mapping | Pool, exact VMSS/VM resource IDs, VM size, region, priority |
| Continuous baseline | Candidate non-Spot node counts, hours covered, coverage percentage, p05/p50/p95, lookback |
| Variability | Peak, seasonal, temporary, surge, outage, and planned-demand exceptions |
| Planned changes | Rightsizing, consolidation, NAP, migration, SKU/region changes |
| Capacity reservations | CRG reserved, associated, unused, and retained quantities |
| Evidence gaps | Missing history, inaccessible pools, or unresolved owner intent |

Ask `cost-optimization` to:

- evaluate existing utilization, coverage, scope, expiration, and renewal state;
- retrieve Azure-generated Reservation and Savings Plan recommendations;
- correlate recommendations with exact AKS compute mappings while disclosing
  benefits or recommendations that span a broader scope;
- account for approved AKS changes before presenting a commitment option; and
- return term, scope, coverage, expected utilization, reported savings and
  currency, assumptions, risks, and next review date.

Do not query benefit APIs, calculate commitment economics, recommend a purchase
quantity, or claim an expiry/renewal action in this AKS workflow. The owning
`cost-optimization` workflow may execute an approved Savings Plan purchase or
renewal only after its own validation and exact-term confirmation. If
`cost-optimization` is unavailable, return the demand evidence and state that
commitment analysis is unavailable.
