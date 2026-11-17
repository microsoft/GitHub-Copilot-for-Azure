# 4. Return scope, readiness, and next step

Report:

- Confirmed application, environment, task, and evidence window.
- Prerequisite states and per-source signal states, counts, latest event times,
  completeness, and freshness limits.
- When `assess` ran: its readiness classification and reasons.
  In tools-only mode: **readiness classification not computed**, the runtime
  limitation, per-signal observations, and any concrete access blockers.
- Mapping provenance and any unresolved association.
- The appropriate next supported assessment/investigation path and its
  prerequisites. If no externally usable path is available, say INCONCLUSIVE
  and identify the missing capability/evidence.

Missing telemetry is not healthy. An empty query is not proof instrumentation
is absent. First distinguish mapping, access, inactivity, ingestion delay, and
partial-data issues. Setup, migration, collection changes, and cloud writes are
not part of this read-only workflow.
