---
name: trace-error-blast-radius
description: "Investigate error signatures and propagation in Azure Monitor Trace Store. WHEN: 'trace error blast radius', 'how widespread is this exception in Trace Store'. Exact impact is capability-gated."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# trace-error-blast-radius

Load `trace-investigation-contract` by that exact native skill name before querying;
reuse it throughout this investigation. Native loading failure is a prerequisite.

1. Read the [delivered workflow](references/workflow.md) before execution.
2. Preserve population, window, units, coverage and the caller's budget.
3. At each unavailable required capability, name the missing result; do not substitute.
4. Execute supported discriminating checks and continuations, then report evidence.

## Tools used

Discover this plugin's Monitor MCP router and exact command schemas first.
All workspace operations require `workspace` and `resource-group`;
`subscription` and `tenant` are Optional.

| Operation | Required | Optional |
|---|---|---|
| `monitor traces field list` | Workspace/group | Subscription/tenant |
| `monitor traces query run` | Workspace/group, `query` | `start-time`, `end-time`, `max-results`, `include-spans` |
| `monitor traces query resume` | Workspace/group, `operation-id` | `page-size`, `include-spans` |

Top attributes and ordinary CPA ship in `4.0.0-beta.8`; runtime discovery still applies.
Independent compare commands are unavailable on the reviewed merged contract.

## Error handling

| Condition | Action |
|---|---|
| Auth failure | Restore same server sign-in/workspace read access |
| `Running` | Append pages; resume same operation sequentially |
| Truncated inventory/results | Preserve coverage limits; never infer complete totals |
| Required command absent | Report unavailable result, not zero impact or a substitute |
