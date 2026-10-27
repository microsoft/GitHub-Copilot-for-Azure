# Routing examples

These patterns apply only to Advisor `Cost` / `IdleResources`. Generic Cost, other
subcategories, cross-category, and non-Cost requests stay on `azure-advisor`.

| Request | Route |
|---|---|
| Find unused resources | Resolve scope; existing prioritized summary; visibly show results, then one expansion question |
| Which unused-resource recommendation types occur most often? | Normal summary by recommendation type; preserve record-count order and show complete Cost totals |
| Find unused resources across all subscriptions | Enumerate subscriptions; query explicit same-tenant arrays; show tenant-specific coverage |
| Show idle resources in Commerce SG | Pass Commerce directly as scalar service-group; the tool resolves its name or ID, no separate SG lookup |
| Show all my Service Groups | Explain scope limitation and request one SG identifier; no substitute inventory query |
| Show the highest-priority idle opportunities | Prioritized summary; preserve backend priority order and full Cost totals |
| Show unused App Service plans | Resolve product family or metadata type; list the exact selected type; no resource-selection question for ordinary reading |
| List all active idle findings | List directly with both filters and New; disclose the result cap |
| Estimate savings if I delete it after several rows | Ask which row; use returned retail savings without treating the estimate as deletion approval |
| Create a script to remove these | List active candidates, select exact type/resources, then hand off to actionability |
| Is this safe to delete? | Explain recommendations are not deletion-safety proof; no automated validation tool; selected guidance stays with actionability |
| What did we save last quarter? | Resolve period; Completed summary with from/to; use full realized-savings totals, not a capped list |
| Summarize idle findings as of a supplied date | Completed summary unless another state is explicit; preserve that effective state in list expansion |
| Summarize active/New idle findings as of a supplied date | Explicit New summary overrides the historical default |
| Show completed resources | Completed list details; show authoritative completion/deletion timestamps distinctly |
| Show postponed/dismissed resources | Requested-status list; keep states, reasons, dates and savings measures separate |
| Postpone this one | Select exact record; reuse/propose return date; display proposed batch and confirm before update |
| Dismiss all of these | Limit to selected type/scope and shown targets, reuse/ask reason, confirm once, update each stable ID |
| Show my bill's increase | Billing workflow, not Advisor idle-resource analysis |

Preserve unknowns, exact identities, scope/tenant coverage, and truncation in every route.
Never claim runtime inactivity for an arbitrary duration solely from an Advisor idle signal.
