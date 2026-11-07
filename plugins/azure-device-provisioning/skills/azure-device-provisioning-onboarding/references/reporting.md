# Reporting

## Current-state validation

When the MCP response contains `validation.customerSummary`, return it without additional narrative.
Do not add raw count deltas, detailed timestamps, discarded attempts, or temporary-file cleanup.

## Preflight comparison

When the user explicitly asks to compare a previous preflight result with current registration
state, use the prior result only when it is present in the conversation or supplied by the user.
Never reconstruct historical state from current timestamps.

Use one compact aggregate table:

```text
Readiness: READY WITH WARNINGS
Target: <DPS> / <enrollment>

| Comparison | Prediction | Actual |
|---|---|---|
| Registration | Devices complete assignment | 10/10 assigned |
| Hub assignment | `<intended Hub>` | 10/10 matches, 0 mismatches |

Warnings:
- <short actionable warning>

Read-only validation; no enrollments, registrations, or devices were modified.
```

## Rules

- Summarize identical outcomes once, such as `10/10`.
- List devices only for blockers, mismatches, unique warnings, or execution failures.
- Never describe a warning as blocker-equivalent.
- Missing registration state is expected informational context before first provisioning.
- Do not use wide tables for per-device evidence or remediation.
- If no prior result is available, state that comparison was unavailable rather than inventing it.
