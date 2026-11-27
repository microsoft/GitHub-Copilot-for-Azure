# Azure MCP capability boundary

This adapter targets merged Azure MCP Monitor commands, not the original
standalone server. Load `trace-investigation-contract` and its transport/capability
reference before executing a workflow. At an unavailable
required step, report the missing capability and the result that cannot be claimed.
Never approximate that step or invent a tool/parameter. Supported query,
selection-versus-remainder top attributes and ordinary critical path remain usable.

# What changed

Load the plugin skill `trace-investigation-contract` by its exact native name
before querying; reuse it throughout continuation. It owns provider routing, P/Q,
counting/coverage, fragment assembly, query/recovery rules, budgets and output.
If native loading fails, stop and report that prerequisite.
Read only the needed [comparison query](query-patterns.md) section.

## 1. Freeze account, windows and population
Use the shared account/P contract. Default comparison P: `Traces`, grouped by
stored root name; a narrower supplied predicate remains unchanged.
Use explicit UTC windows, each query <=24h. Weekly default: last completed UTC
hour versus that hour seven days earlier, labelled a matched-hour sample.
Since-deploy: equal before/after hours, shorten both if needed. Full periods
require matching daily slices; sum counts only with shared-verified disjoint
membership, otherwise union IDs or label overlapping record counts.
Never average slice percentiles.

## 2. Measure complete, comparable evidence
Independent statistics, attributes and critical-path comparisons are unavailable
in merged Azure MCP. Report paired current/baseline/diff evidence unavailable and stop
that required comparison step; do not replace it with unpaired calls. Caller-supplied
paired evidence may be inspected, with its provenance and coverage retained. The later
ranking/mechanism steps apply only to such supplied evidence, never invented tool output.
Ordinary queries and CPA can inspect a supplied example, not establish this missing pair.

## 3. Rank material changes, not noise
Use >=100 rows/root in both windows for latency/error claims; >=100 in the
populated window for new/not-observed groups. Volume: >=20% and >=100 rows;
latency: >=20% and >=10ms; flags: >=1 pp and >=10 excess flagged rows.
Distributions: >=100 occurrences and >=5 pp; paths: >=100 P rows each,
>=20 matches in the populated cohort and >=5 pp. Rank excess flags, latency,
then volume/mix. Give before/after values, relative percent, and pp for rates/shares.
Compare the same operation/value; zero baseline means new/not observed, not infinity.
New/different scenario roots are not comparable regressions.
Reconcile comparator span totals against both paired sums; if incompatible,
replace rankings with paired distributions. Compare verified GenAI usage/tool
units across the same cohorts; separate model/workload mix from per-inference changes.

## 4. Test paths and the leading hypothesis
Within P, sample vocabulary, then pair forward/reverse ancestry, repetition and
shared-ancestor counts, using shared composition/repetition rules.
Reserve a discriminating confirmation: compare affected-path versus all affected
fractions, or test a disjoint workload partition against the pool delta.
For latency, floor the before p95 to decimal INTEGER ns before applying the
shared typed-cutoff rule. Revise disproved hypotheses.
Plan for 13 base and 16 path MCP attempts, including failures, validation and
resumes: working estimates, not caller hard caps. Apply shared accounting.
Reserve four confirmation submissions if both affected denominators are unknown,
plus their drain calls. At an estimate, stop new hypotheses; finish pending
operations within any explicit caller cap; record estimate overruns, never drop pages.

## 5. Dig below the implicated operation
A long wrapper locates elapsed time, not its cause. Inspect bounded comparison
and slow example traces across downstream services and parallel worker branches.
Use shared exact-ID assembly; compare child timing and recorded resource signals.
Compare count totals only after full assembly; otherwise label each as observed or
lower-bound. Incomplete example traces cannot support exact before/after workload ratios.
Union overlapping intervals; do not sum nested/parallel durations as wall time.
When children account for the delay, descend again without user prodding.
Inspect leaf attributes/errors and exposed events/links before declaring a boundary.
Low volume limits population claims, not bounded example trace inspection.
An open span proves neither active CPU nor I/O cause.
Give trace/span IDs, actual parent/child relations, operation/service and timing;
state exactly what was checked, missing or inaccessible; use shared recovery as needed.

## 6. Execute continuation, preserving the investigation
Use shared native continuation for unresolved latency, error or token findings.
Carry paired results, frozen windows, example traces and the current path hypothesis,
plus the caller cap or `unspecified`, alongside shared context/counters. This comparison's
continuation working estimate is 26 MCP attempts, not a whole-chain ceiling.
Charge every drain to its originating stage and monotonic chain; continuation never resets
spent calls or grants another allowance for the same stage.
Reuse completed discovery/queries; do not restart the comparison in the recipient.
An unresolved available discriminating query is not an endpoint.

## 7. Return one evidence-backed, checkable answer
Follow shared output rules: a bottom line, before/after figures in prose or a table,
concrete operation/example trace evidence and the exact comparison windows/scope.
Explain the relevant comparison sizes, timings and mechanism; keep raw calculations
and machine continuation context internal/in an artifact.
Use shared claim tiers; test workload/instrumentation confounding before
attributing a comparable regression or extra work. Do not stop at a diff.
