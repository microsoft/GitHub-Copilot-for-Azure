# Architecture choices

Read this before proposing any content-processing or retrieval design. Intent
routing chooses **which workflow**; this reference chooses **what that workflow
builds**. Every build route consults the same table, so a new scenario reuses
these decisions instead of inventing its own.

## The rule

Select the least capable option that meets the workload's quality, security, and
operational requirements. Escalate only on evidence. Overkill is a defect: it
costs latency, money, and determinism, and it hides why a configuration was
chosen. Do not infer sophistication from the customer's importance.

| Axis | Default | Escalate when |
|---|---|---|
| Persistence | No persistent retrieval layer | The corpus is not small, ephemeral, or local |
| Ingestion mode | Minimal extraction | Diagrams, figures, images, tables, or layout carry information the workload needs |
| Retrieval architecture | Classic Search index | Decomposition, iterative retrieval, multiple sources, ambiguity, multi-hop, or cross-evidence synthesis is required |
| Retrieval output | Extractive passages with citations | The workload needs one composed answer across passages |
| Retrieval configuration | Text search over the fields the queries actually use | Natural-language discovery over a corpus and tier that support hybrid retrieval with semantic ranking |
| Reasoning effort | Low | Measurement shows the query shape needs more planning |
| Reuse | Reuse an authorized existing resource | No candidate passes `discovery/reuse-or-provision` |
| Agent harness | Augment the caller's existing agent | The existing harness cannot express the workload |
| Network posture | Match the environment already in use | Policy denies public access or local auth, or the target is production |

## Persistence

Answer from local context when the corpus is small, ephemeral, and already
readable in the session. Indexing a handful of files the agent can open directly
adds cost and a resource to own for no retrieval gain. Escalate to a persistent
layer on corpus size, repeated retrieval failure, reuse across sessions, or a
freshness requirement the session cannot satisfy.

## Ingestion mode

Minimal extraction is the default for clean text. Compose
`knowledge/process-content` when the corpus is PDF, presentation, manual, or
scanned material where diagrams, figures, tables, or layout carry meaning the
questions depend on. Do not select Content Understanding Standard because the
corpus merely contains an image.

## Retrieval architecture

Classic Search is the default for bounded retrieval over a known corpus with
explicit queries, where latency, cost, and deterministic control matter. A
knowledge base is the correct answer when the workload requires query
decomposition, iterative retrieval, several knowledge sources, ambiguity
resolution, multi-hop reasoning, or synthesis across separate evidence.

Consumer type does not decide this. An agent consumer can be served by a classic
index behind a retrieval tool, and an application can need agentic retrieval.
Decide on the query shape, then choose the surface that exposes it.

## Retrieval output

Return extractive passages with citations by default: cheaper, faster, easier to
verify, and the citation stays bound to source text. Enable answer synthesis only
when the workload needs a composed answer across passages and extractive results
demonstrably do not satisfy it. Raise reasoning effort the same way.

## Retrieval configuration

Recommend hybrid retrieval with semantic ranking when the corpus and tier
support it and users ask in natural language. Recommend text search alone for
exact, structured, or very small workloads that gain nothing from embeddings.
Explain the choice rather than forcing vectors into every application, and add
scoring profiles, synonyms, suggesters, or geo fields only when the experience
requires them.

## When the choice is ambiguous

Progressively disclose. Establish the expected query shape and content type from
the repository, the corpus, and the request. If a decision still cannot be made
confidently, either ask one high-value question or evaluate the viable
alternatives with `evaluation/measure-quality` — do not silently pick the more
sophisticated option.

Under autopilot, decide, record the rationale, and prefer the reversible option.
An escalation that cannot be justified from the workload is a finding, not a
default.

## Record the decision

Every build workflow reports the selected value and the evidence for each axis it
exercised, plus any axis deliberately left at its default. A reviewer must be
able to see why a knowledge base, Content Understanding, or answer synthesis was
chosen without asking. An escalation with no recorded justification does not pass
review.
