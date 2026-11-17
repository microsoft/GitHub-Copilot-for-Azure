# 3. Prove task-specific telemetry readiness

Agree the core signals needed for this task, an explicit UTC observation window,
expected freshness, and how long a check remains reusable. These values depend
on workload/traffic; do not invent universal thresholds or silently relax them.
For agents, distinguish request success from model/tool behavior and quality.

Run small actual reads using the confirmed source and available tool schemas.
Aggregate server-side and return only the necessary counts/timestamps. Do not
export raw prompts, SQL statements, request URLs, or raw telemetry to local input
files. A relevant trace store is not established by Application Insights or
Prometheus workspace existence alone.

Record each signal separately as usable, missing, denied, empty, stale,
throttled, failed, partial, unverified, or unsupported. Inspect API completeness
and truncation, not just HTTP success. Do not label partial results usable.
Count telemetry records or represented events, not rows in an aggregate result.
Preserve empty-table rows with null last-event time as empty.
Bind each aggregate to its signal and source in the returned evidence. Where the
query dialect supports it, include an explicit signal label in each aggregate
branch (for example `Signal='requests'` versus `Signal='dependencies'`).
Never assign numbers to signals by tool completion order or result-row position.
Before reporting or constructing helper input, match each count and timestamp
to its labeled query result. If prior summaries disagree, disclose the conflict
and reconcile with retained query/output or one approved bounded recheck; do not
silently pick a summary.

Bound the pass to one initial query per declared signal, with one correction for
a concrete schema/syntax error. Surface remaining errors. Do not broaden scope
or retry with other identities. If existing data answers a signal, reuse it
within the agreed freshness limits instead of querying again.

When the helper is runnable, construct a transient assessment input and run
`assess`. Its output validates and classifies supplied observations; it does not
execute queries, prove their truth, or certify application health. Keep transient
inputs out of Git and remove scratch inputs when no longer needed.

In tools-only mode, retain minimized observations in the conversation instead
of creating helper inputs or report files. Compare actual counts and event
times with the agreed limits and explain per-signal gaps. If a limit has not
been established, report freshness as unverified, not usable by assumption.
Do not fabricate helper output or silently substitute a manual classification
for an executed deterministic check.
