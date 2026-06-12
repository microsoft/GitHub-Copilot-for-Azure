# Diagram ↔ Azure Sync Workflow (Deep Mode)

Property-level comparison between a Draw.io diagram and live Azure. Extends quick mode with detailed configuration drift detection.

---

## Steps

| # | Action | Details |
|---|--------|---------|
| 1 | **Authenticate** | Verify Azure session — see [azure-authentication.md](procedures/azure-authentication.md). **HARD GATE**. |
| 2 | **Accept Inputs** | Get: Draw.io file path, Azure scope. Depth is `deep`. |
| 3 | **Parse Diagram** | Apply [diagram-parsing.md](procedures/diagram-parsing.md). Extract resource properties from diagram labels and metadata. |
| 4 | **Discover Azure Resources** | Query live resources. Apply [resource-filtering.md](procedures/resource-filtering.md). |
| 5 | **Retrieve Azure Properties** | For each matched resource, fetch full properties using [azure-resource-configs.md](azure-resource-configs.md) field paths. |
| 6 | **Match Resources** | Apply [resource-matching.md](procedures/resource-matching.md). |
| 7 | **Compare Properties** | For matched resources, compare each tracked property. Apply normalization rules (below). |
| 8 | **Classify Drift** | Assign severity: Critical (security), High (functionality), Medium (performance), Low (cosmetic). |
| 9 | **Present Drift Report** | Show resource-level status plus property-level diffs for matched resources. |
| 10 | **Offer Resolution** | Update diagram / Update Azure / Selective / Resolve property drifts / No action. |

## Normalization Rules

Apply before comparing property values:

| Rule | Example |
|---|---|
| Case-insensitive enums | `"Standard"` == `"standard"` |
| Boolean normalization | `"true"` == `true`, `"1"` == `true` |
| Empty collection equivalence | `[]` == `null` == absent |
| Region normalization | `"East US"` == `"eastus"` |
| Numeric strings | `"2"` == `2` |
| Trailing slash removal | `"/subscriptions/.../foo/"` == `"/subscriptions/.../foo"` |

## Severity Classification

| Severity | Examples |
|---|---|
| Critical | `publicNetworkAccess` changed, TLS version downgraded, RBAC disabled |
| High | SKU tier changed, replica count differs, runtime version mismatch |
| Medium | Redundancy level differs, capacity changed |
| Low | Tag differences, display name differences |
