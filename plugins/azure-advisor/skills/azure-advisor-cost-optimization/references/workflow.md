# Advisor cost workflow

## Scope and tools

Run `azure-advisor-cost-user-context` first and reuse its complete scope handoff. Subscription
and Service Group scopes are mutually exclusive. For all-accessible or multi-subscription scope,
pass the complete non-empty subscription ID array. For Service Group scope, pass the complete
resolved group array. Never retry against only the default subscription.

Use only these Advisor operations:

- `advisor_recommendation_summary` for current grouped totals.
- `advisor_recommendation_list` for completed realized-savings reporting, explicit lifecycle-state
  records, and affected resources.
- `advisor_recommendation_update` for confirmed lifecycle changes.
- `advisor_metadata_list` only for the documented display-name fallback.

Across every workflow below, render Advisor money with these exact labels: `Yearly potential savings`
for yearly potential savings, `Accumulated waste` for returned cumulative `Cost`, and
`Realized savings` only for returned completed savings. Preserve `Currency` and `Pricing basis`.
For active recommendation rows, the MCP list contract exposes `yearlyPotentialSavings`; when the
source row contains only `dailyPotentialSavings`, that value is annualized as
`dailyPotentialSavings × 30.4 × 12`. Never render the daily input, and never derive cost from a
timestamp or any other rate.

Current opportunity queries always use `category=Cost` and `sub-category=IdleResources`.
Current summaries use `group-by=recommendation-type`; do not add `status` to the summary.
Use `status=New` on a selected-type expansion list. Pass a requested product family, exact
resource type, threshold, search, limit, or date filter only when the user supplied it.

For completed realized-savings reporting, call list directly with `status=Completed`,
`category=Cost`, and `sub-category=IdleResources`, preserving the resolved scope and filters. Do
not call summary. The list operation does not replace the
requested reporting-period filter server-side; retain completed records, select those whose
`resourceDeletedOn` falls in the requested period, and use only Advisor/ARG-returned monetary
fields for realized savings.
For explicit Postponed or Dismissed reporting in this idle-resource workflow, use list directly
with the requested status and retain `category=Cost` plus `sub-category=IdleResources`. Exclude
unrelated Cost recommendation types.

## Clarification routing

When an `ask_user` call depends on a preceding Advisor result or proposed state, render that
result or state in a visible assistant response first. Never invoke `ask_user` immediately after
an Advisor tool call, and never ask the user to choose from data that has not been displayed. If
no preceding result or proposed state is needed, ask the clarification question directly.

Resolve only missing scope, reporting period for historical savings, savings basis, or explicitly
requested ranking/filter values. For completed-savings reporting without a period, calculate the
current calendar dates, render the resolved scope and date choices, then use one `ask_user` call
with these choices:
`Last quarter (Recommended: <start date> to <end date>)`,
`Last 30 days (<start date> to <end date>)`, and
`A specific period`. The displayed ranges must use the current date and make the date boundaries
explicit. Ask one clarification at a time and preserve values already supplied by the user.

For a broad opening request, do not ask for product family or a savings threshold when the user
has asked for an overall view; return the ranked opportunities first and offer expansion. Ask for
a product family or threshold only when the user explicitly requests that focused or filtered
view.

Deletion language used to estimate savings does not make the request remediation. Route to
actionability only for an actual deletion request, deletion preparation, or remediation artifact.
For artifact requests, use only active (`status=New`) Advisor findings. Do not include
Postponed, Dismissed, or Completed resources in a remediation artifact unless the user starts a
separate lifecycle-specific request. After retrieving the active recommendation type and exact
affected resources, hand off the artifact request to the existing
`azure-advisor-actionability` skill; do not generate the artifact in this cost-analysis skill.
State that the Advisor finding is evidence for the candidate set, not a completed dependency
validation.
Do not call `advisor_recommendation_summary` for this handoff by default. Use
`advisor_recommendation_list` directly with `category=Cost`, `sub-category=IdleResources`,
`status=New`, the resolved scope, and the requested filters. A summary is only appropriate when
the user separately asks for grouped counts or
recommendation-type discovery before selecting an artifact target.
Resolve the recommendation type and affected resources from the user's wording and Advisor
results; do not ask the user for subscription IDs, recommendation type IDs, or resource IDs.
After listing a selected type, render the returned resources visibly, then use `ask_user` with
the returned resource names and an `All resources in this recommendation type` choice. Ask only
the supported artifact-format
questions when needed: instructions, a parameterized template, a populated script, or a
resource list, plus CLI, PowerShell, or infrastructure as code where applicable. Use choices
when the format is known; ask no more than two clarifying questions. Then pass the resolved
resources and context to `azure-advisor-actionability`.

Resolve friendly resource terms through Advisor's supported product-family and metadata mappings.
Do not hardcode provider types, product-family mappings, or exact resource types in the skill.
Do not send `resource-type` unless the user provided one or more fully qualified Azure resource
types; preserve all supplied values.

If the family-filtered summary is empty and the request contains a recognizable recommendation
phrase, use `advisor_metadata_list` to resolve a case-insensitive display-name match to the
stable recommendation type ID, then rerun the Advisor summary or list with that ID. Do not
substitute the recommendation `search` filter: it matches problem text rather than metadata
display names. Keep `category=Cost`, `sub-category=IdleResources`, and the original scope on the
fallback query, and disclose that the name fallback was used.

## Interaction sequence

For completed, postponed, or dismissed lifecycle reporting:

1. Clarify the reporting period when required, then call `advisor_recommendation_list` directly
   with `category=Cost`, `sub-category=IdleResources`, the requested `status`, resolved scope,
   and supplied filters.
2. Filter and calculate the returned records for the requested period, preserving Advisor
   truncation and partial-access metadata. Do not call `advisor_recommendation_summary`.
3. Render the lifecycle results and savings measures with the exact status, currency, pricing
   basis, and resource identity preserved.

For postpone or dismiss actions, resolve the target set before proposing the update. Do not use
summary-first expansion. Call `advisor_recommendation_list` directly with
`status=New`, `category=Cost`, and `sub-category=IdleResources`, group the returned records by
recommendation type, and use `ask_user` with the returned type names as choices. After the type
is selected, show all affected resources with their resource IDs and stable recommendation IDs in
a visible response before asking. Use `ask_user` to choose `Selected resources only (Recommended)`
or `All resources in this recommendation type`. Never offer a cross-type “update all” option.

The existing `advisor_recommendation_update` command updates one stable recommendation ID at a
time. Propose and render a concrete return date for postponement, then use `ask_user` with
`Use this date (Recommended)` or `Choose another date`. For dismissal, render the selected scope
and resources before using one free-text `ask_user` question when no reason was supplied. Show
the complete scope and affected resources in a visible response, then use `ask_user` with
`Confirm these changes` or `Cancel` before each update. Do not apply an ambiguous or broad target
set silently.

For opening requests such as unused, idle, or unnecessary resources:

1. Call the grouped summary first; do not call list in the opening turn.
2. Render the complete scope, estimate, currency totals, and recommendation-type summary as the
   normal response. Use headings, prose, bullets, or a compact table according to what best fits
   the returned data; no table is mandatory.
3. Render both the currency totals section and recommendation-type section, including when only
one recommendation type is returned. Sort comparable recommendation types by yearly potential
savings descending, with unavailable values last. The summary must be rendered as a visible
assistant response before any follow-up tool call. After that visible response, MUST invoke
`ask_user` exactly once to offer expansion. Use the
recommendation-type display names returned by that summary as the choices, and include an
`Expand all recommendation types` choice in every expansion prompt, including when only one
type is returned. Do not invoke `ask_user` before the summary is rendered, call it a second
time for the same discovery response, call an Advisor tool and `ask_user` back-to-back, or
replace the visible summary and question with prose such as "select a type" or "to show more
details".
   Do not call list, render resource rows, or include affected-resource details before the user
   responds. Keep the
   question limited to its text and choices; do not embed the summary in the question. Show
   returned display names as choices, add the expand-all choice, and retain the corresponding exact
   IDs internally.
4. Only after the user selects types, call list once with the selected type ID or IDs and original
   scope and filters. Multiple resource types or recommendation IDs are preserved as supplied and
   match any value within that filter. For expand-all, pass all exact recommendation-type IDs
   returned by the summary so expansion remains limited to that response.

For the selected-type list, do not replay the opening discovery summary. Start with a focused
`## Selected recommendation` heading containing the exact recommendation type and a one-sentence
count. Add one compact scope/pricing line, then a resource table containing `Resource`,
`Resource group`, `Yearly potential savings`, and `Accumulated waste`; include `Currency` and
`Pricing basis` in that line or table caption. Use the MCP annualized value described above and
never add a daily or monthly cost column. Do not show resource rows in the opening summary.

For artifact requests, the preceding opening-request sequence is not used. The sequence is:

1. Resolve scope, then call `advisor_recommendation_list` directly with `status=New`,
   `category=Cost`, `sub-category=IdleResources`, and the resolved scope.
2. Render a compact recommendation-type/count summary visibly, then use `ask_user` with the
   returned type names as choices.
3. List only the selected type with its exact `recommendation-type-id`; then render its resource
   names, groups, complete IDs, Advisor resource types, display name, and stable type ID visibly.
4. Use `ask_user` with the returned resource names and an `All resources in this recommendation
   type` choice to select the exact resources to include. A single returned resource is not
   implicitly selected.
5. Hand the explicitly selected resources and context to `azure-advisor-actionability`.

If a user asks for an artifact after multiple resources are visible and refers to "this one",
"it", or another singular target without identifying a row, pause and ask them to choose the
resource. Never infer the first, highest-savings, or most recently mentioned row. Never generate
an artifact for every returned resource by default. If the user chooses all, keep the action
limited to the already selected recommendation type and preserve the exact scope; never silently
broaden to other recommendation types or subscriptions.

An explicit request for all matching findings uses the broad-list behavior below.

An explicit request for all matching `Cost` / `IdleResources` findings is different: preserve the
existing broad-list behavior and call list without a type-ID filter. Respect the MCP limit and
`AreResultsTruncated`; never call a capped result complete.

Treat authorization failures as partial scope errors, not empty results. Do not invent records or
replace Advisor queries with Cost Management, billing, Resource Graph, or generic inventory.
