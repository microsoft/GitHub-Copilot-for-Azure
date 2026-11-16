# Selected guidance: Evidence-first entry

> Reading grants no execution approval. Apply the entry's current-request
> intent and standalone availability gates. Analyze supplied evidence in
> memory: no Azure, Python, installs, auth, cache, writes or jobs required.
> Live reads require approved scope/window, verified operations/schemas and
> finite budgets; missing/denied/empty/partial evidence stays distinct and
> insufficient evidence is INCONCLUSIVE. Lifecycle actions, sensitive content,
> traffic, persistence, edits and deployment need separate explicit approval.
> These rules supersede conflicting automatic actions in retained examples.

## Standalone availability gate

Before cross-skill reads, check availability; unknown means missing.
Never attempt a mandatory missing sibling-file read or install/download.
When available, use shared instructions unchanged for the selected task.
Otherwise stay local with retained evidence/scope/budgets and one evidence or
fix/rollback plan-review question; skip SRE and block diagnostics/recovery
handoffs without their complete contracts.

[Execution boundaries](../references/execution-boundaries.md) apply; load only the boundary
section needed by the selected action, never every linked reference.

Only for an admitted actionable observability task, at the top of substantive
answers, show **Using:** `microsoft-foundry` only
when host-loaded and being followed, plus **Stage:** for the actual selected
journey stage/workflow. For local instruction review use **Instructions read:**
and **host activation unverified**. Show **Discovered:** only for a relevant
skill/tool/MCP actually found, including external skills; state its kind, fit
and unverified prerequisites. Discovery/loading is not execution or permission.
Propose the concrete bounded next action and ask **Allow once** or **Continue
with current capabilities** when permission is missing. Reuse unexpired covered
approval within scope, destination and remaining budget; preserve declines.
Setup, connections, sign-in, jobs/traffic, persistence and edits/deployments
retain separate approvals and never follow automatically from discovery.
Use **Planned tools:** before execution and **Tools used:** only afterward,
with actual outcomes. Do not invent capabilities, host loads or successful reads.
For a substantive result or accepted plan review, first apply
[the shared result/presentation contract](shared/next-actions.md):
retain the top header and current-stage indicator in an already coordinated
journey even when this specialist answers. Accepted plan review uses Guide an
approved fix with the Remediate indicator before content. Preserve evidence-rich
synthesis and source bounds. Explicit standalone use stays direct without a
journey diagram or coordinator load for presentation.

## Evidence-first entry

Use plain developer language: "existing evidence with sensitive details removed",
not unexplained "sanitized". Reuse the selected evidence/read-plan path and
confirmed facts; do not make the developer choose the same path again. If they
requested live investigation with approval before Azure access, propose that
plan while keeping schema/read approvals intact. Supplied evidence remains an
alternative, not a mandatory prerequisite.

1. Reuse the coordinator's confirmed project/deployment, agent/version,
   environment, telemetry resource IDs, UTC window, symptom, evidence and
   approvals. Do not rediscover known scope or require an agent source folder,
   `.foundry` cache, azd environment or metadata migration.
2. With supplied sanitized evidence, analyze it directly without tools,
   scripts, installation, sign-in or local writes. Label it supplied evidence,
   not a live query. Missing evidence yields INCONCLUSIVE with the smallest
   next read proposed; it never triggers setup.
3. Before any authorized live read, state the selected workflow, retained
   scope, actual discovered operation/schema, required access and blockers.
   Approval to load instructions is not approval to query Azure.
