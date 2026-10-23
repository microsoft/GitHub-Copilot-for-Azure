---
name: azure-advisor
description: "Use Azure Advisor recommendations. Route only Cost recommendations in the IdleResources subcategory through azure-advisor-cost-user-context and azure-advisor-cost-optimization; keep generic Cost, prioritized Cost, cross-category, and other recommendation requests on the generic Advisor operations. WHEN: \"show Advisor recommendations\", \"service retirements\", \"update recommendation status\". DO NOT USE FOR: fixes or remediation (use azure-advisor-actionability)."
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
| Analyze Advisor `Cost` recommendations in the `IdleResources` subcategory | `azure-advisor-cost-optimization` |

## Workflow

1. Identify subscription or service-group scope. Resource-group scope requires a subscription.
2. Reuse known scope and identifiers; ask only for missing values.
3. Use `summary` for aggregates and `list` for records. Never count a capped list.
4. Only for the combined filter `category=Cost` and `sub-category=IdleResources`, resolve scope
   with `azure-advisor-cost-user-context`, then use `azure-advisor-cost-optimization` before
   calling recommendation tools. Generic Cost requests, prioritized Cost requests that do not
   explicitly target `IdleResources`, and cross-category requests remain on the generic Advisor
   summary or list operation. Preserve the requested category and subcategory; never silently add
   `sub-category=IdleResources`.
5. Present only returned data, including truncation, access limitations, and errors.
6. When showing a prioritized, ranked, or top list of recommendations, show each item's returned
   yearly potential savings alongside it, including currency and pricing basis when available.
   Use `Unavailable` when Advisor returned no savings value; never show zero or estimate a value.

Route requests to fix one recommendation to the `azure-advisor-actionability` skill. Otherwise choose the tool from the table, including `summary` or `list` for service retirements.

## Safety

Confirm before recommendation-state updates. The actionability skill owns remediation safeguards.
