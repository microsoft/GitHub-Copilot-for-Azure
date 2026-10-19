---
name: azure-advisor-cost-optimization
description: "Analyze Azure Advisor idle-resource recommendations, savings, lifecycle actions, and remediation candidates. WHEN: unused Azure resources, idle resources, unattached disks, empty App Service plans, Advisor cost findings, wasted Azure cost, completed savings, scripts, IaC, pipelines, postpone, or dismiss."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure Advisor Cost Optimization

Use only after `azure-advisor-cost-user-context` resolves scope. Use Advisor-owned operations and
preserve scope, status, currency, pricing basis, truncation, and unavailable values. Do not
substitute billing, Cost Management, generic inventory, or runtime KQL.

## Quick reference

- **Current discovery:** call `advisor_recommendation_summary` with `category=Cost`,
  `sub-category=IdleResources`, and `group-by=recommendation-type`. After the tool returns,
  first emit a visible assistant summary with `Scope`, `Advisor found`, `Savings`, and
  `Recommendation types`; only then ask exactly one expansion question. Never invoke
  `ask_user` immediately after the summary tool call or before the summary text is visible.
  List resources only after type selection.
- **Expansion and artifacts:** use `advisor_recommendation_list` with
  `category=Cost`, `sub-category=IdleResources`, and `status=New`; require explicit type and
  resource selection. Only explicitly selected resources may be handed to
  `azure-advisor-actionability`.
- **Lifecycle:** use `advisor_recommendation_list` with `category=Cost`,
  `sub-category=IdleResources`, and the requested `Completed`, `Postponed`, or `Dismissed`
  status. Use `advisor_recommendation_update` only after explicit confirmation.
- **Cost labels:** use `Yearly potential savings`, `Accumulated waste`, and `Realized savings`
  exactly.
  For active recommendation rows, use the MCP-provided yearly value. When the MCP response
  contains only `dailyPotentialSavings`, the MCP contract annualizes it as
  `dailyPotentialSavings × 30.4 × 12`; never render the daily input. Do not infer any other
  period or replacement value.
- **Responses:** render every tool result visibly before asking a question. Keep recommendation
  types and lifecycle states separate; preserve exact Advisor identity and unavailable values.

Read the focused contracts before responding:

- [`references/workflow.md`](references/workflow.md)
- [`references/tools-and-recovery.md`](references/tools-and-recovery.md)
- [`references/examples.md`](references/examples.md)
- [`references/output-and-savings.md`](references/output-and-savings.md)
- [`references/lifecycle.md`](references/lifecycle.md)
