---
name: azure-advisor
description: "Use Azure Advisor recommendations. For idle-resource cost requests, route through azure-advisor-cost-user-context and azure-advisor-cost-optimization; use the generic Advisor operations for all other recommendation categories. WHEN: \"show Advisor recommendations\", \"service retirements\", \"update recommendation status\". DO NOT USE FOR: fixes or remediation (use azure-advisor-actionability)."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure Advisor

## Quick reference

Prefer Azure Advisor MCP tools over Resource Graph or generic ARM tools.

| Intent | Tool |
|---|---|
| Counts, breakdowns, rankings, or top types | `advisor_recommendation_summary` |
| Individual recommendations or affected resources | `advisor_recommendation_list` |
| Complete, dismiss, postpone, or reactivate | `advisor_recommendation_update` |
| Browse recommendation types | `advisor_metadata_list` |
| Get one type by ID | `advisor_metadata_get` |
| Retrieve remediation | `advisor_remediation_get`, then `azure-advisor-actionability` |
| Resolve Advisor cost scope | `azure-advisor-cost-user-context` |
| Analyze Advisor cost or idle resources | `azure-advisor-cost-optimization` |

## Workflow

1. Identify subscription or service-group scope. Resource-group scope requires a subscription.
2. Reuse known scope and identifiers; ask only for missing values.
3. Use `summary` for aggregates and `list` for records. Never count a capped list.
4. For idle-resource cost requests, resolve scope with `azure-advisor-cost-user-context`, then
   use `azure-advisor-cost-optimization` before calling recommendation tools. For all other
   recommendation categories, preserve the requested category and use the generic Advisor
   summary or list operation instead of silently adding `sub-category=IdleResources`.
5. Present only returned data, including truncation, access limitations, and errors.

Route requests to fix one recommendation to the `azure-advisor-actionability` skill. Otherwise choose the tool from the table, including `summary` or `list` for service retirements.

## Safety

Confirm before recommendation-state updates. The actionability skill owns remediation safeguards.
