# Measure retrieval quality

**Domain:** Evaluation
**Reads:** workload profile — query shape, entitlement model.

Use this primitive for a classic index or Foundry IQ knowledge base when the user
wants a baseline, a diagnosis of answer quality, or evidence before changing
anything. This primitive is read-only and never requires approval. Composing
`tune-quality` without it is not permitted.

## Required user input

Require a user-provided evaluation dataset. Accept a repository file, artifact, or
approved data location in JSON, JSONL, CSV, or an existing project format. It must
identify each query and either relevant document IDs, an expected answer with
supporting evidence, or an explicit judgment method. Optional fields include
filters, identity, language, category, and criticality.

If no dataset is supplied, ask for its path or location. Do not fabricate labels,
silently substitute generated queries, or report synthetic scores as evaluation.
Validate the format and report unusable rows before running.

## Record a baseline

Produce a baseline run record that later runs can be compared against. It must
capture enough state that a rerun is meaningful:

1. A digest of the dataset and the queryset.
2. The target index or knowledge base and a snapshot of its configuration,
   including retrieval mode, ranking, filters, and reasoning effort.
3. The source or index content snapshot and its freshness.
4. The identity set used, when results are permission-dependent.
5. The primary metric and any user-supplied thresholds.

Run the current configuration unchanged. For classic search, measure applicable
recall@k, MRR, nDCG@k, zero-result rate, latency, and filter correctness. For
grounded answers, add groundedness, citation correctness and completeness, source
inspection, and ACL isolation.

## Diagnose failure modes

Segment results by criticality, category, language, and identity when present.
Show individual failures alongside aggregates; an aggregate score hides the
failure that motivated the request.

Attribute each failure to a likely cause rather than reporting a number alone:
content preparation and chunking, missing or stale content, source configuration,
retrieval mode, filters, ranking, reasoning effort, or answer behavior. Rank the
causes by the evidence supporting them.

Do not change configuration to test a hypothesis. Read-only experiments that
issue queries are permitted; mutating the deployed configuration belongs to
`tune-quality`.

## Output contract

Return the dataset identity and validation result, the baseline run record and its
digest, metrics with segmentation, the individual failures, the ranked candidate
causes, and the single change you would test first. When the user asked only for a
baseline, stop here and do not apply a change.
