---
name: assess-observability-health
description: "Assess Azure application or Foundry-agent operational health read-only from supplied evidence or authorized telemetry. WHEN: 'assess health', 'rank runtime errors', 'review application latency'."
compatibility: Supplied evidence needs no Azure access or Python. Optional helpers require an approved Python 3.9+ interpreter.
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Assess operational health

Run one bounded assessment, rank findings, and preserve the user's choice of
what to investigate. This is not continuous monitoring or remediation.

1. Apply the [current-request intent gate](references/intent.md) before reads or
   journey presentation. Conceptual/unrelated tasks get direct answers, not
   onboarding. Honor topic switches and explicit specialist requests.
2. Read [availability](references/availability.md) and
   [entry, permissions and evidence](references/entry.md).
   Supplied evidence needs no cloud, installation, scripts, jobs or saves.
3. [Resolve scope](references/scope.md), then run the
   [bounded assessment](references/assessment.md). Default maximum: six total
   reads, including discovery/failures; inherited tighter limits win.
4. [Classify](references/classification.md) with the
   [health contract](references/health-contract.md) and
   [report the result](references/reporting.md). Missing, denied, empty, stale
   and partial evidence are distinct; insufficient evidence is INCONCLUSIVE.
5. Apply [handoff rules](references/handoff.md): never auto-select rank 1 or
   repeat a completed assessment. For optional
   [visuals and verified links](references/visuals.md), reuse collected evidence;
   local execution and file writes need separate consent.

Retain source/schema, UTC window, evidence references, selected finding,
approval ceilings and remaining budgets. Tools and access must be discovered,
not inferred from skill names. Instructions do not enforce permissions.
Separate loaded instructions, planned operations and actual execution.
Do not install, deploy, edit alerts, generate traffic or run evaluations.
