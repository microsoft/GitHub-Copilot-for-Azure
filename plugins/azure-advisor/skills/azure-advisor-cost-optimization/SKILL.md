---
name: azure-advisor-cost-optimization
description: "Analyze Azure Advisor Cost/IdleResources findings and prevalidate deletion safety, including Service Groups. WHEN: \"find unused Azure resources\", \"what resources am I paying for but no longer using\", \"idle-resource savings\", \"historical idle-resource savings\", \"are these idle resources safe to delete\". Generic Cost, other subcategories, and cross-category requests use azure-advisor."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure Advisor Cost Optimization

Use existing Advisor tools only with `category=Cost` and `sub-category=IdleResources`.
Never substitute billing, inventory or runtime KQL. Pass supplied identities unchanged.

## Workflow

Before calls or reporting supplied results, read [Workflow](references/workflow.md) and
[Output and savings](references/output-and-savings.md). Before scoped calls, read
[Scope resolution](references/scope-resolution.md). Reuse already loaded references.
If a required file is unavailable, report it and stop the affected flow.

Use the matching scenario guidance; [Reference index](references/README.md).

## Quick reference

| Flow | Required reference |
|---|---|
| Tables and selected resources | [Table format](references/table-format.md) |
| Completed/historical reports | [Lifecycle](references/lifecycle.md) |
| State changes | [State updates](references/state-updates.md) |
| Selection/remediation handoff | [Selection](references/selection-and-handoff.md) |
| Explicit prevalidation/safety checks | [Selection](references/selection-and-handoff.md#read-only-prevalidation) |
| Filters/errors | [Tools and recovery](references/tools-and-recovery.md) |
| Routing examples | [Examples](references/examples.md) |

## Response guidance

Use shared headings and column order across models, with documented scope/lifecycle variations.
Visibly show results/proposals before dependent questions; reasoning, tool output or text
inside `ask_user` does not count. Ask directly for missing input.
