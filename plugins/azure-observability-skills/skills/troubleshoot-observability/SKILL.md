---
name: troubleshoot-observability
description: "Coordinate read-only Azure application or agent troubleshooting, approved fixes, and recovery. WHEN: 'investigate end to end', 'troubleshoot observability', 'plan monitoring or alerting'."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Troubleshoot Azure observability

Choose the next useful step; available tools execute only approved operations.
Apply the [current-request intent gate](references/intent.md) before journey
presentation or reads. Conceptual/unrelated tasks get direct answers; honor
topic switches, explicit specialist requests, stops and declines.

| Current need | Read/select only the applicable guidance |
|---|---|
| Resolve target, source or telemetry access | Available `connect-observability` |
| Broad health | Available `assess-observability-health` |
| Completed health with no selected finding | Ask for selection; never auto-select rank 1 or reassess |
| Named failure, slow path or selected finding | [Bounded affected-path investigation](references/investigation.md) |
| Additional specialist or capability | [Selection](references/selection.md); check actual availability first |
| Live-read scope or access | [Scope and permissions](references/scope-permissions.md) |
| Evidenced issue or approved-fix plan | [Next actions](references/next-actions.md) |
| Actual effective change | Available `verify-observability-fix` with supplied comparable evidence |
| After the recovery verdict | [Optional monitoring](references/monitoring-follow-up.md) |

`azure-diagnostics` and `microsoft-foundry` are optional existing skills from
the Azure skills plugin, not bundled copies. Use their installed instructions
when applicable and available. Never silently install them or read assumed
sibling paths. If absent, use sufficient supplied evidence and this skill's
local investigation references, report gaps, and offer the
[approved setup path](references/acquire-capability.md) only when needed.

Retain source/schema, UTC window, selected findings, evidence and remaining
budgets. Missing/denied/empty/stale/partial evidence remains distinct;
insufficient evidence is INCONCLUSIVE, and correlation is not causation.
New reads, sign-in, persistence, delegation, jobs, traffic and changes retain
separate applicable approval. Supplied evidence needs no cloud or setup.
Use [journey labels](references/journey-indicator.md) and
[reporting](references/reporting.md) to distinguish instructions read,
host activation, planned tools and actual execution. A fix plan is not execution;
deployment success and dashboards are not recovery proof.
