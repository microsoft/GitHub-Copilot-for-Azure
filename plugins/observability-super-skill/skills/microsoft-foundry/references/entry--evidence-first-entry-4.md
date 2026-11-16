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

4. Choose [trace](../foundry-agent/trace/trace.md) for existing trace evidence,
   [troubleshoot](../foundry-agent/troubleshoot/troubleshoot.md) for runtime
   symptoms, or [existing evaluation analysis](../foundry-agent/observe/references/analyze-results.md)
   for supplied results. Existing generated insights are optional bounded reads.
   Do not route a health question into the full optimization/evaluation loop.
   The trace workflow selects sufficient operations before transport/source;
   existing server-side analysis need not be replaced by retrieval or KQL.
5. Report observations separately from hypotheses; include sources, actual
   fields/identifiers, retrieval time, freshness, completeness and coverage gaps.
   Distinguish instructions loaded, operations executed and fallback used.
   No offline test or eval-score improvement proves live recovery.

After trace, runtime troubleshooting or existing-evaluation evidence analysis,
use the [shared SRE recommendation-only contract](shared/specialists.md#optional-existing-sre-agent)
only for a material unanswered operational question with verified existing
connected/source proof and a specific advantage over the current direct path.
Do not recommend SRE for sufficient completed analysis or recovery comparison.
A review choice is not execution approval; explicit requests enter review
directly. No automatic thread, context transfer, metadata read or service
follow-up. Do not load the coordinator just for
this review.

After trace, runtime troubleshooting or existing-evaluation evidence analysis,
apply [the result-to-next-action contract](shared/next-actions.md),
including direct use without the coordinator. End actionable findings with the
completed-plan implementation continuation when applicable: ask for missing source
or propose the exact minimal edit for separate approval. Otherwise return the
stage, narrowest supported change and one question offering fix/rollback plan
review; distinguish speculative optimizations and quality risks. If material
cause is unresolved, propose the smallest missing evidence instead. Retain
accepted/declined steps and explicit stops. Read-only permits a planning offer,
never automatic action. After an actual approved change, proactively offer
`verify-observability-fix` comparison using existing supplied evidence only;
a plan or deployment success alone is not recovery.

