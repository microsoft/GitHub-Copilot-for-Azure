---
name: cost-optimization
description: "Optimize existing Azure resources and analyze Reservations or Savings Plans. WHEN: \"optimize Azure costs\", \"reduce cloud spending\", \"rightsize resources\", \"find idle resources\", \"orphaned disk\", \"deleted VM still charged\", \"public IP still charging\", \"reservation utilization\", \"Savings Plan coverage\", \"commitment recommendation\", \"why is pay-as-you-go still charged\". DO NOT USE FOR: cost spikes, forecasts, pricing estimates, budgets, or governance."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure Cost Optimization

## Quick Reference

| Intent | Workflow | Primary tools |
|--------|----------|---------------|
| Reduce waste or rightsize | [Optimization](references/optimization.md) | `query_costs`, `generate_query`, `validate_query`, `execute_query` |
| Review commitments | [Commitments](references/commitments.md) | `list_benefit_utilization`, `list_reservation_transactions`, `get_benefit_recommendations` |

## When to Use This Skill

Use for waste, rightsizing, Reservations, or Savings Plans.

## MCP Tools

Use `query_costs` for baselines, Resource Graph for inventory and Advisor, and
benefit tools for commitments. Validate every generated query.

## Workflow

1. Confirm scope, period, currency, and commitment intent.
2. Load only the matching workflow above.
3. Separate measured cost, reported savings, and qualitative opportunities.
4. Recommend changes only; do not delete, resize, purchase, or deploy resources.

## Error Handling

| Error | Action |
|-------|--------|
| Access denied | Name the scope and permission. |
| Multiple currencies | Group and report each currency separately. |
| Missing evidence | State the gap; do not invent values. |
| Throttled or server error | Retry once after the longest delay; then stop and report the trace ID. |
