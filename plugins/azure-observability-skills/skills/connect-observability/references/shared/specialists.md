# Specialist eligibility and fallback

Select only for the current admitted observability request. Explicit specialist
requests stay direct; conceptual questions and unrelated creation/coding/cost
tasks do not start a journey. An external skill name is not an executable call.

1. Retain the selected question, scope, source/schema, evidence, approval ledger
   and remaining budgets.
2. Check actual availability, full instructions, host loading, operations,
   identity/access and side effects before a handoff.
3. Use an applicable installed specialist rather than duplicate its library.
   If missing, offer [approved setup](acquire-capability.md) when necessary.
   Never install automatically or assume a sibling path.
4. If blocked, disclose the gap and use sufficient supplied evidence or a
   supported bounded fallback. Never claim an absent specialist ran.

| Need | Preferred instructions | Boundary |
|---|---|---|
| Resolve app/telemetry linkage | Available `connect-observability` | Readiness is not health |
| Broad health | Available `assess-observability-health` | One assessment; user chooses a finding |
| Selected or uniquely named incident | Local affected-path guidance or available `azure-diagnostics` from the Azure skills plugin | No mandatory health sweep or copied diagnostics package |
| Agent/model/tool failure or latency | Available `microsoft-foundry` trace/troubleshoot guidance | Retain AI-specific evidence; no automatic invocation, jobs or deployment |
| Quality/evaluation review | Available Foundry observation guidance | Review supplied results; new datasets/evals/optimization require separate approval |
| Actual effective change | Available `verify-observability-fix` | Comparable supplied evidence; gaps remain INCONCLUSIVE |
| Instrumentation/collection gap | Eligible existing App Insights/OTel/DCR specialist | Denial/empty data alone is not a gap; setup and writes need approval |
| Visualization | [Visual-evidence flow](visual-evidence.md) | Reuse evidence; datasource reads and dashboard writes are separate |
| Trace-source or other capability need | [Matching](matching.md), [trace routing](trace-capabilities.md) | Eligibility, operations and access must be verified |
| Application/infrastructure changes | Applicable existing prepare/validate/deploy workflow | A plan or deployment success is not recovery proof |

`azure-diagnostics` and `microsoft-foundry` are optional existing specialists,
not part of this four-skill package. Their absence does not prevent analysis of
sufficient supplied evidence. Do not promise universal host loading or tools.

## Optional existing SRE Agent

[Azure SRE Agent tools](https://learn.microsoft.com/en-us/azure/sre-agent/mcp-server)
are an optional external service, not a bundled skill or Copilot subagent.
Direct evidence remains the default. Read the
[recommendation/review contract](sre-review.md) only for a material unanswered
question with an existing connected agent and an evidenced advantage.
Review acceptance grants no new reads, data transfer, thread or persistence.
Before any service operation, also read the separate
[execution gate](sre-execution.md). Unknown effective action controls block
execution; a read-only prompt cannot enforce service permissions.

Keep selected findings/ranks and declines unchanged. Do not re-run health,
substitute rank 1, use service identity to bypass access, or loop between
specialists. Use the [handoff contract](handoff.md) to return actual outcomes,
missing evidence and the smallest permitted next action.
