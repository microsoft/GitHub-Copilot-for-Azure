# Confirmed state changes

Read [Selection](selection-and-handoff.md) and [Table format](table-format.md).
Preserve Cost/IdleResources, selected type/scope/tenant; never broaden to other types/states.
Postpone/dismiss lists active New rows. Completion preserves supplied source state, otherwise
New. Reactivation lists its selected source state (Postponed/Dismissed/Completed), asks if
unknown, then updates to New only after confirmation.

Before selection, visibly show chosen-type resources with full affected-resource IDs and
stable recommendation IDs, separately labeled. Never confuse them.
Offer `Selected resources only (Recommended)` or `All resources in this recommendation type`;
no cross-type update-all. Reuse explicit selections.

- Postpone: reuse a future return date; otherwise propose exactly 30 calendar days from now.
  For a proposed date, show it and ask `Use this date (Recommended)` or `Choose another date`.
- Dismiss: reuse a supplied shared reason, otherwise ask once. Supported reasons:
  `ExcessiveCostInvestmentRequired`, `ImplementationStepsAreUnclear`,
  `IncompatibleWithTheCurrentConfiguration`, `RiskIsAcceptable`,
  `TooComplexOrImpracticalToImplement`, `AnAlternativeSolutionIsAlreadyInPlace`, `Other`.

Visibly show the entire selected batch, total count, exact scope/resources, intended status,
date/reason and continuing returned Cost. State confirmation includes collapsed rows.
For truncated lists disclose/confirm the partial shown target set, never all matching resources.
Then obtain one explicit `Confirm these changes` / `Cancel` batch confirmation via `ask_user`.
Do not put the only proposal inside the question or update before confirmation.
No repeated reason/date/confirmation per record, unless individually requested.
Unchanged batch confirmation covers every selected item. If targets/action/reason/date change,
show and confirm the revised batch once.

Call existing update once per selected record, stable `name` as `recommendation-id`, never
affected-resource ARM ID/type GUID. Each call uses one subscription or scalar service-group,
not scope arrays; preserve tenant and item-level failures.
Postpone uses `recommendation-status=Postponed`, future ISO 8601
`postponed-until-date-time` with timezone; dismiss uses Dismissed and
`recommendation-dismiss-reason`. Completion/reactivation use Completed/New only when requested.
List `status` is source state, not the update's `recommendation-status`.
Report successful and failed records separately. State updates do not delete resources;
an absent row proves neither deletion nor completion. State timestamps come from Advisor,
not provisional local times.
