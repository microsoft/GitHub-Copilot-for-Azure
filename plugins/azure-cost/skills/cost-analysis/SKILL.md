---
name: cost-analysis
description: "Analyze actual Azure spend, bill changes, and AKS or AI costs. WHEN: \"Azure cost breakdown\", \"most expensive resources\", \"why did my bill increase\", \"cost spike\", \"unexpected charge\", \"Cosmos DB charges\", \"Foundry model costs\", \"AKS cluster cost\", \"namespace cost\", \"enable AKS cost analysis\", \"idle AKS capacity\". DO NOT USE FOR: forecasts, pricing estimates, rightsizing, commitments, or budgets."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure Cost Analysis

## Quick Reference

| Intent | Workflow | Primary tools |
|--------|----------|---------------|
| Query historical spend | [Cost query](references/cost-query/workflow.md) | `query_costs` |
| Explain a spike | [Cost investigation](references/cost-investigation.md) | `query_costs`, Resource Graph |
| Analyze AKS spend | [AKS cost analysis](references/aks-cost-analysis.md) | `query_aks_costs`, Resource Graph |
| Analyze AI service spend | [AI cost analysis](references/ai-cost-analysis.md) | `query_costs` |

## When to Use This Skill

Use for spend, anomalies, AKS or AI cost allocation, and AKS namespace cost
visibility. Analyze before handing remediation to `cost-optimization`.

## MCP Tools

Use `query_costs`, `query_aks_costs`, and Resource Graph. Never use non-MCP
fallbacks; apply the [shared safety guidance](references/tools-and-safety.md).

## Workflow

1. Confirm scope, period, currency, and breakdown.
2. Load only the matching workflow above.
3. Respect row limits and label incomplete data.
4. Separate measured cost from inferred causes and recommendations.

## Error Handling

| Error | Action |
|-------|--------|
| Access denied | Name the required scope and role. |
| Empty result | Distinguish no data from unavailable data. |
| Multiple currencies | Report each currency separately. |
| Server error | Retry once; then stop with the trace ID. |
