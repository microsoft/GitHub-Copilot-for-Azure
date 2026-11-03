---
name: azure-advisor
description: "Use Azure Advisor recommendations. Route unused-resource discovery and Cost recommendations in the IdleResources subcategory through azure-advisor-cost-optimization, including its scope-resolution phase; keep generic Cost, prioritized Cost, cross-category, and other recommendation requests on the generic Advisor operations. WHEN: \"show Advisor recommendations\", \"service retirements\", \"update recommendation status\". DO NOT USE FOR: fixes or remediation (use azure-advisor-actionability)."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure Advisor

Prefer Advisor MCP tools over Resource Graph or generic ARM calls.
Reuse supplied scope and identifiers; ask only for missing input.

## Quick reference

| Intent | Existing tool |
|---|---|
| Counts, breakdowns, rankings, or top types | `advisor_recommendation_summary` |
| Individual recommendations or affected resources | `advisor_recommendation_list` |
| Complete, dismiss, postpone, or reactivate | `advisor_recommendation_update` |
| Browse recommendation types | `advisor_metadata_list` |
| Get one type by ID | `advisor_metadata_get` |
| Retrieve remediation | `advisor_remediation_get`, then `azure-advisor-actionability` |

## Workflow

- For unused-resource discovery, including "what are we paying for that is no longer
  being used", or combined `category=Cost` and `sub-category=IdleResources`, load
  `azure-advisor-cost-optimization` first. It owns scope, sequencing and response templates;
  broad discovery must not skip to resource details.
- Generic/prioritized Cost outside IdleResources, cross-category and other requests stay here.
  Preserve requested filters; never silently add IdleResources.
- Before generic calls or reporting, read [Workflow](references/workflow.md).
- For remediation, load `azure-advisor-actionability`; it owns execution safeguards.

On every model, visibly present results/proposals before dependent questions.
Confirm before state updates. Missing data stays `Unavailable`, not zero.
