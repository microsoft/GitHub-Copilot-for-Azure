# 3. Investigate only unanswered material boundaries

Start with the selected failure mechanism and the smallest discriminating
question. Reuse existing evidence. Default ceiling: six total reads, at most
one hour, 50 aggregate rows per result and two representative operations.
An inherited tighter ceiling wins; schema discovery/correction and retries
consume remaining reads. Stop when answered or budget exhausted. One corrected
schema query and one transient retry are permitted only within that ceiling;
never retry denial or an explicit no-retry instruction. Ask before widening.

Discover actual tool names, child operations and input schemas. Reuse the
parent [query-source guidance](../query-routing.md)
only as discovery guidance. In particular:

Follow the shared [trace capability reference](../trace-capabilities.md)
checkpoint before nontrivial distributed trace reconstruction and at truncated
results, missing/disconnected parents, repeated joins or material source-identity
gaps. For a material unresolved cap/parent/correlation issue, show its concise
**Trace capability decision** before requesting the next evidence pass or budget:
existing-path sufficiency, candidate availability/eligibility uncertainty and
bounded choice. Once per material issue; do not defer to cloud checks or force
MCP use. Continue sufficient approved narrow KQL with an explicit rationale.
Use that reference
for server-side population, critical-path and top-attribute analysis versus
representative retrieval. No coordinator load is implied. Prefer sufficient
existing authorized server-side operations regardless of API/MCP transport;
retrieval-only gaps do not authorize bulk download or local reconstruction.
If unavailable, retain these limits and disclose the missing reference.

- Component resource queries use candidates `requests`/`dependencies`,
  `timestamp`, `duration`, `customDimensions`; workspace queries use candidates
  `AppRequests`/`AppDependencies`, `TimeGenerated`, `DurationMs`, `Properties`.
  Confirm table/column/key presence and duration units; the backing workspace
  does not change a component endpoint's query dialect.
- Use source-appropriate Monitor logs/metrics for application, dependency and
  trace boundaries. Use AppLens for an unanswered platform/resource diagnostic
  question when its actual resource-name/type/scope schema fits; Resource Health
  for platform availability. Do not spend the budget on irrelevant platform
  checks or treat provisioning metadata as health.
- Reconstruct each selected failed tool/dependency chain through parent/child
  spans, exception, endpoint category, timeout/retry budget, structured semantic
  status, retries and fallback. Separate transport success, semantic failure,
  caught exceptions, framework lifecycle success and parent-agent outcome.
  Follow [bounded trace patterns](trace-query-patterns.md).
- For plausible AKS/cache pressure, use [managed Prometheus](managed-prometheus.md)
  where available. `InsightsMetrics`/`Perf` cannot substitute for unavailable
  exporter scrape, throttling, OOM or Redis evidence. Running pods/zero restarts
  do not disprove pressure. Discover metric names/labels before assuming them.
- Correlate deployment/configuration timing only when material. Prefer existing
  change evidence or bounded activity/deployment metadata. Never enumerate
  secret-bearing app settings or retrieve secrets before projecting them away.
- For Foundry, retain AI-specific analysis from `microsoft-foundry`; use
  [agent routing](foundry-agent-routing.md) for the application/dependency
  boundary. Do not loop back to Foundry or health for the same question.

Maintain a caller probe ledger: `passed`, `recovered`, `failed`,
`permission_gap`, `not_required`, with source/window and reason. Separately
label missing, denied, empty, stale, throttled, failed, malformed, truncated and
partial evidence. None proves health or an instrumentation gap by itself.
Never collect raw prompts, bodies, secrets, environment or unrestricted logs.
Do not install, log in, change identity, send traffic or run bundled scripts.
PromQL reads require actual available operations, source access and their own
bounded approval; missing operations remain explicit evidence gaps.
