---
name: cost-estimation
description: "Forecast Azure spend and price planned resources or workloads. WHEN: \"forecast Azure spending\", \"project next month cost\", \"compare forecast to my planning target\", \"how much will Azure cost\", \"estimate VM cost\", \"compare storage tiers\", \"compare Azure regions\", \"retail price\", \"EA rate card\", \"negotiated pricesheet\". DO NOT USE FOR: configured budget health or alerts, bill analysis, cost spikes, rightsizing, or commitments."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure Cost Estimation

## Quick Reference

| Intent | Workflow | Primary tools |
|--------|----------|---------------|
| Forecast existing spend | [Cost forecast](references/cost-forecast/workflow.md) | `forecast_costs` |
| Price planned resources | [Pricing estimate](references/pricing-estimate.md) | Pricing tools |

## When to Use This Skill

Use for forecasts, hypothetical pricing, or planning targets. Configured budget
resources and alerts belong to `cost-governance`; historical decomposition
belongs to `cost-analysis`.

## MCP Tools

| Tool | Use |
|------|-----|
| `forecast_costs` | Forecast an existing Azure scope. |
| `get_retail_prices` | Retrieve public SKU and meter prices. |
| Pricesheet tools | Retrieve negotiated EA or MCA prices asynchronously. |

## Workflow

1. Distinguish forecasts from hypothetical pricing.
2. Confirm scope, assumptions, period, region, OS, and currency.
3. Load the matching workflow and label every value type.

## Error Handling

| Error | Action |
|-------|--------|
| Ambiguous meter | Ask for OS, term, tier, or usage shape. |
| Forecast unavailable | Explain the history requirement. |
| Pricesheet pending | Honor the returned polling interval. |
| Multiple currencies | Never combine currencies. |
| MCP server error | Retry once; then stop and report the trace ID. |
