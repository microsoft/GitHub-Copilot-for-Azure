# Selection and remediation handoff

This skill identifies Advisor Cost/IdleResources candidates. It never deletes, resizes,
deallocates, or reconfigures a resource. A savings estimate does not prove deletion safety.
There is no dedicated automated pre-validation operation in this tool contract; do not promise
completed dependency, lock, Monitor, or ownership checks.

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
3. Ask for selected resources or `All resources in this recommendation type`. A single row is
   not implicitly selected. Reuse an explicit prior selection instead of asking again.
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
Do not hand off unselected, Completed, Postponed, or Dismissed rows as active deletion
candidates. A separate lifecycle-specific request must be handled explicitly.

The existing actionability skill retrieves `advisor_remediation_get` using only
`recommendationTypeId`, substitutes confirmed resource context, and labels Advisor guidance
versus a public Microsoft Learn fallback. Do not generate duplicate remediation here or bypass
its confirmation safeguards. Guidance is not evidence of execution or validated deletion safety.

Lifecycle-state changes use the confirmation rules in [State updates](state-updates.md), not an
automatic remediation handoff.
