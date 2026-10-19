# Lifecycle and remediation

Use `advisor_recommendation_list` directly for lifecycle reporting. In this idle-resource
workflow, preserve `category=Cost` and `sub-category=IdleResources`. For completed realized-savings
reporting, request `status=Completed`; for postponed or dismissed reporting, request the explicitly
requested status. Do not call `advisor_recommendation_summary` for this lifecycle request or include unrelated
Cost recommendation types. Keep lifecycle measures separate by currency:

- Reporting defaults to `Completed` resources when the user asks how much was saved or what a
  completed cleanup recovered.
- `Completed`: realized savings for returned records whose `resourceDeletedOn` is in the requested
  period.
- `New`: recoverable current potential when requested.
- `Postponed`: accumulated waste and remaining potential when explicitly requested.
- `Dismissed`: accumulated waste when explicitly requested; do not present it as current
  recoverable potential unless Advisor returns that value for the record.

Use only Advisor/ARG-returned monetary fields for lifecycle output. For completed resources, use
an Advisor/ARG-returned realized-savings value when present; otherwise report `Unavailable`.
`resourceDeletedOn` may be used to select records within the requested period, but must not be
used with a daily rate to calculate a replacement savings amount.

Use the exact monetary labels by lifecycle state: `Realized savings` for `Completed`, and
`Yearly potential savings` plus `Accumulated waste` for `Postponed` and `Dismissed`. Never render daily,
per-day, monthly, ongoing, or inferred cost in a lifecycle response.

For dismissed records, report Advisor's returned accumulated waste and its calculation timestamp
when available. Do not treat `lastUpdated`, `lastRefreshed`, or another metadata timestamp as the
dismissal time, and do not extrapolate additional post-dismissal cost without an authoritative
dismissal timestamp and an explicitly supported calculation.
Aggregate the per-resource values for the requested period and pricing basis. Include completed
resource counts, state counts, and unavailable records when returned. Do not mix historical state
totals into a current recommendation-type summary.

For lifecycle reports, use headings and short narrative sections by default. When multiple
recommendation types are returned, begin each lifecycle-state section with a concise
recommendation-type summary, then render one resource section per type. Choose prose, bullets,
cards, or a table based on readability. The summary fields are lifecycle-specific:
Completed uses `Recommendation type`, `Completed resources`, and `Realized savings`; Postponed
uses `Recommendation type`, `Postponed resources`, `Yearly potential savings`, and `Accumulated waste`;
Dismissed uses `Recommendation type`, `Dismissed resources`, `Yearly potential savings`, and
`Accumulated waste`.
For completed reporting, preserve `Resource`, `Resource group`, `Resource ID`, `Advisor resource
type`, `Currency`, `Pricing basis`, `Completed on`, and `Realized savings` in the chosen format.
Postponed and Dismissed use `Yearly potential savings` and `Accumulated waste` instead. Do not
flatten resources from different recommendation types into one unlabeled result.

When the prompt explicitly asks what was completed, postponed, or dismissed, report the requested
states as separate sections or with an explicit lifecycle-state column. Otherwise, report only
`Completed` resources by default. Preserve each resource's exact Advisor status, scope, currency,
pricing basis, and applicable measure; never combine realized savings with accumulated waste into
one unlabeled total.

For postpone or dismiss operations, obtain the stable recommendation identifier and exact scope.
First resolve whether the request applies to the explicitly identified resources only or to every
resource of the same recommendation type in the same scope. Render the known scope and target
information before asking. If the target set is ambiguous, use `ask_user` for that focused choice
rather than applying the update broadly.

Before any state change, call `advisor_recommendation_list` directly with only active
recommendations: `status=New`, `category=Cost`, and `sub-category=IdleResources` in the
resolved subscription or Service Group scope. Group the returned records by recommendation type
in the visible response, then ask which recommendation type to review. Do not call
`advisor_recommendation_summary` for this action flow.

After a type is selected, show every affected resource in that type with its resource ID and
stable recommendation ID in a visible response before asking. Use `ask_user` to choose
`Selected resources only (Recommended)` or `All resources in this recommendation type`, then
require explicit resource selection. Never
offer a single option that dismisses or postpones all resources across multiple recommendation
types. Do not show or update Security or unrelated recommendation categories. The update
operation is single-record: call it once per selected stable recommendation ID. Use the list
record's stable `name` as `recommendationId`; never pass the ARM resource ID or the
`recommendationTypeId` to the update command. A single returned resource still requires explicit
selection.
The resource list must be rendered in a visible assistant response before the selection question.

For postponement, propose a concrete future return date 30 calendar days from the current date,
render the exact resources, scope, proposed return date, and continuing accumulated waste, then
use `ask_user` with `Use this date (Recommended)` or `Choose another date`; do not ask an
open-ended duration question. For dismissal, render the exact resources, scope, current-resource
count, and combined Advisor-returned savings before using one free-text `ask_user` question for
a reason when the user has not supplied one. Do not silently choose `Other`, and do not calculate
a replacement amount from dates or daily rates.

Show the complete proposed changes and obtain explicit confirmation before calling
`advisor_recommendation_update`. Its required inputs are the selected stable
`recommendationId`, exactly one subscription or Service Group scope, and
`recommendationStatus` (`Postponed` or `Dismissed`). Postponement additionally requires a future
ISO 8601 `postponedUntilDateTime` with a timezone offset. Dismissal accepts the supported
`recommendationDismissReason` values; when no reason maps cleanly, use `Other`. Respect RBAC
failures, preserve per-item failures, and report partial success accurately.
Render the proposed changes visibly before the confirmation question; do not call the update
operation and confirmation prompt back-to-back.

This skill never deletes, resizes, deallocates, or reconfigures resources. Keep Advisor-based
cost analysis and candidate classification in this workflow. Route
only the selected remediation artifact or execution-preparation request to
`azure-advisor-actionability`.
