# Output and savings

Use this opening summary format for every Cost + IdleResources discovery response. Keep the
headings and table columns in this order; do not replace it with an abbreviated free-form variant:

```text
## Scope
<resolved subscription(s) or Service Group(s)> · <coverage> · <pricing basis> · Advisor estimates, not invoices

## Advisor found
<affected-resource count> affected resources across <recommendation type count> recommendation types.

## Savings
- Yearly potential savings: <amount>
- Accumulated waste: <amount>
- Currency: <currency>
- Pricing basis: <basis>

## Recommendation types
| Recommendation type | Affected resources | Yearly potential savings | Accumulated waste |
|---|---:|---:|---:|
| <exact Advisor display name> | <count> | <amount>/year | <amount> |
```

Identify the exact resolved subscription(s) or Service Group(s) in the scope statement; do not
rely on a resource group or resource ID alone. For broad scope, state queried, successful, failed,
complete, partial, or truncated coverage. State the returned pricing basis and that figures are
Advisor estimates, not invoices or actual spend.
Display friendly subscription names in scope text and resource tables. Retain subscription IDs
internally for filtering and follow-up calls, and use an ID as the visible fallback only when the
subscription name is unavailable.

For current opportunities and active resource lists, use only these monetary labels:
`Yearly potential savings` and `Accumulated waste` for Advisor's cumulative
`Cost`. Never render `daily cost`, `per-day cost`, `monthly cost`, `ongoing cost`, or
`estimated daily cost`. For active recommendation rows, the MCP list contract annualizes
`dailyPotentialSavings` as `dailyPotentialSavings × 30.4 × 12` and returns it as
`yearlyPotentialSavings`; render only that yearly field. Never derive a value from a timestamp or
any other rate. "All cost fields yearly" means no daily presentation; `Accumulated waste` remains a
cumulative Advisor measure and must not be relabeled as yearly savings.

Do not add source links to summary, recommendation-list, lifecycle, or cost-analysis responses.
Source links are reserved for the `azure-advisor-actionability` response and must come only from
the remediation result or its documented Microsoft Learn fallback.

## Response contract

Use the fixed discovery format above. Do not expose raw tool output or make the user reconstruct
the conclusion from fields.

Use this order when relevant:

1. **Scope** — resolved subscription or service group, coverage, and pricing basis.
2. **Result** — one sentence stating what Advisor found or what was reported.
3. **Organization** — lifecycle state, recommendation type, or resource grouping.
4. **Evidence** — returned resources and Advisor measures needed for the decision.
5. **Savings** — potential, accumulated waste, and realized savings kept separate.
6. **Next step** — one focused action or confirmation.

Omit a section when it adds no value. A focused follow-up should start with the requested result
instead of replaying the opening response. Keep user-facing choices limited to the next valid
action and retain Advisor IDs internally.

### Required fields by flow

| Flow | Required visible fields |
|---|---|
| Current discovery | `Scope` with subscription(s) or Service Group(s), `Advisor found`, `Savings`, `Recommendation type`, `Affected resources`, `Yearly potential savings`, `Accumulated waste`, `Currency`, `Pricing basis` |
| Selected-type list | `Scope` with subscription(s) or Service Group(s), exact `Recommendation type`, `Resource`, `Subscription`, `Resource group`, `Yearly potential savings`, `Accumulated waste`, `Currency`, `Pricing basis` |
| Completed lifecycle | lifecycle state, `Scope` with subscription(s) or Service Group(s), `Recommendation type`, `Completed resources`, `Realized savings`, resource identity, `Currency`, `Pricing basis`, completion date when returned |
| Postponed or dismissed lifecycle | lifecycle state, `Scope` with subscription(s) or Service Group(s), `Recommendation type`, resource count, `Yearly potential savings`, `Accumulated waste`, resource identity, `Currency`, `Pricing basis` |
| Artifact handoff | exact selected resources and identity; preserve annual/cumulative values when returned; never add a daily or monthly conversion |

If a required field is not returned, write `Unavailable`; do not omit it, substitute zero, or
calculate a replacement other than the MCP-defined daily-to-yearly conversion above.

### Format selection

- **One resource or one recommendation type:** use a short paragraph followed by labeled lines or
  a resource card.
- **A few related resources:** use bullets or cards when each item needs explanation.
- **Several comparable resources or types:** use a compact table only if comparison is clearer.
- **Many resources:** show grouped counts and totals first, then the highest-value or selected
  items; state how many remain and offer expansion. Do not silently truncate.
- **Multiple lifecycle states:** use separate state sections, then recommendation type sections.
  Never flatten states into one unlabeled total.

Do not use a table merely because multiple rows exist. Do not use cards or prose to hide required
comparison fields. Preserve the exact Advisor values in whichever format is chosen.

### Ordering

Sort every comparable recommendation type and resource result by the most relevant returned
savings measure in descending order. This ordering is mandatory for the rendered discovery
summary, not just an internal preference:

- `New`, current opportunities, and artifact candidates: **yearly potential savings** descending.
- `Postponed` and `Dismissed`: **yearly potential savings** descending.
- `Completed`: **realized savings** descending.

For mixed lifecycle requests, sort within each lifecycle-state section using that state's measure;
do not compare unlike measures across states. Preserve Advisor/tool order for ties, and place
records with an unavailable primary measure after records with numeric values. Do not sort by
accumulated waste unless the user explicitly asks for an accumulated-waste ranking.

## Readability

Lead with the result in one sentence, then provide only the supporting details needed for the
next decision. Use plain-language headings and short labeled lines:

```text
## Scope
Commerce service group · 4 subscriptions queried · Advisor coverage complete

## Advisor found
4 unused App Service plans with $7,247.55/year in potential savings.

## Savings
- Potential savings: $7,247.55/year
- Accumulated waste: $2,103.80
- Pricing basis: Retail · Currency: USD

## Next step
Choose a plan to inspect, or expand another recommendation type.
```

Do not repeat the same amount in several paragraphs. Explain `Cost` as "accumulated waste"
the first time it appears. Put long resource IDs in a dedicated line only when needed for
selection or confirmation. Keep recommendation names and resource names human-readable; keep
stable Advisor IDs internal unless the user is confirming or requesting an artifact. End with one
clear next step, not a list of unrelated offers.

## Optional comparison tables

When a table is useful, use it for comparison—not for carrying every field returned by Advisor.
Make it visually scannable:

- Use a short title above each table, such as `Top opportunities` or `Selected resources`.
- Keep one table focused on one purpose. Do not combine scope, lifecycle, identity, and every
  savings measure in one wide table.
- Use friendly column names: `Plan`, `Resource group`, `Yearly potential savings`, `Accumulated waste`,
  `Status`, and `Pricing`.
- Format monetary values consistently with currency symbols and two decimal places where the
  returned value supports it. Keep the currency code in the table caption or pricing column.
- Sort opportunity and resource comparisons using the ordering rules above, preserving Advisor
  order for ties.
- Use `—` for a measure that does not apply and `Unavailable` when Advisor did not return it.
  Preserve an explicit numeric zero returned by Advisor as `$0`; never use zero as a substitute
  for a missing, invalid, or unavailable value.
- Keep resource IDs out of comparison tables when they make the table too wide. Show the friendly
  resource name in the table and provide the full ID in a detail line below the selected row or
  during confirmation.
- For more than eight rows, show the highest-value rows first, state how many more exist, and
  offer expansion. Do not silently truncate a result.
- For multiple lifecycle states, use separate state sections and separate tables. Add a small
  `State` column only when the user explicitly asks for a cross-state comparison.

Preferred comparison shape:

| Opportunity | Resources | Yearly potential savings | Accumulated waste | Pricing |
|---|---:|---:|---:|---|
| Unused App Service plans | 4 | $7,247.55 | $2,103.80 | USD · Retail |

Preferred resource shape:

| Plan | Resource group | Yearly potential savings | Accumulated waste | Status |
|---|---|---:|---:|---|
| `asp-cxoaiagent-test-wu3` | `rg-cxoaiagent-test` | $875.52 | $297.60 | New |

After the table, show details only for the selected row:

> **Selected plan:** `asp-cxoaiagent-test-wu3`
> **Resource ID:** `/subscriptions/.../serverfarms/asp-cxoaiagent-test-wu3`
> **Advisor resource type:** `Microsoft.Web/serverfarms`

For lifecycle reporting, keep the same visual pattern and repeat the resolved subscription(s) or
Service Group(s) in the scope or table heading, but change the measure labels to match the
state: `Realized savings` for Completed, or `Yearly potential savings` and `Accumulated waste` for
Postponed and Dismissed. Do not force irrelevant columns into the table.

## Current summary

Use a currency totals section and a ranked recommendation-type section. Render them as prose,
bullets, or compact tables according to readability. Keep currencies separate and do not add a
synthetic total row. Show yearly potential savings only. In any `Recommendation type` label, show
the exact MCP-returned display name as the label prefix; do not paraphrase, shorten, or derive it.
Append the returned affected-resource count and yearly potential savings to ranked or prioritized
labels, using `Unavailable` when Advisor returned no savings value. Retain the exact
recommendation type ID internally for the expansion request and use the display name prefix as
the interactive choice label. Include active affected-resource count, currency, pricing basis,
yearly potential savings, and accumulated waste when returned.
Describe aggregate counts as `<affected-resource count> affected resources across <recommendation
type count> recommendation types`; never call the affected-resource count an active-recommendation
count. Omit resource rows until expansion.

Normal opening cost summaries and non-status groupings represent active `New` recommendations
only. When the user explicitly requests `--group-by status`, the summary includes every Advisor
lifecycle state, including `New`, `Completed`, `Dismissed`, and `Postponed`; keep those state
counts separate rather than presenting them as current active opportunities. The Advisor command
rejects `--product-family` together with `--prioritized true`; explain that limitation and do not
call the rejected combination.

The opening response for a current opportunity request must follow this order:

```text
## Scope
<resolved subscription(s) or Service Group(s)> · <coverage> · <pricing basis> · Advisor estimates, not invoices

## Advisor found
<affected-resource count> affected resources across <recommendation type count> recommendation types.

## Savings
- Yearly potential savings: <amount>
- Accumulated waste: <amount>
- Currency: <currency>
- Pricing basis: <basis>

## Recommendation types
| Recommendation type | Affected resources | Yearly potential savings | Accumulated waste |
|---|---:|---:|---:|
| <exact Advisor display name> | <count> | <amount>/year | <amount> |
```

Do not place individual resource names, resource groups, regions, meters, daily rates, or
resource-level rows in this opening response. Those belong to the selected-type expansion after
the user answers the single `ask_user` prompt. After an ordinary selected-type expansion, render
the returned resources and stop with a focused next step, such as inspecting another
recommendation type; do not add a resource-selection prompt. Resource selection belongs only to
actionability or remediation artifacts, postpone, dismiss, or other state-changing or handoff
flows.

For a selected-type expansion, render every resource returned by MCP. Never show only the first
few rows or shorten the table for readability. If `AreResultsTruncated=true`, state that the
expansion is partial and do not claim that all resources were shown.

If the Advisor summary returns no groups and no cost aggregate, report that no matching
recommendation groups were returned and keep monetary fields `Unavailable`. Do not convert an
empty result, a missing cost object, or a missing currency total into `$0`, and do not claim that
no unused cost was identified. Report `$0` only when ARG/Advisor explicitly returns a numeric zero
for that monetary field; otherwise report `Unavailable`.

## Resource detail

Use the exact MCP-returned resource name, resource group, resource ID, and Advisor resource type.
Keep the resolved subscription(s) or Service Group(s) visible in the scope line. When a selected
recommendation list is returned for a Service Group or spans multiple subscriptions, include the
applicable friendly subscription name with every resource so rows cannot be misattributed. Use the
subscription ID only when its friendly name is unavailable. Include the Service Group in the
scope line, not as a substitute for the per-resource subscription column.
For one or more resources, choose labeled resource cards, bullets, prose, or the compact resource
table defined above. Show the full resource ID and Advisor resource type when needed for
selection, confirmation, artifact generation, or when the user requests identifiers. Do not omit
identity details from the overall response; move them below a comparison table when necessary to
preserve readability. Use the friendly label `Accumulated waste` for the cumulative value and do
not expose a `Days idle` column.

Use Advisor/ARG-returned potential-savings and cost fields directly. For active rows, use the MCP
annualized `yearlyPotentialSavings` value, calculated only as
`dailyPotentialSavings × 30.4 × 12` when that is the source field. Never derive monthly values,
elapsed-day costs, post-dismissal costs, or other monetary values from timestamps or other rates.
Never derive a monthly equivalent by dividing a yearly value by twelve. For current opportunities
and active resources, render only `Yearly potential savings` and `Accumulated waste`; do not render a
monthly amount even if another period field is returned. For lifecycle output, use only the
state-specific labels defined above. Any unsupported period or inferred amount is `Unavailable`.
Missing monetary inputs remain `Unavailable`, not zero. An explicit numeric zero remains `$0`.
Sort summary and detail rows by returned yearly savings, preserving tool order for ties.

For an active resource list, every row must include `Yearly potential savings` and `Accumulated waste`
when those values are returned. If the source has a daily value, render the MCP annualized value;
never replace it with the daily amount. When multiple subscriptions or Service Groups are in
scope, every row must also identify its applicable subscription or Service Group.

## Completed lifecycle reporting

For lifecycle requests, use a state heading followed by one recommendation-type section per
returned type. Use prose, bullets, or a compact summary table based on which is clearest. Use the
exact Advisor display name and do not combine resources from different recommendation types into
one unlabeled result. The summary fields change with the lifecycle state:

- Completed: `Recommendation type`, `Completed resources`, `Realized savings`.
- Postponed: `Recommendation type`, `Postponed resources`, `Yearly potential savings`, `Accumulated waste`.
- Dismissed: `Recommendation type`, `Dismissed resources`, `Yearly potential savings`, `Accumulated waste`.

Use only the listed Advisor/ARG-returned measures. Do not use labels such as `ongoing cost`,
`monthly cost`, or `estimated cost` for values that are not returned with those meanings.

Every per-type resource section must preserve the common identity fields `Resource`, `Resource
group`, `Resource ID`, `Advisor resource type`, `Currency`, and `Pricing basis`, whether rendered
as prose, bullets, cards, or a table. If a table is used, place long IDs and technical fields
below it when they would make it too wide. Postponed and Dismissed use `Yearly potential savings` and
`Accumulated waste`, using only returned Advisor/ARG values. Completed uses `Completed on` and
`Realized savings`. Do not force irrelevant columns into a lifecycle table.

Show the reporting period and the lifecycle status (`Completed`) in the scope or table heading.
Keep records whose deletion date is outside the requested period out of the period totals, while
reporting them separately only when the user asks for out-of-period completed resources.
Do not replace a missing Advisor/ARG realized-savings field with a calculation from daily potential
savings, deletion dates, or elapsed days.

For dismissed records, do not convert `lastUpdated` or `lastRefreshed` into a dismissal date and do
not add an inferred post-dismissal cost to Advisor's returned accumulated `Cost`. Report any
unsupported post-dismissal amount as `Unavailable`.

Do not claim a resource has a specific charge, zero connections, dependencies, ownership,
production status, or unsupported deletion outcome unless an authoritative source supports it. Route
remediation and dependency questions to `azure-advisor-actionability`.
