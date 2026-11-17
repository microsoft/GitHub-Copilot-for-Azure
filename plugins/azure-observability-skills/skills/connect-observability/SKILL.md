---
name: connect-observability
description: "Confirm an existing Azure application's telemetry sources and task-specific access without automatic setup. WHEN: 'connect observability', 'find my app telemetry', 'plan instrumentation'."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Connect application telemetry

Establish scope and task-specific telemetry readiness, not application health.

1. Apply the [current-request intent gate](references/intent.md) before reads or
   journey presentation. Generic coding/creation and conceptual questions do not
   start onboarding. Setup requests do not authorize provisioning.
2. Read [availability](references/availability.md) and the
   [mapping/readiness contract](references/contract.md).
3. [Check available operations](references/operations.md). Distinguish installed,
   callable, authenticated, authorized and useful data. Missing operations use
   the [tool prerequisite guide](references/tools.md); setup needs consent.
4. [Resolve confirmed scope](references/scope.md) and
   [select the query surface](references/routing.md) before the first probe.
   Naming/co-location and deployment receipts do not prove telemetry linkage.
5. [Check readiness](references/readiness.md) within the agreed window and budget.
   Preserve per-signal source, count, timestamp, completeness and access states.
   Missing/denied/empty/stale evidence is not an instrumentation diagnosis.
6. [Report readiness](references/reporting.md) and
   [retain/handoff scope](references/persistence.md). Saving mappings requires
   explicit consent, an ignored destination and separate replacement consent.

Supplied-evidence and tools-only modes require no Python or saved files.
The optional [local helper](references/helper.md) validates supplied inputs; it
does not discover resources or prove source truth. Without an approved runtime,
report **readiness classification not computed** rather than invent helper output.
Do not install Python, change identity, expose credentials, deploy or alter
collection. Preserve declines, topic switches and separate action approvals.
