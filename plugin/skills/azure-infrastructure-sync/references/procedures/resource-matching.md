# Resource Matching Rules

Algorithm for matching resources across two models (diagram ↔ Azure, diagram ↔ Bicep, Bicep ↔ Azure). Referenced by all sync and comparison skills.

---

## Matching Algorithm

Apply rules in order. Stop at the first match.

| # | Rule | Result |
|---|------|--------|
| 1 | Type AND name match (case-insensitive) | **In Sync** |
| 2 | Type matches AND only ONE resource of that type exists in EACH model | **In Sync (name differs)** — report both names |
| 3 | Type matches AND multiple exist → name has case-insensitive substring match or Levenshtein distance ≤ 3 | **In Sync (name differs)** |
| 4 | Exists in Model A only | **Model A Only** (e.g., "Diagram Only", "Bicep Only", "Azure Only") |
| 5 | Exists in Model B only | **Model B Only** |

## Child Resource Matching

- Match child resources within their parent context (e.g., subnet `default` within VNet `vnet-01`)
- Resource Groups, VNets, and Subnets are compared as regular resources

## Container Resource Handling

- A VNet container in a diagram matches a `Microsoft.Network/virtualNetworks` resource
- A Subnet container in a diagram matches a `Microsoft.Network/virtualNetworks/subnets` resource
- Resource Group containers scope the comparison but are not themselves reported as drift

## Conditional Resources

- Resources in Bicep with an `if` condition are matched normally but flagged as "conditional" in reports

## Status Indicators

| Status | Indicator |
|---|---|
| In Sync | ✅ |
| In Sync (name differs) | ✅ (with note) |
| Diagram Only / Bicep Only | ⬜ |
| Azure Only | 🔷 |
