# Selection and remediation handoff

This skill identifies Advisor Cost/IdleResources candidates. It never deletes, resizes,
deallocates, or reconfigures a resource. A savings estimate does not prove deletion safety.
Explicit safety requests use the read-only prevalidation flow below. Never claim that a
recommendation, savings estimate, or passing automated verdict authorizes deletion.

## Read-only prevalidation

For "safe to delete", "validate before removal", or "is this recommendation still valid":

1. Reuse resolved scope/tenant and the exact recommendation type and affected resources
   already selected by the user. If the type is unknown, use existing Cost/IdleResources
   summary or metadata resolution, visibly show the returned types, and ask for one type.
   Never invent a type GUID or ask for an ID that Advisor results can supply.
2. Call `advisor_recommendation_prevalidate` for that type. Prefer full ARM IDs for selected
   resources; names are allowed only when unambiguous. Do not silently include unselected
   rows or change scope. Do not list the type again just to prevalidate it.
   This tool enforces Cost/IdleResources/New internally; do not pass category or status inputs.
3. Use the tool's verdicts without reclassification. Render three sections, even if empty:
   `Resources ready to delete now`, `Resources requiring additional review`, and
   `Resources blocked for deletion`, mapped to `safe`, `needsReview`, and `blocked`.
   Explain that "ready" means automated checks passed, with manual checks still outstanding.
   Use the [prevalidation layout](table-format.md#prevalidation-results): compact bucket tables,
   one shared checks-performed table, and outstanding manual confirmations. Keep per-resource
   failures and unverified checks visible; show detailed evidence only when explicitly requested.
   Do not repeat the same checklist/manual guidance for every resource.
4. Show bucket counts and returned Safe/NeedsReview known savings as Retail USD; omit the
   Blocked aggregate savings line. Preserve unavailable amounts and missing-value counts.
   Disclose truncation and unmatched selections; never call a capped subset the entire scope.
   Recent activity, unknown signals, or insufficient history are investigation requirements,
   not proof of inactivity. Do not infer metrics, ownership, or dependency coverage.
5. In the blocked section, separately identify resources with a returned `resourceDeletedOn`
   as confirmed already deleted, with their dates and the returned `deletedCount`. Show their
   returned `reason` and honor `canPostponeDismiss=false`: no postpone, dismiss, manual completion,
   or remediation handoff. Explain that no action is needed and Advisor will remove the
   recommendation automatically within 72 hours once it refreshes. Keep executed-check evidence
   visible, but do not ask for attachment/ASR investigation, backups, export, or other before-deletion
   steps for an already-deleted resource; manual guidance is not an outstanding task for it.
   The tool confirms deletion from a Delete event in the last 14 days of ARG change history,
   only after a failed scope/detection check. Without `resourceDeletedOn`, that failure or an
   unverified deletion probe means stale/unconfirmed detection, not confirmed deletion.
   A savings timestamp, missing resource, or absent change record alone is not proof of deletion.
   Preserve the tool's returned buckets; keep active blockers and their required investigation distinct.
6. Never execute advisory CLI/PowerShell guidance, delete, change state, or generate remediation
   automatically from these results. A separate remediation request uses the explicit
   selection/confirmation handoff below. Read failures or unsupported resource-type/ID pairs
   never become a safe verdict; dependency scans cover only visible control-plane evidence.

Inspect the connected [tool contract](tools-and-recovery.md). If prevalidation is unavailable,
report that an updated MCP server is needed; do not substitute ad hoc ARM, CLI, or KQL checks.

## Resource selection

Artifact requests and lifecycle actions use direct list with `category=Cost`,
`sub-category=IdleResources`, and the resolved scope. Active remediation and postpone/dismiss
selection use `status=New`. For completion, preserve a supplied source state, otherwise use New.
For reactivation, preserve the explicitly supplied or previously selected source state
(Postponed, Dismissed, or Completed); if unknown, ask which source state to select instead of
listing New. The read filter is the source state, not the intended update state.
Do not require an opening summary unless the user separately requested grouped discovery.

1. Reuse an exact type/resource already explicitly selected by the user. Otherwise render
   returned recommendation types and counts, then ask for one type using returned display names.
   Never infer a stable type GUID from its label.
2. List that type and visibly render its resources before asking for selection. Keep stable
   recommendation IDs internally except the separately labeled lifecycle selection identifiers
   required by [State updates](state-updates.md); provide full affected-resource IDs when needed to
   distinguish resources or confirm actions.
3. Ask for selected resources or `All resources in this recommendation type` only when the
   target set is missing. A single row is not implicitly selected. Reuse an explicit prior
   selection. "Those requiring more work" after one prevalidation result selects its
   `needsReview` resources only, not passing or confirmed-deleted resources; reuse their returned
   stable recommendation IDs without another list/selection question. Ask if the referenced
   result or bucket is ambiguous, or the exact update IDs are missing.
4. An all-resources choice is limited to that type and scope. If the list is capped/truncated,
   disclose the partial target set and obtain explicit acceptance of only the shown resources;
   never call them every matching resource.

For "this", "it", or "this one" after several rows, ask which exact resource. Never choose
the first, highest-savings, or most recently mentioned row. Ordinary read-only expansion does
not require resource-selection prompts.
Resolve recommendation types and resources from the user's wording and returned Advisor
records. After scope resolution, do not ask the user to supply type GUIDs or resource IDs
that can be obtained from those records.

## Remediation artifacts

Distinguish "what could I save if I deleted it?" (read-only estimate) from "create a script
to delete it" (artifact handoff). Keep explicit selection for singular estimates after ambiguous
multi-resource results, but do not turn an estimate into permission to remediate.

After selection, ask only for missing artifact format: instructions, parameterized template,
populated script, or resource list; CLI, PowerShell, or IaC when relevant. Ask one question at a
time and no more than two format clarifications.

Load `azure-advisor-actionability` with the original request, exact recommendation type GUID,
complete affected resource IDs, confirmed scope/tenant, requested format, and returned Advisor
evidence and savings. Preserve access/truncation limitations and unresolved placeholders.
Do not hand off confirmed-deleted, unselected, Completed, Postponed, or Dismissed rows as active deletion
candidates. A separate lifecycle-specific request must be handled explicitly.

The existing actionability skill retrieves `advisor_remediation_get` using only
`recommendationTypeId`, substitutes confirmed resource context, and labels Advisor guidance
versus a public Microsoft Learn fallback. Do not generate duplicate remediation here or bypass
its confirmation safeguards. Guidance is not evidence of execution or validated deletion safety.

Lifecycle-state changes use the confirmation rules in [State updates](state-updates.md), not an
automatic remediation handoff.
