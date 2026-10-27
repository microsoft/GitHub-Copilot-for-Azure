# Generic Advisor workflow

For combined Cost/IdleResources, use `azure-advisor-cost-optimization`, including its scope
phase and response templates. Do not mix generic layouts into that flow.
Generic Cost, prioritized Cost outside IdleResources, cross-category and other requests use
this workflow. Preserve requested filters; never silently add IdleResources.

## Scope and operation

Reuse known identifiers. Use one or more same-tenant subscriptions, or one supplied Service
Group; never combine these scope families. Resource-group scope requires a subscription.
Read tools accept subscription names/IDs and same-tenant `subscriptions` arrays; aliases are
queried once. Pass supplied SG names, identifiers or full ARM IDs unchanged as scalar
`service-group`; the tool resolves them. Ask only for missing values.

Use summary for aggregates/rankings and list for individual records, including service
retirements. Never infer full totals from a capped list. Browse types with
`advisor_metadata_list`, or fetch a known type with `advisor_metadata_get`.
For remediation, use `azure-advisor-actionability`, which retrieves `advisor_remediation_get`
and owns remediation safeguards. Confirm before recommendation-state updates.

## Filters and lifecycle

An explicit status wins. Otherwise historical summary inputs (`as-of`, `from`, `to`, supported
for Cost) default to Completed. Without historical inputs, status grouping includes all states;
other summaries default to New. List defaults to New: pass the effective summary status
explicitly when drilling down, without summary-only dates.

Preserve `product-family` with `prioritized=true`. Prioritized summary groups by type;
prioritized list requires one scalar `recommendation-type-id`. Plural type/resource filters
use OR semantics.

## Presentation

Only present returned data; disclose truncation, access limitations and failures.
Preserve priority order for ranked/top results. Show returned yearly potential savings,
or realized savings for completed Cost recommendations, with currency and pricing basis
when available. Missing savings are `Unavailable`, never zero or an invented estimate.

Use the calculation source: documented retail-derived values are Retail, including older
responses missing basis metadata. Supported contractual-derived calculations are Contractual.
Keep calculated bases separate; unrelated raw pricing does not identify a calculation basis.

On every model, including Auto, visibly display results or proposals before dependent
questions. Reasoning, tool output and content only inside `ask_user` do not count.
Missing-input questions may be asked directly.

Initially show at most 15 table rows. Include all further returned rows in nested inline
`<details>` / `<summary>` sections, up to 15 per section, with the same columns and `Show N more`
labels. Display pagination requires neither questions nor tool calls. Keep server truncation
distinct from collapsed content.
