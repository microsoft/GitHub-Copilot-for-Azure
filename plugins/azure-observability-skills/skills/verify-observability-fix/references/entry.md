# Entry from an investigation or change

Follow [the result-to-next-action contract](shared/next-actions.md).
A proposed or approved plan without an actual confirmed change stays at
**Guide an approved fix**; do not start verification or label it recovered.
Confirm the change is effective in the scope being verified. A local edit or
local unit validation does not establish deployed behavior. Local-only changes
can be compared using supplied local evidence without requiring cloud deployment;
no new tests, traffic or reads follow automatically.
After an actual approved change, accept an offered comparison or reuse an
already accepted verification request without another prompt. A yes/"continue"
permits comparison of existing explicitly supplied evidence only, not new
reads, jobs, traffic or saving. Missing/stale evidence or unagreed criteria
requires the minimal missing supplied input/decision or separately approved
collection; report INCONCLUSIVE, never manufacture success. Preserve accepted/
declined next steps, read-only ceilings and explicit stops across handoffs.

Read [the evidence contract](contract.md) before constructing input.
Use [the fixture](fixture.json) only for offline demonstration; its
thresholds, scope and results are synthetic, not recommended SLOs.
The separate [slow-agent p95 fixture](fixture-p95.json) demonstrates
source-computed tail latency, not live agent recovery.
