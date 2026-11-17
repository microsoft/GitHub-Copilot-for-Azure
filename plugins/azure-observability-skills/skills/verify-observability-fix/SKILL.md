---
name: verify-observability-fix
description: "Compare supplied before-and-after evidence after an approved Azure application or Foundry-agent change. WHEN: 'verify incident recovery', 'did the fix work', 'compare recovery evidence'."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Verify recovery evidence

Compare explicitly supplied sanitized evidence after an actual confirmed change.
Do not collect telemetry, run tests/evaluations, generate traffic, save reports,
edit or deploy as part of this comparison.

1. Apply the [current-request intent gate](references/intent.md) and
   [availability rules](references/availability.md). Conceptual/unrelated tasks
   do not start a recovery journey.
2. Read [entry requirements](references/entry.md),
   [scope and agreed gates](references/scope.md), and the
   [evidence contract](references/contract.md). A proposed change is not recovery.
3. Accept only [supplied evidence](references/evidence.md): retain target/version,
   deployment time, original/post windows, metric definitions, provenance,
   thresholds, minimum sample/span and freshness criteria. Never invent defaults.
4. [Compare with or without Python](references/comparison.md).
   An existing approved Python 3.9+ runtime may execute the local helper; do not
   install one. Without exact validation/arithmetic, return INCONCLUSIVE rather
   than fabricate an executed helper result.
5. [Report narrowly](references/reporting.md):
   **VERIFIED_RECOVERED**, **NOT_RECOVERED**, or **INCONCLUSIVE**.
   A sufficient required post-change violation wins despite unrelated gaps;
   otherwise unresolved required/supporting evidence prevents recovery.
6. Only after the verdict, offer [optional monitoring](references/follow-up.md),
   preserving any decline. Monitoring is neither required nor recovery proof.

Source-computed percentiles cannot be reconstructed from averages. Preserve
missing/denied/stale/partial/noncomparable evidence. Deployment success, quiet
alerts or better evaluation scores alone prove neither recovery nor causation.
All collection, persistence and change approvals remain separate.
