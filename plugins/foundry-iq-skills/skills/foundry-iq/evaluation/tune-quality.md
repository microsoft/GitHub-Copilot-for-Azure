# Tune retrieval quality

**Domain:** Evaluation
**Reads:** workload profile — query shape, latency and cost.

Use this primitive to improve a classic index or Foundry IQ knowledge base once
its quality has been measured. Tuning mutates configuration, so it sits on the
approval side of the boundary that `measure-quality` does not cross.

## Precondition

Require a baseline run record produced by `measure-quality` over the same dataset
digest and the same target. If it is absent, stale, or was taken against a
different configuration or content snapshot, run `measure-quality` first.

Do not begin parameter experimentation without a baseline. Unmeasured tuning
cannot be accepted or rolled back on evidence, and is the failure mode this
primitive exists to prevent.

## Change one variable at a time

1. Select the single highest-ranked candidate cause from the baseline.
2. State the change, why the observed failures support it, and the predicted
   effect on quality, latency, and cost.
3. Keep the change bounded and reversible. Candidate variables include content
   preparation and chunking, content-processing mode, knowledge-source
   configuration, retrieval mode, filters, ranking and semantic configuration,
   reasoning effort, and answer behavior.
4. Never change two variables in one iteration. A combined change that improves
   the metric cannot be attributed or safely reverted.

Some candidates are escalations along the axes in
`references/architecture-choices.md`: minimal extraction to Content Understanding
Standard, extractive passages to answer synthesis, low to higher reasoning
effort, or a classic index to a knowledge base. Measurement is what authorizes
them. An escalation that does not beat its baseline is reverted like any other
failed candidate, and the negative result is what keeps the configuration
minimal.

## Approval

Read-only experiments need no approval. Follow
`references/defaults-and-approvals.md` and obtain approval before changing a
deployed configuration, reprocessing or rebuilding an index, or increasing
billable usage. Under autopilot, apply one bounded change within an existing
approval and report it; a new resource, permission, or cost class still stops for
approval.

## Accept or revert

Rerun the identical dataset, identities, and metric from the baseline record.
Accept a candidate only when it improves the primary metric without regressing
access control or critical queries. Revert immediately when it does not, and
record the negative result so it is not retried.

If the user has no thresholds, recommend
no security or critical-query regression, a primary-metric lift larger than the
observed run variance, and no more than 20% latency or query-cost regression.
Repeat a trial when the lift is within run variance rather than reporting it as
an improvement. Ask before treating those recommendations as a release gate.

## Output contract

Return the baseline record referenced, the single changed variable and its
rationale, the approval obtained, before and after metrics with uncertainty, any
regression, the accept or revert decision, the retained configuration, and the
rollback value.
