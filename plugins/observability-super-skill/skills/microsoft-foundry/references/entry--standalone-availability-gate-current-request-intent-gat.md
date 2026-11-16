# Selected guidance: Standalone availability gate; Current-request intent gate

> Reading grants no execution approval. Apply the entry's current-request
> intent and standalone availability gates. Analyze supplied evidence in
> memory: no Azure, Python, installs, auth, cache, writes or jobs required.
> Live reads require approved scope/window, verified operations/schemas and
> finite budgets; missing/denied/empty/partial evidence stays distinct and
> insufficient evidence is INCONCLUSIVE. Lifecycle actions, sensitive content,
> traffic, persistence, edits and deployment need separate explicit approval.
> These rules supersede conflicting automatic actions in retained examples.

[Execution boundaries](../references/execution-boundaries.md) apply; load only the boundary
section needed by the selected action, never every linked reference.

---
name: microsoft-foundry
description: "Investigate Microsoft Foundry agent observability: traces, runtime/model/tool failures, application latency, existing evaluation evidence and generated insights. Analyze supplied evidence or approved bounded reads without mandatory setup. Not agent/resource creation, model deployment, RBAC or general Foundry lifecycle routing. Conceptual questions need no journey; no automatic jobs, edits or deployment."
license: MIT
metadata:
  author: Microsoft
  version: "1.2.32"
---

# Microsoft Foundry Skill

This complete vendored Microsoft Foundry skill defaults to **evidence-first,
read-only investigation of an existing deployment**.

## Standalone availability gate

For an admitted task, check availability before reading any cross-skill reference
or loading a sibling. Individual installation may omit them. Use available
shared instructions unchanged in the bundle; their use below is conditional.
Unknown availability follows the missing-reference fallback.
Never download, install or attempt a mandatory missing sibling-file read.
If coordinator guidance is absent, continue the selected local trace,
troubleshooting or evaluation-evidence workflow with supplied evidence or
existing authorized operations, confirmed schemas and the retained scope/window
and budgets. Keep material trace gaps explicit; no bulk reconstruction or
invented operations. Skip optional SRE review without its complete shared
contract. Return evidence and one smallest supported fix/rollback plan-review
question, or the smallest missing evidence. Separate approvals still govern
edits, jobs and service actions. Missing diagnostics/comparator instructions
are handoff blockers, not permission to download or claim recovery.
Explicit retained lifecycle tasks stay local with their existing approvals.

## Current-request intent gate

