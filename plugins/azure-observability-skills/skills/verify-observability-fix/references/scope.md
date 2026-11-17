# 1. Retain scope and agree the gate

State the selected skill, confirmed environment/targets, incident, actual change
ID/version/deployment time, available local read/comparison operations, and any
blockers **before execution**. Reuse explicitly confirmed onboarding scope
where supplied; a saved mapping or repository name alone is not confirmation.
Do not silently expand targets, subscriptions, time windows, or identity.

Agree required original symptom checks and relevant regression/quality
guardrails. Establish metric definitions, units, query/result references,
target/version filters, workload populations and comparability, minimum samples,
minimum observed duration, freshness and evidence reuse limits, and absolute
acceptance thresholds **with the task owner**, never invent defaults. Confirm
that the plan covers the incident symptom; an HTTP 200, successful deployment,
or one passing evaluation is not that plan.

For Foundry agents, retain distinct runtime, model/tool and quality/safety
requirements. Reuse existing Foundry evaluation/deployment results as supporting
evidence; do not rebuild evaluation workflows. Existing evaluation aggregates
can be a required metric only when they genuinely satisfy the same source,
target/version, population, temporal and sample requirements. Batch scores
without event-span/traffic evidence do not establish production recovery.

Included supporting results with `failed`, `partial` or `unknown` status are an
**unresolved supporting-evidence coverage gap**: these references lack
candidate/version/time applicability fields, so do not silently ignore their
possible contradiction. This gap prevents VERIFIED_RECOVERED but never proves
NOT_RECOVERED by itself; a sufficient required post-change violation still wins.
Resolve relevance through actual applicable required checks. Omit only
demonstrably irrelevant support with an explanation outside the input; never
relabel failures, drop relevant contradictions, or tweak scores to turn green.
An empty supporting-results list is allowed with an actual confirmed change;
passed support alone never establishes recovery.
